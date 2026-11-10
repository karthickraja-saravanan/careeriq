import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { createPool } from "../src/db/pool.js";
import { runMigrations } from "../src/db/migrate.js";
import { FileStorage } from "../src/documents/storage.js";
import { DocumentRepo } from "../src/documents/repo.js";
import { createExtractHandler } from "../src/documents/processor.js";
import { EXTRACT_QUEUE, InlineQueue } from "../src/queue/jobQueue.js";

export const TEST_DB_URL = process.env.TEST_DATABASE_URL;
export const samples = (name: string) => path.resolve(__dirname, "../../samples", name);
export const fixtures = (name: string) => path.resolve(__dirname, "fixtures", name);

export async function startTestApp(overrides: Record<string, string> = {}) {
  const pool = createPool(TEST_DB_URL!);
  await runMigrations(pool, path.resolve(__dirname, "../migrations"));
  const storageDir = await mkdtemp(path.join(tmpdir(), "careeriq-"));
  const storage = new FileStorage(storageDir);
  const repo = new DocumentRepo(pool);
  const queue = new InlineQueue({ [EXTRACT_QUEUE]: createExtractHandler(repo, storage, { error: () => undefined }) });
  const env = loadEnv({ DATABASE_URL: TEST_DB_URL!, LOG_LEVEL: "silent", ...overrides });
  const server: Server = buildApp({ env, pool, storage, queue }).listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  return {
    base, pool, repo, queue, storage, storageDir,
    reset: async () => {
      await pool.query("TRUNCATE documents CASCADE");
      for (const f of await readdir(storageDir)) await rm(path.join(storageDir, f));
    },
    close: async () => { server.close(); await pool.end(); },
  };
}

export function form(file: { name: string; data: Buffer | string; type?: string }, fields: Record<string, string> = {}) {
  const f = new FormData();
  f.append("file", new Blob([new Uint8Array(typeof file.data === "string" ? Buffer.from(file.data) : file.data)], { type: file.type ?? "application/octet-stream" }), file.name);
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}
