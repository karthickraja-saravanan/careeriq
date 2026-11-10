import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TEST_DB_URL, FAKE_JOB, FAKE_RESUME, form, samples, startTestApp } from "./helpers.js";
import { LlmUnavailableError } from "../src/llm/types.js";

const judge = (over: object = {}) =>
  JSON.stringify({
    requirements: [
      { id: "r1", verdict: "met", evidence: ["R2"], reason: "TypeScript is listed in skills." },
      { id: "r2", verdict: "met", evidence: ["R3"], reason: "Billing APIs are similar to streaming." }, // Kafka is not mentioned: must be lowered
      { id: "p1", verdict: "met", evidence: ["R9"], reason: "Cloud work." }, // invented citation: must become missing
    ],
    experience: { verdict: "met", evidence: ["R3"], reason: "Five years." },
    strengths: ["Solid TypeScript background [R2]", "Great cloud story [R9]"],
    concerns: ["No Kafka experience is shown."],
    recommendations: ["Build a small Kafka producer and consumer project."],
    ...over,
  });

describe.skipIf(!TEST_DB_URL)("match analysis (integration)", () => {
  let t: Awaited<ReturnType<typeof startTestApp>>;
  beforeAll(async () => { t = await startTestApp(); });
  afterAll(() => t.close());
  beforeEach(async () => { await t.reset(); t.llm!.responses = []; t.llm!.calls = []; });

  const json = { "content-type": "application/json" };
  const upload = async () => {
    const r = await (await fetch(`${t.base}/resumes`, { method: "POST", body: form({ name: "cv.docx", data: readFileSync(samples("resume-priya-nair.docx")) }) })).json();
    await t.queue.drain();
    return r.id as string;
  };
  const addJob = async () => {
    const j = await (await fetch(`${t.base}/jobs`, { method: "POST", headers: json, body: JSON.stringify({ text: readFileSync(samples("job1-senior-backend-engineer.txt"), "utf8") }) })).json();
    await t.queue.drain();
    return j.id as string;
  };
  const analyze = (jobId: string) => fetch(`${t.base}/analyses`, { method: "POST", headers: json, body: JSON.stringify({ jobId }) });

  it("scores by code from evidence-checked verdicts", async () => {
    await upload();
    const jobId = await addJob();
    t.llm!.responses = [judge()];
    const res = await analyze(jobId);
    expect(res.status).toBe(200);
    const { score, report } = await res.json();

    const [kafka] = report.requirements.filter((r: { requirement: string }) => r.requirement === "Kafka");
    expect(kafka.verdict).toBe("partial"); // lowered: cited text never mentions Kafka
    expect(kafka.adjusted).toBeTruthy();
    const aws = report.requirements.find((r: { requirement: string }) => r.requirement === "AWS");
    expect(aws).toMatchObject({ verdict: "missing", evidence: [] }); // invented citation

    // required (1 + 0.5)/2 = 75, experience from dates >= 5 years = 100, preferred 0
    expect(report.components.required.score).toBe(75);
    expect(report.experience).toMatchObject({ source: "dates", score: 100 });
    expect(report.components.preferred.score).toBe(0);
    expect(score).toBe(75);
    expect(report.strengths).toEqual(["Solid TypeScript background [R2]", "Great cloud story"]);
    expect(Object.keys(report.sources).sort()).toEqual(["R2", "R3"]);
    expect(report.sources.R2.content).toContain("TypeScript");
  });

  it("sends the resume as labelled chunks and treats it as data", async () => {
    await upload();
    const jobId = await addJob();
    t.llm!.responses = [judge()];
    await analyze(jobId);
    const call = t.llm!.calls.at(-1)!;
    expect(call.user).toContain("[R2]");
    expect(call.system).toMatch(/Never infer/);
    expect(call.system).toMatch(/Never advise claiming skills/);
  });

  it("treats requirements the model skipped as missing", async () => {
    await upload();
    const jobId = await addJob();
    t.llm!.responses = [judge({ requirements: [{ id: "r1", verdict: "met", evidence: ["R2"], reason: "" }] })];
    const { report } = await (await analyze(jobId)).json();
    const kafka = report.requirements.find((r: { requirement: string }) => r.requirement === "Kafka");
    expect(kafka).toMatchObject({ verdict: "missing", reason: "Not assessed." });
  });

  it("re-analysing updates the single stored result and flags changes as stale", async () => {
    const resumeId = await upload();
    const jobId = await addJob();
    t.llm!.responses = [judge()];
    await analyze(jobId);
    let list = (await (await fetch(`${t.base}/analyses`)).json()).analyses;
    expect(list).toHaveLength(1);
    expect(list[0].stale).toBe(false);

    await fetch(`${t.base}/resumes/${resumeId}`, { method: "PATCH", headers: json, body: JSON.stringify({ parsed: { ...FAKE_RESUME, skills: ["Rust"] } }) });
    await t.queue.drain();
    list = (await (await fetch(`${t.base}/analyses`)).json()).analyses;
    expect(list[0].stale).toBe(true);

    t.llm!.responses = [judge()];
    await analyze(jobId);
    list = (await (await fetch(`${t.base}/analyses`)).json()).analyses;
    expect(list).toHaveLength(1);
    expect(list[0].stale).toBe(false);
  });

  it("asks for a resume first", async () => {
    const jobId = await addJob();
    const res = await analyze(jobId);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("NO_RESUME");
  });

  it("returns a clear error when the model output is unusable", async () => {
    await upload();
    const jobId = await addJob();
    t.llm!.responses = ["nope", "still nope"];
    const res = await analyze(jobId);
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("AI_BAD_OUTPUT");
  });

  it("returns 503 when the AI service is unreachable", async () => {
    await upload();
    const jobId = await addJob();
    t.llm!.responses = [new LlmUnavailableError("down")];
    expect((await analyze(jobId)).status).toBe(503);
  });

  it("reports missing AI configuration", async () => {
    const bare = await startTestApp({}, null);
    try {
      const res = await fetch(`${bare.base}/analyses`, { method: "POST", headers: json, body: JSON.stringify({ jobId: "00000000-0000-4000-8000-000000000000" }) });
      expect(res.status).toBe(503);
      expect((await res.json()).error.code).toBe("AI_NOT_CONFIGURED");
    } finally { await bare.close(); }
  });

  it("validates the request and cannot analyse another user's job", async () => {
    await upload();
    expect((await analyze("not-a-uuid")).status).toBe(400);
    await t.pool.query("INSERT INTO users (id, email, display_name) VALUES ('00000000-0000-0000-0000-000000000002','other@x.test','Other') ON CONFLICT DO NOTHING");
    const other = await t.repo.createJob("00000000-0000-0000-0000-000000000002", { filename: null, mime: null, storagePath: null, sha256: null, rawText: "x".repeat(60) }, {});
    expect((await analyze(other.jobId)).status).toBe(404);
  });
});
