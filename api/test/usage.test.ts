import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createOpenAiCompatibleClient } from "../src/llm/openaiCompatible.js";
import type { LlmUsageRecord } from "../src/llm/types.js";
import { UsageRepo, createUsageRecorder } from "../src/llm/usage.js";
import { TEST_DB_URL, startTestApp } from "./helpers.js";

const DEMO = "00000000-0000-0000-0000-000000000001";

function client(res: Response | Error) {
  const records: LlmUsageRecord[] = [];
  const bodies: any[] = [];
  const c = createOpenAiCompatibleClient({
    baseUrl: "https://llm.test/v1", models: { main: "big", fast: "small" }, maxAttempts: 1,
    fetchImpl: (async (_u: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      if (res instanceof Error) throw res;
      return res;
    }) as unknown as typeof fetch,
    onUsage: (r) => records.push(r),
  });
  return { c, records, bodies };
}
const collect = async (it: AsyncIterable<string>) => { let out = ""; for await (const p of it) out += p; return out; };
const sse = (lines: object[]) => new Response(lines.map((l) => `data: ${JSON.stringify(l)}\n\n`).join("") + "data: [DONE]\n\n", { status: 200 });

describe("LLM usage capture", () => {
  const meta = { userId: DEMO, purpose: "analysis" };

  it("records provider-reported tokens for a JSON call", async () => {
    const { c, records } = client(new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }], usage: { prompt_tokens: 120, completion_tokens: 30 } })));
    await c.completeJson({ tier: "fast", system: "s", user: "u", meta });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ userId: DEMO, purpose: "analysis", model: "small", tier: "fast", promptTokens: 120, completionTokens: 30, estimated: false, status: "ok" });
    expect(records[0]!.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("estimates tokens from text length when the provider reports none", async () => {
    const { c, records } = client(new Response(JSON.stringify({ choices: [{ message: { content: "x".repeat(40) } }] })));
    await c.completeJson({ tier: "main", system: "a".repeat(40), user: "b".repeat(40) });
    expect(records[0]).toMatchObject({ estimated: true, purpose: "unknown", completionTokens: 10, status: "ok" });
    expect(records[0]!.promptTokens).toBeGreaterThan(0);
  });

  it("records a failed call with its error", async () => {
    const { c, records } = client(new Response("nope", { status: 400 }));
    await expect(c.completeJson({ tier: "main", system: "s", user: "u", meta })).rejects.toThrow();
    expect(records[0]).toMatchObject({ status: "error", purpose: "analysis" });
    expect(records[0]!.error).toContain("400");
  });

  it("reads usage from the final stream chunk and asks the provider to send it", async () => {
    const { c, records, bodies } = client(sse([
      { choices: [{ delta: { content: "Hi " } }] },
      { choices: [{ delta: { content: "there" } }] },
      { choices: [], usage: { prompt_tokens: 50, completion_tokens: 7 } },
    ]));
    expect(await collect(c.streamChat({ tier: "main", messages: [{ role: "user", content: "hi" }], meta: { userId: DEMO, purpose: "chat" } }))).toBe("Hi there");
    expect(bodies[0].stream_options).toEqual({ include_usage: true });
    expect(records[0]).toMatchObject({ purpose: "chat", promptTokens: 50, completionTokens: 7, estimated: false, status: "ok" });
  });

  it("understands Groq's x_groq.usage and falls back to an estimate", async () => {
    const groq = client(sse([{ choices: [{ delta: { content: "ok" } }], x_groq: { usage: { prompt_tokens: 9, completion_tokens: 2 } } }]));
    await collect(groq.c.streamChat({ tier: "main", messages: [{ role: "user", content: "hi" }] }));
    expect(groq.records[0]).toMatchObject({ promptTokens: 9, completionTokens: 2, estimated: false });

    const none = client(sse([{ choices: [{ delta: { content: "abcdefgh" } }] }]));
    await collect(none.c.streamChat({ tier: "main", messages: [{ role: "user", content: "hi" }] }));
    expect(none.records[0]).toMatchObject({ estimated: true, completionTokens: 2 });
  });

  it("marks a stream the reader stops early as cancelled", async () => {
    const { c, records } = client(sse([{ choices: [{ delta: { content: "a" } }] }, { choices: [{ delta: { content: "b" } }] }]));
    for await (const _ of c.streamChat({ tier: "main", messages: [{ role: "user", content: "hi" }] })) break;
    expect(records[0]).toMatchObject({ status: "cancelled" });
  });

  it("never breaks the call when the recorder throws", async () => {
    const c = createOpenAiCompatibleClient({
      baseUrl: "https://llm.test/v1", models: { main: "b", fast: "s" },
      fetchImpl: (async () => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }))) as unknown as typeof fetch,
      onUsage: () => { throw new Error("db down"); },
    });
    await expect(c.completeJson({ tier: "main", system: "s", user: "u" })).resolves.toBe("{}");
  });
});

