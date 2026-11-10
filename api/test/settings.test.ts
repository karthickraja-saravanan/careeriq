import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TEST_DB_URL, form, samples, startTestApp } from "./helpers.js";

describe.skipIf(!TEST_DB_URL)("settings: sample data (integration)", () => {
  let t: Awaited<ReturnType<typeof startTestApp>>;
  beforeAll(async () => { t = await startTestApp(); });
  afterAll(() => t.close());
  beforeEach(async () => { await t.reset(); });

  const list = async (kind: "resumes" | "jobs") => (await (await fetch(`${t.base}/${kind}`)).json())[kind] as { status: string }[];

  it("loads one resume and three jobs that are processed like uploads", async () => {
    const res = await fetch(`${t.base}/settings/seed-demo-data`, { method: "POST" });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ resumes: 1, jobs: 3 });
    await t.queue.drain();
    expect((await list("resumes")).map((r) => r.status)).toEqual(["ready"]);
    expect((await list("jobs")).map((r) => r.status)).toEqual(["ready", "ready", "ready"]);
    const { rows } = await t.pool.query("SELECT count(*)::int AS n FROM chunks");
    expect(rows[0].n).toBeGreaterThan(3);
  });

  it("replaces existing data instead of duplicating it", async () => {
    await fetch(`${t.base}/resumes`, { method: "POST", body: form({ name: "cv.docx", data: readFileSync(samples("resume-priya-nair.docx")) }) });
    await t.queue.drain();
    for (let i = 0; i < 2; i++) { await fetch(`${t.base}/settings/seed-demo-data`, { method: "POST" }); await t.queue.drain(); }
    expect(await list("resumes")).toHaveLength(1);
    expect(await list("jobs")).toHaveLength(3);
  });

  it("clears documents and conversations, and only the current user's", async () => {
    await t.pool.query("INSERT INTO users (id, email, display_name) VALUES ('00000000-0000-0000-0000-000000000002', 'other@x.test', 'Other') ON CONFLICT DO NOTHING");
    await t.pool.query("INSERT INTO documents (user_id, kind, raw_text, status) VALUES ('00000000-0000-0000-0000-000000000002', 'job', 'keep me', 'extracted')");
    await fetch(`${t.base}/settings/seed-demo-data`, { method: "POST" });
    await t.queue.drain();
    await fetch(`${t.base}/conversations`, { method: "POST" });

    expect((await fetch(`${t.base}/settings/data`, { method: "DELETE" })).status).toBe(204);
    expect(await list("resumes")).toEqual([]);
    expect(await list("jobs")).toEqual([]);
    expect((await (await fetch(`${t.base}/conversations`)).json()).conversations).toEqual([]);
    const { rows } = await t.pool.query("SELECT count(*)::int AS n FROM documents WHERE user_id = '00000000-0000-0000-0000-000000000002'");
    expect(rows[0].n).toBe(1);
    await t.pool.query("DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000002'");
  });
});
