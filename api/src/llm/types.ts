export type ModelTier = "main" | "fast";

export interface JsonCompletionRequest {
  tier: ModelTier;
  system: string;
  user: string;
  /** Extra conversation turns, used to feed validation errors back to the model for one repair attempt. */
  history?: { role: "assistant" | "user"; content: string }[];
}

/** Everything the app needs from an LLM. Implementations: OpenAI-compatible (Groq, Ollama) and test fakes. */
export interface LlmClient {
  /** Returns the model's raw JSON text. The caller validates it. */
  completeJson(req: JsonCompletionRequest): Promise<string>;
}

export class LlmUnavailableError extends Error {}
