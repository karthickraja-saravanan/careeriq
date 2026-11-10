import { loadEnv } from "./config/env.js";
import { createPool } from "./db/pool.js";
import { buildApp } from "./app.js";

const env = loadEnv();
const pool = createPool(env.DATABASE_URL);
const app = await buildApp({ env, pool });

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

await app.listen({ port: env.PORT, host: "0.0.0.0" });
