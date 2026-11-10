import { Router, type Request } from "express";
import multer from "multer";
import { z } from "zod";
import { createHash } from "node:crypto";
import { HttpError } from "../errors.js";
import { detectFormat, MIME_BY_FORMAT } from "../documents/fileTypes.js";
import type { DocumentRepo } from "../documents/repo.js";
import type { FileStorage } from "../documents/storage.js";
import { EXTRACT_QUEUE, type JobQueue } from "../queue/jobQueue.js";

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
    res.json({ resumes: rows.map((r) => ({ id: r.id, ...present(r.document, false) })) });
  });

  router.get("/resumes/:id", async (req, res) => {
    const r = await repo.getResume(req.userId, idParam.parse(req.params.id));
    if (!r) throw new HttpError(404, "NOT_FOUND", "Resume not found");
    res.json({ id: r.id, ...present(r.document, true) });
  });

  router.delete("/resumes/:id", async (req, res) => {
    const r = await repo.getResume(req.userId, idParam.parse(req.params.id));
    if (!r) throw new HttpError(404, "NOT_FOUND", "Resume not found");
    const removed = await repo.deleteDocument(req.userId, r.document.id);
    if (removed?.storagePath) await storage.remove(removed.storagePath);
    res.status(204).end();
  });

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
    res.json({ jobs: rows.map((j) => ({ id: j.id, label: j.label, title: j.title, company: j.company, ...present(j.document, false) })) });
  });

  router.get("/jobs/:id", async (req, res) => {
    const j = await repo.getJob(req.userId, idParam.parse(req.params.id));
    if (!j) throw new HttpError(404, "NOT_FOUND", "Job not found");
    res.json({ id: j.id, label: j.label, title: j.title, company: j.company, ...present(j.document, true) });
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
