import { Router } from "express";
import type pg from "pg";
import type { DocumentRepo } from "../documents/repo.js";
import type { FileStorage } from "../documents/storage.js";
import type { JobQueue } from "../queue/jobQueue.js";
import { clearUserData, seedDemoData } from "../settings/seed.js";

export function settingsRoutes(pool: pg.Pool, docs: DocumentRepo, storage: FileStorage, queue: JobQueue): Router {
  const router = Router();

  /** Replaces the current user's data with the sample resume and jobs. They are processed in the background like uploads. */
  router.post("/settings/seed-demo-data", async (req, res) => {
    res.status(202).json(await seedDemoData(pool, docs, storage, queue, req.userId));
  });

  router.delete("/settings/data", async (req, res) => {
    await clearUserData(pool, docs, storage, req.userId);
    res.status(204).end();
  });

  return router;
}
