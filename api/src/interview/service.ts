import type pg from "pg";
import { z } from "zod";
import { HttpError } from "../errors.js";
import type { DocumentRepo } from "../documents/repo.js";
import { LlmUnavailableError, type LlmClient } from "../llm/types.js";
import { ParseError, completeValidated } from "../llm/structured.js";
import { stripInvalidCitations, type ChunkMap } from "../analysis/guardrails.js";
import { jobHash, type AnalysisService } from "../analysis/analyze.js";
import { INTERVIEW_PROMPT_VERSION, INTERVIEW_SYSTEM, buildInterviewUser } from "./prompt.js";

const kindSchema = z.enum(["experience", "gap", "technical", "behavioral"]);
export const interviewOutputSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().trim().min(8).max(400),
        kind: kindSchema.catch("technical"),
        why: z.string().trim().max(400).default(""),
        structure: z.string().trim().max(600).default(""),
        basedOn: z.array(z.string()).default([]),
      }),
    )
    .min(1),
});

export interface InterviewQuestion {
  question: string;
  kind: z.infer<typeof kindSchema>;
  why: string;
  structure: string;
  basedOn: string[];
}
export interface InterviewReport {
  questions: InterviewQuestion[];
  /** Requirements the comparison found missing or only partly evidenced. Computed from the stored analysis, not by the model. */
  topics: { requirement: string; verdict: "missing" | "partial" }[];
  sources: Record<string, { section: string; content: string }>;
  inputs: { resumeVersion: number; jobHash: string; promptVersion: string; model: string };
}
export interface InterviewRow { id: string; jobId: string; resumeId: string; report: InterviewReport; createdAt: Date; stale: boolean }

const MAX_QUESTIONS = 8;

/** Drop invalid citations; an "experience" question must rest on real resume text or it is dropped. */
export function enforceQuestions(raw: z.infer<typeof interviewOutputSchema>["questions"], chunks: ChunkMap): InterviewQuestion[] {
  const out: InterviewQuestion[] = [];
  for (const q of raw) {
    const basedOn = [...new Set(q.basedOn.map((c) => c.replace(/[\[\]\s]/g, "").toUpperCase()))].filter((c) => chunks.has(c));
    if (q.kind === "experience" && basedOn.length === 0) continue; // claims something about the resume with nothing behind it
    out.push({
      question: stripInvalidCitations(q.question, chunks),
      kind: q.kind,
      why: stripInvalidCitations(q.why, chunks),
      structure: stripInvalidCitations(q.structure, chunks),
      basedOn: q.kind === "experience" ? basedOn : [],
    });
    if (out.length === MAX_QUESTIONS) break;
  }
  return out;
}

