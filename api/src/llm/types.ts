export type ModelTier = "main" | "fast";

/** Who the call is for and why. Used only to attribute token usage. */
export interface LlmCallMeta {
  userId?: string;
  purpose: string;
}

export interface JsonCompletionRequest {
  tier: ModelTier;
  meta?: LlmCallMeta;
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
  meta?: LlmCallMeta;
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

/** One finished LLM call, as reported by the client. */
export interface LlmUsageRecord {
  userId?: string;
  purpose: string;
  model: string;
  tier: ModelTier;
  promptTokens: number;
  completionTokens: number;
  /** True when the provider did not report token counts and they are approximated from text length. */
  estimated: boolean;
  latencyMs: number;
  status: "ok" | "error" | "cancelled";
  error?: string;
}

export type UsageRecorder = (record: LlmUsageRecord) => void;

export class LlmUnavailableError extends Error {}
