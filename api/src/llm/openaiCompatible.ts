import { LlmUnavailableError, type JsonCompletionRequest, type LlmClient } from "./types.js";

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
 * Temperature 0 and JSON mode for deterministic structured output.
 * Retries rate limits and transient errors with backoff, honouring Retry-After.
 */
export function createOpenAiCompatibleClient(opts: OpenAiCompatibleOptions): LlmClient {
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const maxAttempts = opts.maxAttempts ?? 4;

  return {
    async completeJson(req: JsonCompletionRequest) {
      const body = JSON.stringify({
        model: opts.models[req.tier],
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
          ...(req.history ?? []),
        ],
      });

      for (let attempt = 1; ; attempt++) {
        let res: Response;
        try {
          res = await doFetch(`${opts.baseUrl}/chat/completions`, {
            method: "POST",
            headers: { "content-type": "application/json", ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {}) },
            body,
            signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
          });
        } catch (err) {
          if (attempt >= maxAttempts) throw new LlmUnavailableError(`LLM request failed: ${(err as Error).message}`);
          await sleep(500 * 2 ** (attempt - 1));
          continue;
        }

        if (res.ok) {
          const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const content = json.choices?.[0]?.message?.content;
          if (!content) throw new LlmUnavailableError("LLM returned an empty response");
          return content;
        }
        if (!RETRYABLE.has(res.status) || attempt >= maxAttempts) {
          throw new LlmUnavailableError(`LLM request failed with status ${res.status}`);
        }
        const retryAfter = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 20) * 1000 : 500 * 2 ** (attempt - 1));
      }
    },
  };
}