export class InterviewService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly docs: DocumentRepo,
    private readonly analyses: AnalysisService,
    private readonly llm: LlmClient | undefined,
    private readonly modelName: string,
  ) {}

  async generate(userId: string, jobId: string, resumeId?: string): Promise<InterviewRow> {
    if (!this.llm) throw new HttpError(503, "AI_NOT_CONFIGURED", "AI is not configured. Set GROQ_API_KEY and restart the API.");
    const resume = resumeId ? await this.docs.getResume(userId, resumeId) : (await this.docs.listResumes(userId))[0];
    if (resumeId && !resume) throw new HttpError(404, "NOT_FOUND", "Resume not found");
    if (!resume) throw new HttpError(409, "NO_RESUME", "Upload a resume first.");
    if (resume.document.status !== "ready" || !resume.parsed) throw new HttpError(409, "RESUME_NOT_READY", "Your resume is still being processed.");
    const job = await this.docs.getJob(userId, jobId);
    if (!job) throw new HttpError(404, "NOT_FOUND", "Job not found");
    if (job.document.status !== "ready" || !job.parsed) throw new HttpError(409, "JOB_NOT_READY", "This job is still being processed.");

    const { rows } = await this.pool.query<{ ordinal: number; section: string; content: string }>(
      "SELECT ordinal, section, content FROM chunks WHERE user_id = $1 AND owner_type = 'resume' AND owner_id = $2 ORDER BY ordinal",
      [userId, resume.id],
    );
    if (rows.length === 0) throw new HttpError(409, "RESUME_NOT_READY", "Your resume is not indexed yet.");
    const chunks: ChunkMap = new Map(rows.map((r) => [`R${r.ordinal}`, { section: r.section, content: r.content }]));

    // Gaps come from the stored comparison when it is up to date.
    const analysis = (await this.analyses.list(userId)).find((a) => a.jobId === jobId && a.resumeId === resume.id && !a.stale);
    const topics = (analysis?.report.requirements ?? [])
      .filter((r) => r.verdict !== "met")
      .map((r) => ({ requirement: r.requirement, verdict: r.verdict as "missing" | "partial" }));

    let generated;
    try {
      generated = await completeValidated(
        this.llm,
        {
          tier: "main",
          system: INTERVIEW_SYSTEM,
          user: buildInterviewUser(rows.map((r) => ({ cite: `R${r.ordinal}`, content: r.content })), job.parsed, job.title, job.company, topics.map((t) => t.requirement)),
        },
        interviewOutputSchema,
      );
    } catch (err) {
      if (err instanceof ParseError) throw new HttpError(502, "AI_BAD_OUTPUT", "The AI returned an answer we could not use. Please try again.");
      if (err instanceof LlmUnavailableError) throw new HttpError(503, "AI_UNAVAILABLE", "The AI service is busy or unreachable. Please try again in a moment.");
      throw err;
    }

    const questions = enforceQuestions(generated.questions, chunks);
    if (questions.length === 0) throw new HttpError(502, "AI_BAD_OUTPUT", "The AI returned questions we could not verify. Please try again.");
    const cited = new Set(questions.flatMap((q) => q.basedOn));
    const report: InterviewReport = {
      questions,
      topics,
      sources: Object.fromEntries([...cited].map((c) => [c, chunks.get(c)!])),
      inputs: { resumeVersion: resume.version, jobHash: jobHash(job.parsed), promptVersion: INTERVIEW_PROMPT_VERSION, model: this.modelName },
    };
    const { rows: saved } = await this.pool.query<{ id: string; created_at: Date }>(
      `INSERT INTO interview_preps (user_id, resume_id, job_id, content) VALUES ($1, $2, $3, $4)
       ON CONFLICT (resume_id, job_id) DO UPDATE SET content = EXCLUDED.content, created_at = now()
       RETURNING id, created_at`,
      [userId, resume.id, jobId, JSON.stringify(report)],
    );
    return { id: saved[0]!.id, jobId, resumeId: resume.id, report, createdAt: saved[0]!.created_at, stale: false };
  }

  async list(userId: string): Promise<InterviewRow[]> {
    const resumes = new Map((await this.docs.listResumes(userId)).map((r) => [r.id, r]));
    if (resumes.size === 0) return [];
    const jobs = new Map((await this.docs.listJobs(userId)).map((j) => [j.id, j]));
    const { rows } = await this.pool.query<{ id: string; job_id: string; resume_id: string; content: InterviewReport; created_at: Date }>(
      "SELECT id, job_id, resume_id, content, created_at FROM interview_preps WHERE user_id = $1",
      [userId],
    );
    return rows
      .filter((r) => jobs.has(r.job_id) && resumes.has(r.resume_id))
      .map((r) => {
        const job = jobs.get(r.job_id)!;
        const resume = resumes.get(r.resume_id)!;
        const stale = r.content.inputs.resumeVersion !== resume.version || !job.parsed || r.content.inputs.jobHash !== jobHash(job.parsed);
        return { id: r.id, jobId: r.job_id, resumeId: r.resume_id, report: r.content, createdAt: r.created_at, stale };
      });
  }
}
