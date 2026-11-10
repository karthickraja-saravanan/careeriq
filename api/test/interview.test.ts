import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TEST_DB_URL, form, samples, startTestApp } from "./helpers.js";
import { enforceQuestions } from "../src/interview/service.js";
import { LlmUnavailableError } from "../src/llm/types.js";

const chunks = new Map([["R1", { section: "Skills", content: "TypeScript" }], ["R2", { section: "Experience", content: "Built billing APIs" }]]);
const q = (over: object) => ({ question: "Tell me about something?", kind: "experience" as const, why: "", structure: "", basedOn: [], ...over });

describe("enforceQuestions", () => {
  it("drops experience questions with no valid resume evidence", () => {
    const out = enforceQuestions([q({ basedOn: ["R9"] }), q({ question: "Describe the billing APIs?", basedOn: ["r2"] })], chunks);
    expect(out.map((x) => x.question)).toEqual(["Describe the billing APIs?"]);
    expect(out[0]!.basedOn).toEqual(["R2"]);
  });
  it("keeps gap questions without citations and strips invented ones from text", () => {
    const out = enforceQuestions([q({ kind: "gap", question: "How would you learn Kafka?", why: "Required [R7] skill.", basedOn: ["R1"] })], chunks);
    expect(out[0]).toMatchObject({ kind: "gap", basedOn: [] });
    expect(out[0]!.why).not.toContain("R7");
  });
  it("caps the list at 8", () => {
    expect(enforceQuestions(Array.from({ length: 12 }, () => q({ kind: "technical" })), chunks)).toHaveLength(8);
  });
});

describe.skipIf(!TEST_DB_URL)("interview prep (integration)", () => {
  let t: Awaited<ReturnType<typeof startTestApp>>;
  beforeAll(async () => { t = await startTestApp(); });
  afterAll(() => t.close());
  beforeEach(async () => { await t.reset(); t.llm!.responses = []; t.llm!.calls = []; });
  const json = { "content-type": "application/json" };
  const gen = (jobId: string) => fetch(`${t.base}/interview-preps`, { method: "POST", headers: json, body: JSON.stringify({ jobId }) });
  const seed = async () => {
    await fetch(`${t.base}/resumes`, { method: "POST", body: form({ name: "cv.docx", data: readFileSync(samples("resume-priya-nair.docx")) }) });
    await t.queue.drain();
    const j = await (await fetch(`${t.base}/jobs`, { method: "POST", headers: json, body: JSON.stringify({ text: readFileSync(samples("job1-senior-backend-engineer.txt"), "utf8") }) })).json();
    await t.queue.drain();
    return j.id as string;
  };
  const output = JSON.stringify({
    questions: [
      { question: "How did you build the billing APIs?", kind: "experience", why: "Your strongest result.", structure: "Situation, action, result.", basedOn: ["R3"] },
      { question: "You claim leadership at Finlytics?", kind: "experience", why: "x", structure: "y", basedOn: ["R99"] },
      { question: "How would you approach Kafka?", kind: "gap", why: "Required and missing.", structure: "Be honest, then reason from queues.", basedOn: [] },
    ],
  });

  it("stores verified questions with their sources and lists them", async () => {
    const jobId = await seed();
    t.llm!.responses = [output];
    const res = await gen(jobId);
    expect(res.status).toBe(200);
    const { report } = await res.json();
    expect(report.questions.map((x: { question: string }) => x.question)).toEqual(["How did you build the billing APIs?", "How would you approach Kafka?"]);
    expect(Object.keys(report.sources)).toEqual(["R3"]);
    const call = t.llm!.calls.at(-1)!;
    expect(call.user).toContain("<resume_chunks>");
    expect(call.system).toMatch(/Never invent/);

    const list = await (await fetch(`${t.base}/interview-preps`)).json();
    expect(list.preps).toHaveLength(1);
    expect(list.preps[0].stale).toBe(false);
    t.llm!.responses = [output];
    await gen(jobId); // regenerating replaces, not duplicates
    expect((await (await fetch(`${t.base}/interview-preps`)).json()).preps).toHaveLength(1);
  });

  it("reports clear errors", async () => {
    expect((await gen("00000000-0000-0000-0000-0000000000aa")).status).toBe(409); // no resume yet
    const jobId = await seed();
    expect((await gen("00000000-0000-0000-0000-0000000000aa")).status).toBe(404);
    t.llm!.responses = [new LlmUnavailableError("down")];
    expect((await gen(jobId)).status).toBe(503);
    t.llm!.responses = [JSON.stringify({ questions: [{ question: "Only invented evidence?", kind: "experience", why: "", structure: "", basedOn: ["R99"] }] })];
    expect((await gen(jobId)).status).toBe(502);
    expect((await gen("nope")).status).toBe(400);
  });

  it("returns 503 without AI configured", async () => {
    const t2 = await startTestApp({}, null);
    const res = await fetch(`${t2.base}/interview-preps`, { method: "POST", headers: json, body: JSON.stringify({ jobId: "00000000-0000-0000-0000-0000000000aa" }) });
    expect(res.status).toBe(503);
    await t2.close();
  });
});
