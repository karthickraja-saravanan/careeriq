import type pg from "pg";
import type { LlmUsageRecord, UsageRecorder } from "./types.js";

export interface UsageTotals {
  calls: number;
  errors: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface UsageGroup extends UsageTotals {
  key: string;
}

export interface UsageSummary {
  totals: UsageTotals;
  byPurpose: UsageGroup[];
  byModel: UsageGroup[];
  recent: { id: string; purpose: string; model: string; promptTokens: number; completionTokens: number; estimated: boolean; latencyMs: number; status: string; createdAt: string }[];
}

const AGG = `count(*)::int AS calls,
  count(*) FILTER (WHERE status = 'error')::int AS errors,
  coalesce(sum(prompt_tokens), 0)::int AS prompt,
  coalesce(sum(completion_tokens), 0)::int AS completion,
  coalesce(sum(total_tokens), 0)::int AS total`;

type AggRow = { calls: number; errors: number; prompt: number; completion: number; total: number };
const totals = (r: AggRow): UsageTotals => ({ calls: r.calls, errors: r.errors, promptTokens: r.prompt, completionTokens: r.completion, totalTokens: r.total });

export class UsageRepo {
  constructor(private readonly pool: pg.Pool) {}

  async record(r: LlmUsageRecord & { userId: string }) {
    await this.pool.query(
      `INSERT INTO llm_usage (user_id, purpose, model, tier, prompt_tokens, completion_tokens, estimated, latency_ms, status, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [r.userId, r.purpose, r.model, r.tier, r.promptTokens, r.completionTokens, r.estimated, r.latencyMs, r.status, r.error ?? null],
    );
  }

  async summary(userId: string, recentLimit = 20): Promise<UsageSummary> {
    const [all, purpose, model, recent] = await Promise.all([
      this.pool.query<AggRow>(`SELECT ${AGG} FROM llm_usage WHERE user_id = $1`, [userId]),
      this.pool.query<AggRow & { key: string }>(`SELECT purpose AS key, ${AGG} FROM llm_usage WHERE user_id = $1 GROUP BY purpose ORDER BY total DESC`, [userId]),
      this.pool.query<AggRow & { key: string }>(`SELECT model AS key, ${AGG} FROM llm_usage WHERE user_id = $1 GROUP BY model ORDER BY total DESC`, [userId]),
      this.pool.query(
        `SELECT id, purpose, model, prompt_tokens, completion_tokens, estimated, latency_ms, status, created_at
         FROM llm_usage WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [userId, recentLimit],
      ),
    ]);
    return {
      totals: totals(all.rows[0]!),
      byPurpose: purpose.rows.map((r) => ({ key: r.key, ...totals(r) })),
      byModel: model.rows.map((r) => ({ key: r.key, ...totals(r) })),
      recent: recent.rows.map((r) => ({
        id: r.id,
        purpose: r.purpose,
        model: r.model,
        promptTokens: r.prompt_tokens,
        completionTokens: r.completion_tokens,
        estimated: r.estimated,
        latencyMs: r.latency_ms,
        status: r.status,
        createdAt: new Date(r.created_at).toISOString(),
      })),
    };
  }
}

/** A pino Logger fits; `info` is optional so tests can pass just `error`. */
export interface UsageLog {
  info?(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
}

/** Fire-and-forget recorder: a failed insert is logged and never affects the request that made the LLM call. */
export function createUsageRecorder(repo: UsageRepo, log: UsageLog): UsageRecorder {
  return (record) => {
    log.info?.(
      { purpose: record.purpose, model: record.model, promptTokens: record.promptTokens, completionTokens: record.completionTokens, latencyMs: record.latencyMs, status: record.status },
      "llm call",
    );
    if (!record.userId) return;
    repo.record({ ...record, userId: record.userId }).catch((err) => log.error({ err }, "could not record LLM usage"));
  };
}
