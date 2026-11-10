import { Router } from "express";
import { z } from "zod";
import type { AnalysisService } from "../analysis/analyze.js";

const body = z.object({ jobId: z.string().uuid() });

export function analysisRoutes(service: AnalysisService): Router {
  const router = Router();

  router.post("/analyses", async (req, res) => {
    const { jobId } = body.parse(req.body);
    res.json(await service.analyze(req.userId, jobId));
  });

  router.get("/analyses", async (req, res) => {
    res.json({ analyses: await service.list(req.userId) });
  });

  return router;
}
