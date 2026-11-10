import type { FastifyPluginAsync } from "fastify";
import type pg from "pg";

export const healthRoutes =
  (pool: pg.Pool): FastifyPluginAsync =>
  async (app) => {
    // Liveness: the process is up.
    app.get("/health", async () => ({ status: "ok" }));

    // Readiness: dependencies (DB + pgvector) are usable.
    app.get("/ready", async (_req, reply) => {
      try {
        await pool.query("SELECT 1");
        const { rows } = await pool.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'");
        if (rows.length === 0) throw new Error("pgvector extension missing");
        return { status: "ready" };
      } catch {
        return reply.status(503).send({ error: { code: "NOT_READY", message: "Database not ready" } });
      }
    });
  };
