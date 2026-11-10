import { loadEnv } from "./config/env.js";
import { createPool } from "./db/pool.js";
import { buildApp } from "./app.js";
import { DocumentRepo } from "./documents/repo.js";
import { FileStorage } from "./documents/storage.js";
import { createEmbedHandler, createExtractHandler, createParseHandler } from "./documents/processor.js";
import { createTransformersEmbedder } from "./embeddings/transformersEmbedder.js";
import { EMBED_QUEUE, EXTRACT_QUEUE, PARSE_QUEUE, startPgBossQueue, type JobQueue } from "./queue/jobQueue.js";
import { createLlmClient } from "./llm/factory.js";

const env = loadEnv();
const pool = createPool(env.DATABASE_URL);
const storage = new FileStorage(env.STORAGE_DIR);
const repo = new DocumentRepo(pool);
const llm = createLlmClient(env);
const embedder = createTransformersEmbedder(env.EMBEDDING_CACHE_DIR);
if (!llm) console.warn("LLM not configured (set GROQ_API_KEY): documents will be extracted but not parsed.");

// The extract handler needs the queue to hand work to the parse step, and the queue needs the handlers.
let queue!: JobQueue;
queue = await startPgBossQueue(env.DATABASE_URL, {
  [EXTRACT_QUEUE]: createExtractHandler(repo, storage, (documentId) => queue.enqueue(PARSE_QUEUE, { documentId })),
  [PARSE_QUEUE]: createParseHandler(repo, llm, (documentId) => queue.enqueue(EMBED_QUEUE, { documentId })),
  [EMBED_QUEUE]: createEmbedHandler(repo, embedder),
});

const server = buildApp({ env, pool, storage, queue, embedder }).listen(env.PORT, "0.0.0.0", () => {
  console.log(`API listening on :${env.PORT}`);
});

const shutdown = () => {
  server.close(async () => {
    await queue.stop();
    await pool.end();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
