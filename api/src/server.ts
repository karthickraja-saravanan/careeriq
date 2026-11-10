import { loadEnv } from "./config/env.js";
import { createPool } from "./db/pool.js";
import { buildApp } from "./app.js";

const env = loadEnv();
const pool = createPool(env.DATABASE_URL);
const server = buildApp({ env, pool }).listen(env.PORT, "0.0.0.0", () => {
  console.log(`API listening on :${env.PORT}`);
});

const shutdown = () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
