import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../config/env.js";
import { createPool } from "./pool.js";
import { runMigrations } from "./migrate.js";

export const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");

const env = loadEnv();
const pool = createPool(env.DATABASE_URL);
try {
  const applied = await runMigrations(pool, MIGRATIONS_DIR);
  console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date");
} finally {
  await pool.end();
}
