import { LlmUnavailableError, type JsonCompletionRequest, type LlmClient, type StreamRequest } from "./types.js";

export interface OpenAiCompatibleOptions {
  baseUrl: string;
  apiKey?: string;
  models: { main: string; fast: string };
  timeoutMs?: number;
  maxAttempts?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/**
 * Chat-completions client for any OpenAI-compatible server (Groq hosted, Ollama local).
 * Temperature 0 and JSON mode for structured output. Retries rate limits and transient errors
 * with backoff, honouring Retry-After. Streaming retries only until the first byte arrives.
 */
export function createOpenAiCompatibleClient(opts: OpenAiCompatibleOptions): LlmClient {
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const maxAttempts = opts.maxAttempts ?? 4;

  async function send(body: unknown, signal: AbortSignal): Promise<Response> {
    const payload = JSON.stringify(body);
    for (let attempt = 1; ; attempt++) {
      let res: Response;
      try {
        res = await doFetch(`${opts.baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {}) },
          body: payload,
          signal,
        });
      } catch (err) {
        if (signal.aborted && !(signal as AbortSignal & { reason?: unknown }).reason?.toString().includes("Timeout")) throw err;
        if (attempt >= maxAttempts) throw new LlmUnavailableError(`LLM request failed: ${(err as Error).message}`);
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }
      if (res.ok) return res;
      if (!RETRYABLE.has(res.status) || attempt >= maxAttempts) {
        const detail = (await res.text().catch(() => "")).slice(0, 500);
        throw new LlmUnavailableError(`LLM request failed with status ${res.status}${detail ? `: ${detail}` : ""}`);
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 20) * 1000 : 500 * 2 ** (attempt - 1));
    }
  }

  return {
    async completeJson(req: JsonCompletionRequest) {
      const res = await send(
        {
          model: opts.models[req.tier],
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }, ...(req.history ?? [])],
        },
        AbortSignal.timeout(opts.timeoutMs ?? 60_000),
      );
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new LlmUnavailableError("LLM returned an empty response");
      return content;
    },

    async *streamChat(req: StreamRequest) {
      const signals = [AbortSignal.timeout((opts.timeoutMs ?? 60_000) * 2), ...(req.signal ? [req.signal] : [])];
      const res = await send({ model: opts.models[req.tier], temperature: 0.2, stream: true, messages: req.messages }, AbortSignal.any(signals));
      if (!res.body) throw new LlmUnavailableError("LLM returned no stream");

      const decoder = new TextDecoder();
      let buffer = "";
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(chunk, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") return;
          try {
            const delta = (JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            /* ignore keep-alive or partial lines */
          }
        }
      }
    },
  };
}
