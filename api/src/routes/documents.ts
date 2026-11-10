import { Router, type Request } from "express";
import multer from "multer";
import { z } from "zod";
import { createHash } from "node:crypto";
import { HttpError } from "../errors.js";
import { detectFormat, MIME_BY_FORMAT } from "../documents/fileTypes.js";
import type { DocumentRepo, JobSummary, ResumeSummary } from "../documents/repo.js";
import type { FileStorage } from "../documents/storage.js";
import { EXTRACT_QUEUE, PARSE_QUEUE, type JobQueue } from "../queue/jobQueue.js";
import { jobParsedSchema, resumeParsedSchema } from "../parsing/schemas.js";
import { computeYearsOfExperience } from "../parsing/experience.js";

export interface DocumentRouteDeps {
  repo: DocumentRepo;
  storage: FileStorage;
  queue: JobQueue;
  maxUploadBytes: number;
}

const idParam = z.string().uuid();
const pastedJob = z.object({
  text: z.string().trim().min(50, "Paste at least 50 characters of the job description").max(30_000),
  title: z.string().trim().max(200).optional(),
  company: z.string().trim().max(200).optional(),
});

const present = (d: { id: string; kind: string; status: string; error: string | null; original_filename: string | null; created_at: Date; raw_text: string | null }, withText: boolean) => ({
  documentId: d.id,
  filename: d.original_filename,
  status: d.status,
  error: d.error,
  createdAt: d.created_at,
  ...(withText ? { text: d.raw_text } : { textPreview: d.raw_text?.slice(0, 300) ?? null }),
});

const presentResume = (r: ResumeSummary, withText: boolean) => ({
  id: r.id, ...present(r.document, withText), parsed: r.parsed, yearsExperience: r.yearsExperience, userEdited: r.userEdited,
});
const presentJob = (j: JobSummary, withText: boolean) => ({
  id: j.id, label: j.label, title: j.title, company: j.company, ...present(j.document, withText), parsed: j.parsed, userEdited: j.userEdited,
});

