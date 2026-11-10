import type { Env } from "../config/env.js";
import { createOpenAiCompatibleClient } from "./openaiCompatible.js";
import type { LlmClient } from "./types.js";

/** Returns undefined when the provider is not configured, so the app still runs without AI features. */
export function createLlmClient(env: Env): LlmClient | undefined {
  const models = { main: env.LLM_MODEL_MAIN, fast: env.LLM_MODEL_FAST };
  if (env.LLM_PROVIDER === "ollama") {
    return createOpenAiCompatibleClient({ baseUrl: env.OLLAMA_BASE_URL, models });
  }
  if (!env.GROQ_API_KEY) return undefined;
  return createOpenAiCompatibleClient({ baseUrl: "https://api.groq.com/openai/v1", apiKey: env.GROQ_API_KEY, models });
}
