import type pg from "pg";
import type { Embedder } from "../embeddings/types.js";

export interface SearchHit {
  chunkId: string;
  /** Short reference shown to the user and used by the model, e.g. R3 (resume) or J2-1 (job #2). */
  cite: string;
  ownerType: "resume" | "job";
  ownerId: string;
  section: string;
  content: string;
  /** Rank in each list (1 = best, null = not in that list) and the fused score. */
  vectorRank: number | null;
  keywordRank: number | null;
  score: number;
}

export interface SearchFilter {
  ownerType?: "resume" | "job";
  ownerId?: string;
}

const CANDIDATES = 20;
const RRF_K = 60;

export const toVectorLiteral = (v: number[]) => `[${v.join(",")}]`;

/** Reduce a question to alphanumeric words joined with OR, safe to feed to to_tsquery. */
export function buildKeywordQuery(question: string): string | null {
  const words = question.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const unique = [...new Set(words.filter((w) => w.length > 1))];
  return unique.length ? unique.join(" | ") : null;
}

/** Reciprocal rank fusion: documents ranked well in either list rise to the top. */
export function fuseRankings(vector: string[], keyword: string[], k = RRF_K): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of [vector, keyword]) list.forEach((id, i) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1)));
  return scores;
}

interface Row {
  id: string; owner_type: "resume" | "job"; owner_id: string; section: string; ordinal: number; content: string; job_label: string | null;
}

const citeFor = (r: Row) => (r.owner_type === "resume" ? `R${r.ordinal}` : `J${(r.job_label ?? "").replace(/\D/g, "") || "?"}-${r.ordinal}`);

const BASE = `FROM chunks c LEFT JOIN jobs j ON c.owner_type = 'job' AND j.id = c.owner_id
  WHERE c.user_id = $1 AND c.embedding IS NOT NULL
    AND ($2::text IS NULL OR c.owner_type = $2) AND ($3::uuid IS NULL OR c.owner_id = $3)`;
const COLS = "c.id, c.owner_type, c.owner_id, c.section, c.ordinal, c.content, j.label AS job_label";

/** Hybrid search for one user: vector similarity plus keyword match, merged with reciprocal rank fusion. */
export async function hybridSearch(
  pool: pg.Pool,
  embedder: Embedder,
  userId: string,
  question: string,
  filter: SearchFilter = {},
  limit = 5,
): Promise<SearchHit[]> {
  const [vec] = await embedder.embed([question], "query");
  const args = [userId, filter.ownerType ?? null, filter.ownerId ?? null];
  const tsq = buildKeywordQuery(question);

  const [vectorRes, keywordRes] = await Promise.all([
    pool.query<Row>(`SELECT ${COLS} ${BASE} ORDER BY c.embedding <=> $4::vector LIMIT ${CANDIDATES}`, [...args, toVectorLiteral(vec!)]),
    tsq
      ? pool.query<Row>(
          `SELECT ${COLS} ${BASE} AND c.tsv @@ to_tsquery('english', $4) ORDER BY ts_rank_cd(c.tsv, to_tsquery('english', $4)) DESC LIMIT ${CANDIDATES}`,
          [...args, tsq],
        )
      : Promise.resolve({ rows: [] as Row[] }),
  ]);

  const byId = new Map<string, Row>();
  [...vectorRes.rows, ...keywordRes.rows].forEach((r) => byId.set(r.id, r));
  const vRank = new Map(vectorRes.rows.map((r, i) => [r.id, i + 1]));
  const kRank = new Map(keywordRes.rows.map((r, i) => [r.id, i + 1]));
  const fused = fuseRankings(vectorRes.rows.map((r) => r.id), keywordRes.rows.map((r) => r.id));

  return [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, score]) => {
      const r = byId.get(id)!;
      return {
        chunkId: id, cite: citeFor(r), ownerType: r.owner_type, ownerId: r.owner_id, section: r.section, content: r.content,
        vectorRank: vRank.get(id) ?? null, keywordRank: kRank.get(id) ?? null, score,
      };
    });
}

export interface BalancedOptions {
  /** Restrict to these job ids; default is all of the user's jobs. */
  jobIds?: string[];
  /** Restrict to these resumes; default is the newest one. */
  resumeIds?: string[];
  resumeLimit?: number;
  perJobLimit?: number;
}

/**
 * Retrieval for comparison questions: a fixed quota from the resume plus a quota from each job,
 * so the answer always has evidence from both sides even when one side matches the words better.
 */
export async function retrieveBalanced(
  pool: pg.Pool,
  embedder: Embedder,
  userId: string,
  question: string,
  opts: BalancedOptions = {},
): Promise<SearchHit[]> {
  const jobIds =
    opts.jobIds ?? (await pool.query<{ id: string }>("SELECT id FROM jobs WHERE user_id = $1 ORDER BY created_at", [userId])).rows.map((r) => r.id);
  // Only the user's own resumes can be searched, whatever ids were asked for.
  const resumes = opts.resumeIds?.length
    ? (await pool.query<{ id: string; label: string }>("SELECT id, label FROM resumes WHERE user_id = $1 AND id = ANY($2::uuid[]) ORDER BY created_at", [userId, opts.resumeIds])).rows
    : (await pool.query<{ id: string; label: string }>("SELECT id, label FROM resumes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [userId])).rows;
  // With several resumes "R3" would be ambiguous, so passages are cited as "CV2-3" (resume CV2, passage 3).
  const qualify = resumes.length > 1;

  const groups = await Promise.all([
    ...resumes.map(async (r) => {
      const found = await hybridSearch(pool, embedder, userId, question, { ownerType: "resume", ownerId: r.id }, opts.resumeLimit ?? 4);
      return qualify ? found.map((h) => ({ ...h, cite: `${r.label}-${h.cite.slice(1)}` })) : found;
    }),
    ...jobIds.map((id) => hybridSearch(pool, embedder, userId, question, { ownerType: "job", ownerId: id }, opts.perJobLimit ?? 4)),
  ]);
  return groups.flat();
}
