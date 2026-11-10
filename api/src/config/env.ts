import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  STORAGE_DIR: z.string().default("./storage"),
  LLM_PROVIDER: z.enum(["groq", "ollama"]).default("groq"),
  GROQ_API_KEY: z.string().optional().transform((v) => v || undefined),
  LLM_MODEL_MAIN: z.string().default("llama-3.3-70b-versatile"),
  LLM_MODEL_FAST: z.string().default("llama-3.1-8b-instant"),
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434/v1"),
  EMBEDDING_CACHE_DIR: z.string().default("./.models"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
});

export type Env = z.infer<typeof schema>;

/** Validate environment once at startup so misconfiguration fails fast with a clear message. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}
