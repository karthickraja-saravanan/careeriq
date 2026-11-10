import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { buildApp } from "../src/app.js";
import { createPool } from "../src/db/pool.js";
import { runMigrations } from "../src/db/migrate.js";
import { loadEnv } from "../src/config/env.js";
import path from "node:path";
import { FileStorage } from "../src/documents/storage.js";
import { InlineQueue } from "../src/queue/jobQueue.js";

// Integration test: needs a Postgres with pgvector at TEST_DATABASE_URL.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("health endpoints (integration)", () => {
  const pool = createPool(url ?? "postgres://x");
  let server: Server;
  let base: string;

  beforeAll(async () => {
    await runMigrations(pool, path.resolve(__dirname, "../migrations"));
    const app = buildApp({ env: loadEnv({ DATABASE_URL: url!, LOG_LEVEL: "silent" }), pool, storage: new FileStorage("/tmp/careeriq-test"), queue: new InlineQueue({}) });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  });
  afterAll(async () => {
    server?.close();
    await pool.end();
  });

  it("GET /health is ok", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("GET /ready confirms DB and pgvector", async () => {
    const res = await fetch(`${base}/ready`);
    expect(res.status).toBe(200);
  });

  it("unknown routes return the standard error shape", async () => {
    const res = await fetch(`${base}/nope`);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });

  it("migrations are idempotent and seed the demo user", async () => {
    expect(await runMigrations(pool, path.resolve(__dirname, "../migrations"))).toEqual([]);
    const { rows } = await pool.query("SELECT email FROM users");
    expect(rows[0].email).toBe("demo@careeriq.local");
  });
});
