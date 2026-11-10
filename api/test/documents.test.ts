import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { TEST_DB_URL, FAKE_JOB, FAKE_RESUME, fixtures, form, samples, startTestApp } from "./helpers.js";
import { LlmUnavailableError } from "../src/llm/types.js";

describe.skipIf(!TEST_DB_URL)("documents API (integration)", () => {
  let t: Awaited<ReturnType<typeof startTestApp>>;
  beforeAll(async () => { t = await startTestApp({ MAX_UPLOAD_BYTES: "200000" }); });
  afterAll(() => t.close());
  beforeEach(() => t.reset());

  const post = (path: string, body: BodyInit, headers?: Record<string, string>) =>
    fetch(`${t.base}${path}`, { method: "POST", body, headers });

  it("uploads a DOCX resume and extracts its text in the background", async () => {
    const res = await post("/resumes", form({ name: "cv.docx", data: readFileSync(samples("resume-priya-nair.docx")) }));
    expect(res.status).toBe(202);
    const { id } = await res.json();
    await t.queue.drain();
    const got = await (await fetch(`${t.base}/resumes/${id}`)).json();
    expect(got.status).toBe("ready");
    expect(got.text).toContain("Backend Engineer");
  });

  it("uploads a PDF resume", async () => {
    const { id } = await (await post("/resumes", form({ name: "cv.pdf", data: readFileSync(samples("resume-priya-nair.pdf")) }))).json();
    await t.queue.drain();
    expect((await (await fetch(`${t.base}/resumes/${id}`)).json()).status).toBe("ready");
  });

  it("marks a scanned PDF as failed with an actionable message", async () => {
    const { id } = await (await post("/resumes", form({ name: "scan.pdf", data: readFileSync(fixtures("scanned.pdf")) }))).json();
    await t.queue.drain();
    const got = await (await fetch(`${t.base}/resumes/${id}`)).json();
    expect(got.status).toBe("failed");
    expect(got.error).toMatch(/No readable text/);
  });

  it("rejects a file whose content does not match its extension", async () => {
    const res = await post("/resumes", form({ name: "evil.pdf", data: "<script>alert(1)</script>" }));
    expect(res.status).toBe(415);
    expect((await res.json()).error.code).toBe("FILE_CONTENT_MISMATCH");
  });

  it("rejects files over the size limit", async () => {
    const res = await post("/resumes", form({ name: "big.txt", data: "a".repeat(300_000) }));
    expect(res.status).toBe(413);
  });

  it("rejects a request without a file", async () => {
    const res = await post("/resumes", new FormData());
    expect(res.status).toBe(400);
  });

  it("accepts pasted job text and numbers jobs per user", async () => {
    const text = readFileSync(samples("job1-senior-backend-engineer.txt"), "utf8");
    const j1 = await (await post("/jobs", JSON.stringify({ text, title: "Senior Backend Engineer" }), { "content-type": "application/json" })).json();
    const j2 = await (await post("/jobs", form({ name: "jd.txt", data: readFileSync(samples("job2-full-stack-engineer.txt")) }))).json();
    expect([j1.label, j2.label]).toEqual(["Job #1", "Job #2"]);
    await t.queue.drain();
    const list = (await (await fetch(`${t.base}/jobs`)).json()).jobs;
    expect(list.map((j: { status: string }) => j.status)).toEqual(["ready", "ready"]);
  });

  it("validates pasted job text", async () => {
    const res = await post("/jobs", JSON.stringify({ text: "too short" }), { "content-type": "application/json" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("isolates data between users", async () => {
    await t.pool.query("INSERT INTO users (id, email, display_name) VALUES ('00000000-0000-0000-0000-000000000002','other@x.test','Other') ON CONFLICT DO NOTHING");
    const other = await t.repo.createResume("00000000-0000-0000-0000-000000000002", { filename: "o.txt", mime: "text/plain", storagePath: null, sha256: null, rawText: "secret resume text of another user" });
    expect((await (await fetch(`${t.base}/resumes`)).json()).resumes).toHaveLength(0);
    expect((await fetch(`${t.base}/resumes/${other.resumeId}`)).status).toBe(404);
    expect((await fetch(`${t.base}/resumes/${other.resumeId}`, { method: "DELETE" })).status).toBe(404);
    expect(await t.repo.getResume("00000000-0000-0000-0000-000000000002", other.resumeId)).not.toBeNull();
  });

  it("deletes the record and the stored file", async () => {
    const { id } = await (await post("/resumes", form({ name: "cv.docx", data: readFileSync(samples("resume-priya-nair.docx")) }))).json();
    expect(await readdir(t.storageDir)).toHaveLength(1);
    expect((await fetch(`${t.base}/resumes/${id}`, { method: "DELETE" })).status).toBe(204);
    expect(await readdir(t.storageDir)).toHaveLength(0);
    expect((await fetch(`${t.base}/resumes/${id}`)).status).toBe(404);
  });

  it("returns 400 for a malformed id", async () => {
    expect((await fetch(`${t.base}/resumes/not-a-uuid`)).status).toBe(400);
  });

  describe("structured parsing", () => {
    const upload = async () => {
      const { id } = await (await post("/resumes", form({ name: "cv.docx", data: readFileSync(samples("resume-priya-nair.docx")) }))).json();
      await t.queue.drain();
      return id as string;
    };
    const getResume = async (id: string) => (await fetch(`${t.base}/resumes/${id}`)).json();
    const patch = (path: string, body: unknown) =>
      fetch(`${t.base}${path}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    it("stores parsed resume data and computes years from dates", async () => {
      const got = await getResume(await upload());
      expect(got.status).toBe("ready");
      expect(got.parsed.skills).toEqual(["TypeScript", "Node.js", "PostgreSQL"]);
      expect(got.yearsExperience).toBeGreaterThanOrEqual(5);
      expect(got.userEdited).toBe(false);
    });

    it("stores parsed job data; typed title wins over the extracted one", async () => {
      await post("/jobs", JSON.stringify({ text: readFileSync(samples("job1-senior-backend-engineer.txt"), "utf8"), title: "My title" }), { "content-type": "application/json" });
      await t.queue.drain();
      const [job] = (await (await fetch(`${t.base}/jobs`)).json()).jobs;
      expect(job.title).toBe("My title");
      expect(job.company).toBe(FAKE_JOB.company);
      expect(job.parsed.requiredSkills).toEqual(["TypeScript", "Kafka"]);
    });

    it("marks the document failed with a retry hint when the model keeps returning bad data", async () => {
      t.llm!.responses = ["nope", "still nope"];
      const got = await getResume(await upload());
      expect(got.status).toBe("failed");
      expect(got.error).toMatch(/could not be validated.*Reparse/);
    });

    it("reports an unreachable AI service and lets the user reparse", async () => {
      t.llm!.responses = [new LlmUnavailableError("down")];
      const id = await upload();
      expect((await getResume(id)).error).toMatch(/busy or unreachable/);
      expect((await fetch(`${t.base}/resumes/${id}/reparse`, { method: "POST" })).status).toBe(202);
      await t.queue.drain();
      expect((await getResume(id)).status).toBe("ready");
    });

    it("saves user edits, recomputes years and flags the record as edited", async () => {
      const id = await upload();
      const edited = { ...FAKE_RESUME, skills: ["Rust"], experience: [{ title: "Dev", company: "X", start: "2024-11", end: "present", bullets: [] }] };
      const res = await patch(`/resumes/${id}`, { parsed: edited });
      expect(res.status).toBe(200);
      const got = await getResume(id);
      expect(got.parsed.skills).toEqual(["Rust"]);
      expect(got.userEdited).toBe(true);
      expect(got.yearsExperience).toBeGreaterThan(1);
    });

    it("rejects invalid edits", async () => {
      const id = await upload();
      expect((await patch(`/resumes/${id}`, { parsed: { skills: "not a list" } })).status).toBe(400);
    });

    it("edits a job and cannot edit another user's records", async () => {
      await post("/jobs", JSON.stringify({ text: readFileSync(samples("job1-senior-backend-engineer.txt"), "utf8") }), { "content-type": "application/json" });
      await t.queue.drain();
      const [job] = (await (await fetch(`${t.base}/jobs`)).json()).jobs;
      const res = await patch(`/jobs/${job.id}`, { title: "Edited", company: null, parsed: { ...FAKE_JOB, requiredSkills: ["Go"] } });
      expect(res.status).toBe(200);
      expect((await res.json()).parsed.requiredSkills).toEqual(["Go"]);

      await t.pool.query("INSERT INTO users (id, email, display_name) VALUES ('00000000-0000-0000-0000-000000000002','other@x.test','Other') ON CONFLICT DO NOTHING");
      const other = await t.repo.createResume("00000000-0000-0000-0000-000000000002", { filename: null, mime: null, storagePath: null, sha256: null, rawText: "x".repeat(60) });
      expect((await patch(`/resumes/${other.resumeId}`, { parsed: FAKE_RESUME })).status).toBe(404);
      expect((await fetch(`${t.base}/resumes/${other.resumeId}/reparse`, { method: "POST" })).status).toBe(404);
    });
  });

  it("fails clearly when no LLM is configured", async () => {
    const bare = await startTestApp({}, null);
    try {
      const { id } = await (await fetch(`${bare.base}/resumes`, { method: "POST", body: form({ name: "cv.docx", data: readFileSync(samples("resume-priya-nair.docx")) }) })).json();
      await bare.queue.drain();
      const got = await (await fetch(`${bare.base}/resumes/${id}`)).json();
      expect(got.status).toBe("failed");
      expect(got.error).toMatch(/GROQ_API_KEY/);
    } finally {
      await bare.reset();
      await bare.close();
    }
  });
});
