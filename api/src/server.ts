import { loadEnv } from "./config/env.js";
import { createPool } from "./db/pool.js";
import { buildApp } from "./app.js";
import { DocumentRepo } from "./documents/repo.js";
import { FileStorage } from "./documents/storage.js";
import { createExtractHandler } from "./documents/processor.js";
import { EXTRACT_QUEUE, startPgBossQueue } from "./queue/jobQueue.js";

const env = loadEnv();
const pool = createPool(env.DATABASE_URL);
const storage = new FileStorage(env.STORAGE_DIR);
const queue = await startPgBossQueue(env.DATABASE_URL, {
  [EXTRACT_QUEUE]: createExtractHandler(new DocumentRepo(pool), storage),
});

const server = buildApp({ env, pool, storage, queue }).listen(env.PORT, "0.0.0.0", () => {
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