export function documentRoutes({ repo, storage, queue, maxUploadBytes }: DocumentRouteDeps): Router {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxUploadBytes, files: 1 } });

  /** Validate and persist an uploaded file or pasted text; returns the fields for the documents row. */
  async function intake(req: Request, allowPasted: boolean) {
    if (req.file) {
      const format = detectFormat(req.file.originalname, req.file.buffer);
      const storagePath = await storage.save(req.file.buffer, format);
      return {
        filename: req.file.originalname.slice(0, 200),
        mime: MIME_BY_FORMAT[format],
        storagePath,
        sha256: createHash("sha256").update(req.file.buffer).digest("hex"),
        rawText: null,
      };
    }
    if (allowPasted && typeof req.body?.text === "string") {
      const { text } = pastedJob.parse(req.body);
      return { filename: null, mime: "text/plain", storagePath: null, sha256: createHash("sha256").update(text).digest("hex"), rawText: text };
    }
    throw new HttpError(400, "NO_FILE", allowPasted ? "Attach a file (field 'file') or send job text." : "Attach a file in the 'file' field.");
  }

  // ---- resumes ----
  router.post("/resumes", upload.single("file"), async (req, res) => {
    const doc = await intake(req, false);
    const { resumeId, documentId } = await repo.createResume(req.userId, doc);
    await queue.enqueue(EXTRACT_QUEUE, { documentId });
    res.status(202).json({ id: resumeId, documentId, status: "uploaded" });
  });

  router.get("/resumes", async (req, res) => {
    const rows = await repo.listResumes(req.userId);
    res.json({ resumes: rows.map((r) => presentResume(r, false)) });
  });

  router.get("/resumes/:id", async (req, res) => {
    const r = await repo.getResume(req.userId, idParam.parse(req.params.id));
    if (!r) throw new HttpError(404, "NOT_FOUND", "Resume not found");
    res.json(presentResume(r, true));
  });

  router.delete("/resumes/:id", async (req, res) => {
    const r = await repo.getResume(req.userId, idParam.parse(req.params.id));
    if (!r) throw new HttpError(404, "NOT_FOUND", "Resume not found");
    const removed = await repo.deleteDocument(req.userId, r.document.id);
    if (removed?.storagePath) await storage.remove(removed.storagePath);
    res.status(204).end();
  });

  router.patch("/resumes/:id", async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { parsed } = z.object({ parsed: resumeParsedSchema }).parse(req.body);
    const ok = await repo.updateResume(req.userId, id, parsed, computeYearsOfExperience(parsed.experience).years);
    if (!ok) throw new HttpError(404, "NOT_FOUND", "Resume not found");
    res.json(presentResume((await repo.getResume(req.userId, id))!, false));
  });

  router.post("/resumes/:id/reparse", async (req, res) => {
    const r = await repo.getResume(req.userId, idParam.parse(req.params.id));
    if (!r) throw new HttpError(404, "NOT_FOUND", "Resume not found");
    await requeue(r.document.id, r.document.raw_text);
    res.status(202).json({ id: r.id, status: "extracted" });
  });

  /** Re-run parsing from the stored text, or extraction first when no text was ever extracted. */
  async function requeue(documentId: string, rawText: string | null) {
    if (rawText) {
      await repo.setStatus(documentId, "extracted");
      await queue.enqueue(PARSE_QUEUE, { documentId });
    } else {
      await repo.setStatus(documentId, "uploaded");
      await queue.enqueue(EXTRACT_QUEUE, { documentId });
    }
  }

  // ---- jobs ----
  router.post("/jobs", upload.single("file"), async (req, res) => {
    const doc = await intake(req, true);
    const meta = z.object({ title: z.string().trim().max(200).optional(), company: z.string().trim().max(200).optional() }).parse(req.body ?? {});
    const { jobId, documentId, label } = await repo.createJob(req.userId, doc, meta);
    await queue.enqueue(EXTRACT_QUEUE, { documentId });
    res.status(202).json({ id: jobId, documentId, label, status: "uploaded" });
  });

  router.get("/jobs", async (req, res) => {
    const rows = await repo.listJobs(req.userId);
    res.json({ jobs: rows.map((j) => presentJob(j, false)) });
  });

  router.get("/jobs/:id", async (req, res) => {
    const j = await repo.getJob(req.userId, idParam.parse(req.params.id));
    if (!j) throw new HttpError(404, "NOT_FOUND", "Job not found");
    res.json(presentJob(j, true));
  });

  router.patch("/jobs/:id", async (req, res) => {
    const id = idParam.parse(req.params.id);
    const body = z.object({
      title: z.string().trim().max(200).nullable(),
      company: z.string().trim().max(200).nullable(),
      parsed: jobParsedSchema,
    }).parse(req.body);
    const ok = await repo.updateJob(req.userId, id, { ...body, title: body.title || null, company: body.company || null });
    if (!ok) throw new HttpError(404, "NOT_FOUND", "Job not found");
    res.json(presentJob((await repo.getJob(req.userId, id))!, false));
  });

  router.post("/jobs/:id/reparse", async (req, res) => {
    const j = await repo.getJob(req.userId, idParam.parse(req.params.id));
    if (!j) throw new HttpError(404, "NOT_FOUND", "Job not found");
    await requeue(j.document.id, j.document.raw_text);
    res.status(202).json({ id: j.id, status: "extracted" });
  });

  router.delete("/jobs/:id", async (req, res) => {
    const j = await repo.getJob(req.userId, idParam.parse(req.params.id));
    if (!j) throw new HttpError(404, "NOT_FOUND", "Job not found");
    const removed = await repo.deleteDocument(req.userId, j.document.id);
    if (removed?.storagePath) await storage.remove(removed.storagePath);
    res.status(204).end();
  });

  return router;
}