describe.skipIf(!TEST_DB_URL)("LLM usage storage (integration)", () => {
  let t: Awaited<ReturnType<typeof startTestApp>>;
  beforeAll(async () => { t = await startTestApp(); });
  afterAll(() => t.close());
  beforeEach(async () => { await t.pool.query("DELETE FROM llm_usage"); });

  const rec = (over: Partial<LlmUsageRecord> = {}): LlmUsageRecord & { userId: string } => ({
    userId: DEMO, purpose: "chat", model: "big", tier: "main", promptTokens: 100, completionTokens: 20, estimated: false, latencyMs: 300, status: "ok", ...over,
  });

  it("stores calls and summarises them by feature and model", async () => {
    const repo = new UsageRepo(t.pool);
    await repo.record(rec());
    await repo.record(rec({ purpose: "analysis", promptTokens: 1000, completionTokens: 200 }));
    await repo.record(rec({ purpose: "chat_rewrite", model: "small", tier: "fast", promptTokens: 10, completionTokens: 5, status: "error", error: "boom" }));
    const res = await fetch(`${t.base}/usage`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totals).toEqual({ calls: 3, errors: 1, promptTokens: 1110, completionTokens: 225, totalTokens: 1335 });
    expect(body.byPurpose.map((g: any) => g.key)).toEqual(["analysis", "chat", "chat_rewrite"]);
    expect(body.byModel.map((g: any) => g.key)).toEqual(["big", "small"]);
    expect(body.recent).toHaveLength(3);
  });

  it("only counts the current user's calls", async () => {
    const other = "00000000-0000-0000-0000-000000000002";
    await t.pool.query("INSERT INTO users (id, email, display_name) VALUES ($1, 'other@x.test', 'Other') ON CONFLICT DO NOTHING", [other]);
    const repo = new UsageRepo(t.pool);
    await repo.record(rec({ promptTokens: 5, completionTokens: 5 }));
    await repo.record({ ...rec({ promptTokens: 9999 }), userId: other });
    const body = await (await fetch(`${t.base}/usage`)).json();
    expect(body.totals.totalTokens).toBe(10);
  });

  it("the recorder inserts rows and ignores calls without a user", async () => {
    const repo = new UsageRepo(t.pool);
    const record = createUsageRecorder(repo, { error: () => undefined });
    record(rec());
    const { userId: _drop, ...anonymous } = rec();
    record(anonymous);
    await new Promise((r) => setTimeout(r, 150));
    const { rows } = await t.pool.query("SELECT count(*)::int AS n FROM llm_usage");
    expect(rows[0].n).toBe(1);
  });

  it("attributes document parsing to the owner", async () => {
    await fetch(`${t.base}/settings/seed-demo-data`, { method: "POST" });
    await t.queue.drain();
    const purposes = t.llm!.calls.map((c) => c.meta?.purpose);
    expect(purposes).toContain("parse_resume");
    expect(purposes).toContain("parse_job");
    expect(t.llm!.calls.every((c) => c.meta?.userId === DEMO)).toBe(true);
  });
});
