import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TEST_DB_URL, form, samples, startTestApp } from "./helpers.js";
import { LlmUnavailableError } from "../src/llm/types.js";

interface Sse { event: string; data: any }
async function readSse(res: Response): Promise<Sse[]> {
  const text = await res.text();
  return text.split("\n\n").filter(Boolean).map((block) => {
    const event = /^event: (.*)$/m.exec(block)![1]!;
    return { event, data: JSON.parse(/^data: (.*)$/m.exec(block)![1]!) };
  });
}

describe.skipIf(!TEST_DB_URL)("chat (integration)", () => {
  let t: Awaited<ReturnType<typeof startTestApp>>;
  beforeAll(async () => { t = await startTestApp(); });
  afterAll(() => t.close());
  beforeEach(async () => { await t.reset(); t.llm!.responses = []; t.llm!.calls = []; t.llm!.streams = []; t.llm!.streamCalls = []; });

  const json = { "content-type": "application/json" };
  const seedDocs = async () => {
    await fetch(`${t.base}/resumes`, { method: "POST", body: form({ name: "cv.docx", data: readFileSync(samples("resume-priya-nair.docx")) }) });
    await t.queue.drain();
    await fetch(`${t.base}/jobs`, { method: "POST", headers: json, body: JSON.stringify({ text: readFileSync(samples("job1-senior-backend-engineer.txt"), "utf8") }) });
    await t.queue.drain();
  };
  const newConversation = async () => (await (await fetch(`${t.base}/conversations`, { method: "POST" })).json()).id as string;
  const ask = (id: string, content: string) => fetch(`${t.base}/conversations/${id}/messages`, { method: "POST", headers: json, body: JSON.stringify({ content }) });

  it("streams tokens, then a final answer with only valid citations", async () => {
    await seedDocs();
    const id = await newConversation();
    t.llm!.streams = ["You know TypeScript [R2]. Kafka is not mentioned [R99]."];
    const res = await ask(id, "Which skills do I have?");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const events = await readSse(res);

    expect(events[0]!.event).toBe("meta");
    const tokens = events.filter((e) => e.event === "token");
    expect(tokens.length).toBeGreaterThan(1);
    const done = events.at(-1)!;
    expect(done.event).toBe("done");
    expect(done.data.content).toBe("You know TypeScript [R2]. Kafka is not mentioned.");
    expect(done.data.grounded).toBe(true);
    expect(done.data.citations.map((c: { cite: string }) => c.cite)).toEqual(["R2"]);
    expect(done.data.citations[0].content).toContain("TypeScript");
    expect(done.data.latencyMs.total).toBeGreaterThanOrEqual(0);

    // The model saw labelled context, rules in the system prompt, and the question.
    const call = t.llm!.streamCalls[0]!;
    expect(call.messages[0]!.content).toMatch(/Answer only from the CONTEXT/);
    expect(call.messages.at(-1)!.content).toContain("<context>");
    expect(call.messages.at(-1)!.content).toContain("[R2]");
    expect(call.tier).toBe("main");

    const history = await (await fetch(`${t.base}/conversations/${id}/messages`)).json();
    expect(history.messages.map((m: { role: string }) => m.role)).toEqual(["user", "assistant"]);
    expect(history.messages[1].content).toBe(done.data.content);
    const conv = (await (await fetch(`${t.base}/conversations`)).json()).conversations;
    expect(conv[0].title).toBe("Which skills do I have?");
  });

  describe("resume mentions", () => {
    const uploadResume = async () => {
      await fetch(`${t.base}/resumes`, { method: "POST", body: form({ name: "cv.docx", data: readFileSync(samples("resume-priya-nair.docx")) }) });
      await t.queue.drain();
    };
    const labels = async () => ((await (await fetch(`${t.base}/resumes`)).json()).resumes as { label: string; id: string }[]);

    it("numbers resumes CV1, CV2 and never reuses a number that is still taken", async () => {
      await uploadResume(); await uploadResume();
      const first = await labels();
      expect(first.map((r) => r.label).sort()).toEqual(["CV1", "CV2"]);
      await fetch(`${t.base}/resumes/${first.find((r) => r.label === "CV1")!.id}`, { method: "DELETE" });
      await uploadResume();
      expect((await labels()).map((r) => r.label).sort()).toEqual(["CV2", "CV3"]);
    });

    it("searches only the mentioned resume and qualifies citations when several are named", async () => {
      await seedDocs(); await uploadResume();
      const id = await newConversation();

      t.llm!.streams = ["From the first one."];
      const one = await readSse(await ask(id, "@CV1 what are my skills?"));
      expect(one[0]!.data.resumeIds).toHaveLength(1);
      const single = t.llm!.streamCalls.at(-1)!.messages.at(-1)!.content;
      expect(single).toContain("Question: CV1 what are my skills?");
      expect(single).toMatch(/\[R\d+\]/);
      expect(single).not.toMatch(/\[CV\d+-\d+\]/);

      t.llm!.streams = ["Both."];
      const both = await readSse(await ask(id, "Compare @CV1 and @r2 for me"));
      expect(both[0]!.data.resumeIds).toHaveLength(2);
      const multi = t.llm!.streamCalls.at(-1)!.messages.at(-1)!.content;
      expect(multi).toMatch(/\[CV1-\d+\] \(Resume CV1/);
      expect(multi).toMatch(/\[CV2-\d+\] \(Resume CV2/);
      expect(multi).toContain("Question: Compare CV1 and CV2 for me");
    });

    it("keeps valid CV citations in the answer and drops ones that were not retrieved", async () => {
      await seedDocs(); await uploadResume();
      const id = await newConversation();
      t.llm!.streams = ["Strong TypeScript [CV1-2]. Bad ref [CV9-1]."];
      const events = await readSse(await ask(id, "@CV1 @CV2 which is better?"));
      const done = events.at(-1)!;
      expect(done.data.content).toBe("Strong TypeScript [CV1-2]. Bad ref.");
      expect(done.data.citations.map((c: { cite: string }) => c.cite)).toEqual(["CV1-2"]);
    });

    it("rejects a resume that does not exist without storing the message", async () => {
      await seedDocs();
      const id = await newConversation();
      const res = await ask(id, "@CV7 summarise this");
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("UNKNOWN_RESUME");
      expect(t.llm!.streamCalls).toHaveLength(0);
      expect((await (await fetch(`${t.base}/conversations/${id}/messages`)).json()).messages).toEqual([]);
    });

    it("cannot reach another user's resume by label", async () => {
      await seedDocs();
      await t.pool.query("INSERT INTO users (id, email, display_name) VALUES ('00000000-0000-0000-0000-000000000002', 'other@x.test', 'Other') ON CONFLICT DO NOTHING");
      const d = await t.pool.query("INSERT INTO documents (user_id, kind, status, raw_text) VALUES ('00000000-0000-0000-0000-000000000002', 'resume', 'ready', 'secret') RETURNING id");
      await t.pool.query("INSERT INTO resumes (user_id, document_id, label) VALUES ('00000000-0000-0000-0000-000000000002', $1, 'CV2')", [d.rows[0].id]);
      const id = await newConversation();
      const res = await ask(id, "@CV2 show it");
      expect(res.status).toBe(400); // the demo user only has CV1
      await t.pool.query("DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000002'");
    });
  });

  describe("job mentions", () => {
    const addJob = async (file: string) => {
      await fetch(`${t.base}/jobs`, { method: "POST", headers: json, body: JSON.stringify({ text: readFileSync(samples(file), "utf8") }) });
      await t.queue.drain();
    };

    it("restricts retrieval to the mentioned job and normalises the label", async () => {
      await seedDocs();
      await addJob("job2-full-stack-engineer.txt");
      const id = await newConversation();
      t.llm!.streams = ["ok"];
      const events = await readSse(await ask(id, "Am I a fit for @J2?"));
      expect(events[0]!.data.jobIds).toHaveLength(1);
      const prompt = t.llm!.streamCalls.at(-1)!.messages.at(-1)!.content;
      expect(prompt).toContain("Question: Am I a fit for Job #2?");
      expect(prompt).toMatch(/\[J2-\d+\]/);
      expect(prompt).not.toMatch(/\[J1-\d+\]/);
    });

    it("combines resume and job mentions, and rejects an unknown job before storing anything", async () => {
      await seedDocs();
      const id = await newConversation();
      t.llm!.streams = ["ok"];
      const ok = await readSse(await ask(id, "@CV1 vs @J1"));
      expect(ok[0]!.data).toMatchObject({ jobIds: [expect.any(String)], resumeIds: [expect.any(String)] });
      const bad = await ask(id, "tell me about @J9");
      expect(bad.status).toBe(400);
      expect((await bad.json()).error.code).toBe("UNKNOWN_JOB");
    });
  });

  it("answers without calling the model when there are no documents", async () => {
    const id = await newConversation();
    const events = await readSse(await ask(id, "Am I a fit?"));
    expect(events.at(-1)!.data.content).toMatch(/Upload your resume/);
    expect(events.at(-1)!.data.grounded).toBe(false);
    expect(t.llm!.streamCalls).toHaveLength(0);
  });

  it("rewrites follow-up questions using history, and survives a rewrite failure", async () => {
    await seedDocs();
    const id = await newConversation();
    t.llm!.streams = ["First answer [R2]."];
    await readSse(await ask(id, "What are my skills?"));

    t.llm!.responses = [JSON.stringify({ question: "Which of my skills are missing for job #1?" })];
    t.llm!.streams = ["Second answer [R2]."];
    const second = await readSse(await ask(id, "and what's missing?"));
    expect(second[0]!.data.rewritten).toBe("Which of my skills are missing for job #1?");
    expect(t.llm!.calls.at(-1)!.tier).toBe("fast");
    expect(t.llm!.streamCalls.at(-1)!.messages.at(-1)!.content).toContain("Question: Which of my skills are missing for job #1?");
    // earlier turns are passed as real chat turns
    expect(t.llm!.streamCalls.at(-1)!.messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);

    t.llm!.responses = [new LlmUnavailableError("down")];
    t.llm!.streams = ["Third answer."];
    const third = await readSse(await ask(id, "and the salary?"));
    expect(third[0]!.data.rewritten).toBeNull();
    expect(third.at(-1)!.event).toBe("done");
  });

  it("sends an error event when generation fails and stores no assistant message", async () => {
    await seedDocs();
    const id = await newConversation();
    t.llm!.streams = [new LlmUnavailableError("down")];
    const events = await readSse(await ask(id, "Anything?"));
    expect(events.at(-1)).toMatchObject({ event: "error", data: { code: "AI_UNAVAILABLE" } });
    const history = await (await fetch(`${t.base}/conversations/${id}/messages`)).json();
    expect(history.messages.map((m: { role: string }) => m.role)).toEqual(["user"]);
  });

  it("renames a conversation and validates the new title", async () => {
    const id = await newConversation();
    const patch = (body: object, cid = id) => fetch(`${t.base}/conversations/${cid}`, { method: "PATCH", headers: json, body: JSON.stringify(body) });
    const ok = await patch({ title: "  Kafka gap plan  " });
    expect(ok.status).toBe(200);
    expect((await ok.json()).title).toBe("Kafka gap plan");
    expect((await patch({ title: "   " })).status).toBe(400);
    expect((await patch({ title: "x" }, "00000000-0000-0000-0000-0000000000aa")).status).toBe(404);
  });

  it("validates input and unknown conversations", async () => {
    const id = await newConversation();
    expect((await ask(id, "   ")).status).toBe(400);
    expect((await ask(id, "x".repeat(2001))).status).toBe(400);
    expect((await ask("00000000-0000-0000-0000-0000000000aa", "hi")).status).toBe(404);
    expect((await ask("not-a-uuid", "hi")).status).toBe(400);
  });

  it("does not expose another user's conversations", async () => {
    await t.pool.query("INSERT INTO users (id, email, display_name) VALUES ('00000000-0000-0000-0000-000000000002', 'other@x.test', 'Other') ON CONFLICT DO NOTHING");
    const { rows } = await t.pool.query("INSERT INTO conversations (user_id, title) VALUES ('00000000-0000-0000-0000-000000000002', 'secret') RETURNING id");
    const otherId = rows[0].id as string;
    await t.pool.query("INSERT INTO messages (user_id, conversation_id, role, content) VALUES ('00000000-0000-0000-0000-000000000002', $1, 'user', 'private')", [otherId]);

    expect((await (await fetch(`${t.base}/conversations`)).json()).conversations).toEqual([]);
    expect((await fetch(`${t.base}/conversations/${otherId}/messages`)).status).toBe(404);
    expect((await ask(otherId, "hello")).status).toBe(404);
    expect((await fetch(`${t.base}/conversations/${otherId}`, { method: "DELETE" })).status).toBe(404);
    expect((await fetch(`${t.base}/conversations/${otherId}`, { method: "PATCH", headers: json, body: JSON.stringify({ title: "mine now" }) })).status).toBe(404);
    await t.pool.query("DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000002'");
  });

  it("returns 503 when AI is not configured", async () => {
    const t2 = await startTestApp({}, null);
    const id = (await (await fetch(`${t2.base}/conversations`, { method: "POST" })).json()).id;
    const res = await fetch(`${t2.base}/conversations/${id}/messages`, { method: "POST", headers: json, body: JSON.stringify({ content: "hi" }) });
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("AI_NOT_CONFIGURED");
    await t2.close();
  });
});
