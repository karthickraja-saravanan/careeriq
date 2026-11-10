import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TEST_DB_URL, FAKE_JOB, FAKE_RESUME, FakeLlm, form, samples, startTestApp } from "./helpers.js";

describe.skipIf(!TEST_DB_URL)("indexing and retrieval (integration)", () => {
  let t: Awaited<ReturnType<typeof startTestApp>>;
  beforeAll(async () => { t = await startTestApp(); });
  afterAll(() => t.close());
  beforeEach(async () => { await t.reset(); t.llm!.responses = []; });

  const json = { "content-type": "application/json" };
  const addJob = async (parsed: object, text = readFileSync(samples("job1-senior-backend-engineer.txt"), "utf8")) => {
    t.llm!.responses.push(JSON.stringify(parsed));
    const r = await (await fetch(`${t.base}/jobs`, { method: "POST", headers: json, body: JSON.stringify({ text }) })).json();
    await t.queue.drain();
    return r as { id: string; label: string };
  };
  const addResume = async () => {
    const r = await (await fetch(`${t.base}/resumes`, { method: "POST", body: form({ name: "cv.docx", data: readFileSync(samples("resume-priya-nair.docx")) }) })).json();
    await t.queue.drain();
    return r as { id: string };
  };
  const search = async (q: string, job?: string) => (await (await fetch(`${t.base}/search?q=${encodeURIComponent(q)}${job ? `&job=${job}` : ""}`)).json()).hits as { cite: string; ownerType: string; section: string; content: string }[];

  it("indexes a parsed resume into chunks and marks it ready", async () => {
    const { id } = await addResume();
    expect((await (await fetch(`${t.base}/resumes/${id}`)).json()).status).toBe("ready");
    const { rows } = await t.pool.query("SELECT section, ordinal, embedding_model, vector_dims(embedding) AS dims FROM chunks ORDER BY ordinal");
    expect(rows.map((r) => r.section)).toEqual(["summary", "skills", "experience", "experience", "projects", "education", "certifications"]);
    expect(rows[0]).toMatchObject({ embedding_model: "hash-test", dims: 384 });
  });

  it("finds an exact skill via keyword + vector search and cites it", async () => {
    await addResume();
    const job = await addJob(FAKE_JOB);
    const hits = await search("Kafka experience", job.id);
    const top = hits.find((h) => h.ownerType === "job")!;
    expect(top.cite).toBe("J1-3");
    expect(top.content).toContain("Kafka");
  });

  it("always returns evidence from both the resume and the job", async () => {
    await addResume();
    const job = await addJob(FAKE_JOB);
    const hits = await search("Kafka", job.id);
    expect(new Set(hits.map((h) => h.ownerType))).toEqual(new Set(["resume", "job"]));
  });

  it("cites jobs by their label number", async () => {
    await addJob(FAKE_JOB);
    const second = await addJob({ ...FAKE_JOB, requiredSkills: ["GraphQL"] });
    expect(second.label).toBe("Job #2");
    const hits = await search("GraphQL", second.id);
    expect(hits[0]!.cite).toMatch(/^J2-/);
  });

  it("re-indexes after a user edit", async () => {
    const { id } = await addResume();
    expect(await search("Rust")).not.toEqual(expect.arrayContaining([expect.objectContaining({ content: expect.stringContaining("Rust") })]));
    const res = await fetch(`${t.base}/resumes/${id}`, { method: "PATCH", headers: json, body: JSON.stringify({ parsed: { ...FAKE_RESUME, skills: ["Rust", "Zig"] } }) });
    expect(res.status).toBe(200);
    await t.queue.drain();
    const hits = await search("Rust");
    expect(hits[0]!.content).toContain("Rust");
    expect((await (await fetch(`${t.base}/resumes/${id}`)).json()).status).toBe("ready");
  });

  it("removes chunks when the document is deleted", async () => {
    const { id } = await addResume();
    await fetch(`${t.base}/resumes/${id}`, { method: "DELETE" });
    expect((await t.pool.query("SELECT count(*)::int AS n FROM chunks")).rows[0].n).toBe(0);
  });

  it("never returns another user's chunks", async () => {
    await t.pool.query("INSERT INTO users (id, email, display_name) VALUES ('00000000-0000-0000-0000-000000000002','other@x.test','Other') ON CONFLICT DO NOTHING");
    const other = await t.repo.createResume("00000000-0000-0000-0000-000000000002", { filename: null, mime: null, storagePath: null, sha256: null, rawText: "x" });
    const [vec] = await t.embedder.embed(["secret kubernetes terraform expertise"], "passage");
    await t.repo.replaceChunks("00000000-0000-0000-0000-000000000002", other.documentId, { type: "resume", id: other.resumeId },
      [{ section: "skills", ordinal: 1, content: "Skills: kubernetes terraform", tokenCount: 5, embedding: vec! }], "hash-test");
    await addResume();
    const hits = await search("kubernetes terraform");
    expect(hits.every((h) => !h.content.includes("terraform"))).toBe(true);
  });

  it("reports a failed index with a retry hint when the embedder is down", async () => {
    t.embedder.failNext = true;
    const { id } = await addResume();
    const got = await (await fetch(`${t.base}/resumes/${id}`)).json();
    expect(got.status).toBe("failed");
    expect(got.error).toMatch(/search index could not be built/);
    expect((await fetch(`${t.base}/resumes/${id}/reparse`, { method: "POST" })).status).toBe(202);
    await t.queue.drain();
    expect((await (await fetch(`${t.base}/resumes/${id}`)).json()).status).toBe("ready");
  });

  it("validates the search query", async () => {
    expect((await fetch(`${t.base}/search?q=x`)).status).toBe(400);
    expect((await fetch(`${t.base}/search?q=ok&job=nope`)).status).toBe(400);
  });
});
