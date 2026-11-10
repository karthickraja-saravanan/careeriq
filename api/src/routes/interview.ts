import { Router } from "express";
import { z } from "zod";
import type { InterviewService } from "../interview/service.js";

const body = z.object({ jobId: z.string().uuid(), resumeId: z.string().uuid().optional() });

export function interviewRoutes(service: InterviewService): Router {
  const router = Router();
  router.post("/interview-preps", async (req, res) => {
    const { jobId, resumeId } = body.parse(req.body);
    res.json(await service.generate(req.userId, jobId, resumeId));
  });
  router.get("/interview-preps", async (req, res) => {
    res.json({ preps: await service.list(req.userId) });
  });
  return router;
}
