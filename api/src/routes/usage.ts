import { Router } from "express";
import type { UsageRepo } from "../llm/usage.js";

export function usageRoutes(repo: UsageRepo): Router {
  const router = Router();
  router.get("/usage", async (req, res) => {
    res.json(await repo.summary(req.userId));
  });
  return router;
}
