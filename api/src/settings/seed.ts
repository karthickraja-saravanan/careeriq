import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type pg from "pg";
import type { DocumentRepo } from "../documents/repo.js";
import type { FileStorage } from "../documents/storage.js";
import { EXTRACT_QUEUE, type JobQueue } from "../queue/jobQueue.js";

// Same relative location from src/settings (dev, tests) and dist/settings (built image).
const SEED_DIR = path.resolve(import.meta.dirname, "../../seed-data");
const RESUME_FILE = "resume-priya-nair.txt";
const JOB_FILES = ["job1-senior-backend-engineer.txt", "job2-full-stack-engineer.txt", "job3-platform-engineer.txt"];

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const asText = (rawText: string) => ({ filename: null, mime: "text/plain", storagePath: null, sha256: sha(rawText), rawText });

/** Remove all of a user's documents (resume, jobs, chunks, analyses) and conversations, plus stored files. */
export async function clearUserData(pool: pg.Pool, docs: DocumentRepo, storage: FileStorage, userId: string): Promise<void> {
  const { rows } = await pool.query<{ id: string }>("SELECT id FROM documents WHERE user_id = $1", [userId]);
  for (const { id } of rows) {
    const removed = await docs.deleteDocument(userId, id);
    if (removed?.storagePath) await storage.remove(removed.storagePath);
  }
  await pool.query("DELETE FROM conversations WHERE user_id = $1", [userId]);
}

/** Replace the user's data with one sample resume and three sample jobs, processed by the normal pipeline. */
export async function seedDemoData(pool: pg.Pool, docs: DocumentRepo, storage: FileStorage, queue: JobQueue, userId: string) {
  await clearUserData(pool, docs, storage, userId);
  const resume = await docs.createResume(userId, asText(await readFile(path.join(SEED_DIR, RESUME_FILE), "utf8")));
  await queue.enqueue(EXTRACT_QUEUE, { documentId: resume.documentId });
  for (const file of JOB_FILES) {
    const job = await docs.createJob(userId, asText(await readFile(path.join(SEED_DIR, file), "utf8")), {});
    await queue.enqueue(EXTRACT_QUEUE, { documentId: job.documentId });
  }
  return { resumes: 1, jobs: JOB_FILES.length };
}
