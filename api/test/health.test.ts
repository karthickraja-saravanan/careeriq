import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { createPool } from "../src/db/pool.js";
import { runMigrations } from "../src/db/migrate.js";
import { loadEnv } from "../src/config/env.js";
import path from "node:path";

// Integration test: needs a Postgres with pgvector at TEST_DATABASE_URL.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("health endpoints (integration)", () => {
  const pool = createPool(url ?? "postgres://x");
  let app: FastifyInstance;

  beforeAll(async () => {
    await runMigrations(pool, path.resolve(__dirname, "../migrations"));
    app = await buildApp({ env: loadEnv({ DATABASE_URL: url!, LOG_LEVEL: "silent" }), pool });
  });
  afterAll(async () => {
    await app?.close();
    await pool.end();
  });

  it("GET /health is ok", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("GET /ready confirms DB and pgvector", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/ready" });
    expect(res.statusCode).toBe(200);
  });

  it("unknown routes return the standard error shape", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });

  it("migrations are idempotent and seed the demo user", async () => {
    expect(await runMigrations(pool, path.resolve(__dirname, "../migrations"))).toEqual([]);
    const { rows } = await pool.query("SELECT email FROM users");
    expect(rows[0].email).toBe("demo@careeriq.local");
  });
});
