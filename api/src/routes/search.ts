import { Router } from "express";
import type pg from "pg";
import { z } from "zod";
import type { Embedder } from "../embeddings/types.js";
import { retrieveBalanced } from "../retrieval/search.js";

const query = z.object({
  q: z.string().trim().min(2).max(500),
  job: z.string().uuid().optional(),
});

/** Debug and transparency endpoint: shows exactly which chunks retrieval returns for a question. */
export function searchRoutes(pool: pg.Pool, embedder: Embedder): Router {
  const router = Router();
  router.get("/search", async (req, res) => {
    const { q, job } = query.parse(req.query);
    const hits = await retrieveBalanced(pool, embedder, req.userId, q, job ? { jobIds: [job] } : {});
    res.json({ query: q, hits });
  });
  return router;
}
