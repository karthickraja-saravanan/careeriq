import { describe, expect, it } from "vitest";
import { createOpenAiCompatibleClient } from "../src/llm/openaiCompatible.js";
import { LlmUnavailableError } from "../src/llm/types.js";

const ok = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const req = { tier: "main" as const, system: "s", user: "u" };

function client(responses: (Response | Error)[]) {
  const sent: { url: string; body: any; headers: Record<string, string> }[] = [];
  const sleeps: number[] = [];
  const c = createOpenAiCompatibleClient({
    baseUrl: "https://llm.test/v1", apiKey: "k", models: { main: "big", fast: "small" },
    fetchImpl: (async (url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(init.body as string), headers: init.headers as Record<string, string> });
      const next = responses.shift()!;
      if (next instanceof Error) throw next;
      return next;
    }) as unknown as typeof fetch,
    sleep: async (ms) => { sleeps.push(ms); },
  });
  return { c, sent, sleeps };
}

describe("OpenAI-compatible client", () => {
  it("sends JSON mode, temperature 0, the right model and auth header", async () => {
    const { c, sent } = client([ok("{}")]);
    expect(await c.completeJson(req)).toBe("{}");
    expect(sent[0]!.url).toBe("https://llm.test/v1/chat/completions");
    expect(sent[0]!.body).toMatchObject({ model: "big", temperature: 0, response_format: { type: "json_object" } });
    expect(sent[0]!.headers.authorization).toBe("Bearer k");
  });
  it("uses the fast model for the fast tier", async () => {
    const { c, sent } = client([ok("{}")]);
    await c.completeJson({ ...req, tier: "fast" });
    expect(sent[0]!.body.model).toBe("small");
  });
  it("retries 429 and honours Retry-After", async () => {
    const { c, sleeps } = client([new Response("", { status: 429, headers: { "retry-after": "2" } }), ok("{}")]);
    await c.completeJson(req);
    expect(sleeps).toEqual([2000]);
  });
  it("retries network errors with backoff, then gives up", async () => {
    const { c, sent } = client([new Error("boom"), new Error("boom"), new Error("boom"), new Error("boom")]);
    await expect(c.completeJson(req)).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(sent).toHaveLength(4);
  });
  it("does not retry client errors such as a bad API key", async () => {
    const { c, sent } = client([new Response("", { status: 401 })]);
    await expect(c.completeJson(req)).rejects.toThrow(/401/);
    expect(sent).toHaveLength(1);
  });
  it("fails on an empty completion", async () => {
    const { c } = client([new Response(JSON.stringify({ choices: [] }), { status: 200 })]);
    await expect(c.completeJson(req)).rejects.toThrow(/empty/);
  });

  describe("streamChat", () => {
    const sse = (...chunks: string[]) =>
      new Response(chunks.map((c) => `data: ${JSON.stringify({ choices: [{ delta: { content: c } }] })}\n\n`).join("") + "data: [DONE]\n\n", { status: 200 });
    const collect = async (it: AsyncIterable<string>) => { let out = ""; for await (const p of it) out += p; return out; };
    const msgs = [{ role: "user" as const, content: "hi" }];

    it("yields content deltas and requests streaming", async () => {
      const { c, sent } = client([sse("Hel", "lo ", "[R1]")]);
      expect(await collect(c.streamChat({ tier: "main", messages: msgs }))).toBe("Hello [R1]");
      expect(sent[0]!.body).toMatchObject({ stream: true, model: "big" });
    });
    it("retries a 429 before streaming starts", async () => {
      const { c, sleeps } = client([new Response("", { status: 429 }), sse("ok")]);
      expect(await collect(c.streamChat({ tier: "main", messages: msgs }))).toBe("ok");
      expect(sleeps).toHaveLength(1);
    });
    it("reports an unreachable provider as LlmUnavailableError", async () => {
      const { c } = client([new Error("net"), new Error("net"), new Error("net"), new Error("net")]);
      await expect(collect(c.streamChat({ tier: "main", messages: msgs }))).rejects.toBeInstanceOf(LlmUnavailableError);
    });
  });
});
