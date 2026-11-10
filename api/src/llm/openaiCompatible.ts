import { LlmUnavailableError, type JsonCompletionRequest, type LlmClient, type LlmUsageRecord, type StreamRequest, type UsageRecorder } from "./types.js";

export interface OpenAiCompatibleOptions {
  baseUrl: string;
  apiKey?: string;
  models: { main: string; fast: string };
  timeoutMs?: number;
  maxAttempts?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Called once per finished call (success, failure or cancel). Must not throw; errors are swallowed. */
  onUsage?: UsageRecorder;
}

interface ProviderUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

const approxTokens = (text: string) => Math.ceil(text.length / 4);

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

  function report(base: Omit<LlmUsageRecord, "promptTokens" | "completionTokens" | "estimated">, usage: ProviderUsage | undefined, fallback: { prompt: string; completion: string }) {
    if (!opts.onUsage) return;
    const reported = typeof usage?.prompt_tokens === "number" && typeof usage?.completion_tokens === "number";
    try {
      opts.onUsage({
        ...base,
        promptTokens: reported ? usage!.prompt_tokens! : approxTokens(fallback.prompt),
        completionTokens: reported ? usage!.completion_tokens! : approxTokens(fallback.completion),
        estimated: !reported,
      });
    } catch {
      /* usage tracking must never break a request */
    }
  }

  return {
    async completeJson(req: JsonCompletionRequest) {
      const model = opts.models[req.tier];
      const started = Date.now();
      const messages = [{ role: "system", content: req.system }, { role: "user", content: req.user }, ...(req.history ?? [])];
      const base = { userId: req.meta?.userId, purpose: req.meta?.purpose ?? "unknown", model, tier: req.tier };
      const promptText = messages.map((m) => m.content).join("\n");
      let content: string | undefined;
      let usage: ProviderUsage | undefined;
      try {
        const res = await send({ model, temperature: 0, response_format: { type: "json_object" }, messages }, AbortSignal.timeout(opts.timeoutMs ?? 60_000));
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: ProviderUsage };
        content = json.choices?.[0]?.message?.content;
        usage = json.usage;
        if (!content) throw new LlmUnavailableError("LLM returned an empty response");
      } catch (err) {
        report({ ...base, latencyMs: Date.now() - started, status: "error", error: (err as Error).message.slice(0, 300) }, usage, { prompt: promptText, completion: "" });
        throw err;
      }
      report({ ...base, latencyMs: Date.now() - started, status: "ok" }, usage, { prompt: promptText, completion: content });
      return content;
    },

    async *streamChat(req: StreamRequest) {
      const model = opts.models[req.tier];
      const started = Date.now();
      const base = { userId: req.meta?.userId, purpose: req.meta?.purpose ?? "unknown", model, tier: req.tier };
      const promptText = req.messages.map((m) => m.content).join("\n");
      let answer = "";
      let usage: ProviderUsage | undefined;
      let status: LlmUsageRecord["status"] = "cancelled"; // stays so if the consumer stops reading early
      let error: string | undefined;
      try {
        const signals = [AbortSignal.timeout((opts.timeoutMs ?? 60_000) * 2), ...(req.signal ? [req.signal] : [])];
        const res = await send({ model, temperature: 0.2, stream: true, stream_options: { include_usage: true }, messages: req.messages }, AbortSignal.any(signals));
        if (!res.body) throw new LlmUnavailableError("LLM returned no stream");

        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;
        for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
          buffer += decoder.decode(chunk, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(data) as { choices?: { delta?: { content?: string } }[]; usage?: ProviderUsage; x_groq?: { usage?: ProviderUsage } };
              usage = parsed.usage ?? parsed.x_groq?.usage ?? usage;
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                answer += delta;
                yield delta;
              }
            } catch {
              /* ignore keep-alive or partial lines */
            }
          }
          if (done) break;
        }
        status = "ok";
      } catch (err) {
        status = req.signal?.aborted ? "cancelled" : "error";
        error = (err as Error).message.slice(0, 300);
        throw err;
      } finally {
        report({ ...base, latencyMs: Date.now() - started, status, ...(error ? { error } : {}) }, usage, { prompt: promptText, completion: answer });
      }
    },
  };
}
