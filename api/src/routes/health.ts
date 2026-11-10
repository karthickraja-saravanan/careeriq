import { Router } from "express";
import type pg from "pg";

export function healthRouter(pool: pg.Pool): Router {
  const router = Router();

  // Liveness: the process is up.
  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Readiness: dependencies (DB + pgvector) are usable.
  router.get("/ready", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      const { rows } = await pool.query("SELECT 1 FROM pg_extension WHERE extname = 'vector'");
      if (rows.length === 0) throw new Error("pgvector extension missing");
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ error: { code: "NOT_READY", message: "Database not ready" } });
    }
  });

  return router;
}
