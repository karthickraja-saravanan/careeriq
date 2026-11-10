export type ModelTier = "main" | "fast";

export interface JsonCompletionRequest {
  tier: ModelTier;
  system: string;
  user: string;
  /** Extra conversation turns, used to feed validation errors back to the model for one repair attempt. */
  history?: { role: "assistant" | "user"; content: string }[];
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamRequest {
  tier: ModelTier;
  messages: ChatMessage[];
  /** Aborts generation, e.g. when the browser disconnects. */
  signal?: AbortSignal;
}

/** Everything the app needs from an LLM. Implementations: OpenAI-compatible (Groq, Ollama) and test fakes. */
export interface LlmClient {
  /** Returns the model's raw JSON text. The caller validates it. */
  completeJson(req: JsonCompletionRequest): Promise<string>;
  /** Streams a plain-text answer as it is generated. */
  streamChat(req: StreamRequest): AsyncIterable<string>;
}

export class LlmUnavailableError extends Error {}
