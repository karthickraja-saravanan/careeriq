import { createHash } from "node:crypto";
import type pg from "pg";
import { HttpError } from "../errors.js";
import type { DocumentRepo } from "../documents/repo.js";
import { LlmUnavailableError, type LlmClient } from "../llm/types.js";
import { ParseError, completeValidated } from "../llm/structured.js";
import { enforceEvidence, stripInvalidCitations, type ChunkMap } from "./guardrails.js";
import { ANALYSIS_PROMPT_VERSION, JUDGE_SYSTEM, buildJudgeUser } from "./prompt.js";
import { experienceResult, overallScore, skillScore, WEIGHTS } from "./score.js";
import { judgeOutputSchema, type MatchReport, type RequirementResult } from "./types.js";
import type { JobParsed } from "../parsing/schemas.js";

export const jobHash = (parsed: JobParsed) => createHash("sha1").update(JSON.stringify(parsed)).digest("hex").slice(0, 16);

export interface AnalysisRow {
  id: string;
  jobId: string;
  score: number;
  report: MatchReport;
  createdAt: Date;
  /** True when the resume or job changed after this analysis was computed. */
  stale: boolean;
}

export class AnalysisService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly docs: DocumentRepo,
    private readonly llm: LlmClient | undefined,
    private readonly modelName: string,
  ) {}

  private async currentResume(userId: string) {
    const [resume] = await this.docs.listResumes(userId);
    return resume ?? null;
  }

  /** Compare the user's resume against one job, with every verdict tied to resume evidence. */
  async analyze(userId: string, jobId: string): Promise<AnalysisRow> {
    if (!this.llm) throw new HttpError(503, "AI_NOT_CONFIGURED", "AI is not configured. Set GROQ_API_KEY and restart the API.");

    const resume = await this.currentResume(userId);
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

    let judged;
    try {
      judged = await completeValidated(
        this.llm,
        { tier: "main", system: JUDGE_SYSTEM, user: buildJudgeUser(rows.map((r) => ({ cite: `R${r.ordinal}`, content: r.content })), job.parsed, job.title, job.company) },
        judgeOutputSchema,
      );
    } catch (err) {
      if (err instanceof ParseError) throw new HttpError(502, "AI_BAD_OUTPUT", "The AI returned an answer we could not use. Please try again.");
      if (err instanceof LlmUnavailableError) console.error("[analyze] LLM unavailable:", err.message);
      if (err instanceof LlmUnavailableError) throw new HttpError(503, "AI_UNAVAILABLE", "The AI service is busy or unreachable. Please try again in a moment.");
      throw err;
    }

    // 1. One result per requirement, with evidence enforced in code.
    const byId = new Map(judged.requirements.map((r) => [r.id, r]));
    const requirements: RequirementResult[] = [
      ...job.parsed.requiredSkills.map((s, i) => ({ id: `r${i + 1}`, kind: "required" as const, requirement: s })),
      ...job.parsed.preferredSkills.map((s, i) => ({ id: `p${i + 1}`, kind: "preferred" as const, requirement: s })),
    ].map((req) => {
      const claim = byId.get(req.id);
      if (!claim) return { ...req, verdict: "missing", evidence: [], reason: "Not assessed.", adjusted: "The model did not assess this requirement." };
      return { ...req, ...enforceEvidence(req.requirement, claim, chunks) };
    });

    // 2. Experience: years compared in code when possible.
    const expClaim = judged.experience
      ? { ...judged.experience, evidence: judged.experience.evidence.filter((c) => chunks.has(c.toUpperCase())) }
      : null;
    const experience = experienceResult(job.parsed.experienceRequirement, job.parsed.minYears, resume.yearsExperience, expClaim);

    // 3. Score from verdicts, by code.
    const required = skillScore(requirements, "required");
    const preferred = skillScore(requirements, "preferred");
    const score = overallScore({ required, preferred, experience: experience?.score ?? null });

    const clean = (list: string[]) => list.map((t) => stripInvalidCitations(t, chunks)).filter(Boolean);
    const cited = new Set([...requirements.flatMap((r) => r.evidence), ...(experience?.evidence ?? [])]);
    const report: MatchReport = {
      score,
      components: {
        required: { score: required, weight: WEIGHTS.required },
        preferred: { score: preferred, weight: WEIGHTS.preferred },
        experience: { score: experience?.score ?? null, weight: WEIGHTS.experience },
      },
      requirements,
      experience,
      strengths: clean(judged.strengths),
      concerns: clean(judged.concerns),
      recommendations: clean(judged.recommendations),
      sources: Object.fromEntries([...cited].map((c) => [c, chunks.get(c)!])),
      inputs: { resumeVersion: resume.version, jobHash: jobHash(job.parsed), promptVersion: ANALYSIS_PROMPT_VERSION, model: this.modelName },
    };

    const { rows: saved } = await this.pool.query<{ id: string; created_at: Date }>(
      `INSERT INTO analyses (user_id, resume_id, job_id, score, report, model, prompt_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (resume_id, job_id) DO UPDATE
         SET score = EXCLUDED.score, report = EXCLUDED.report, model = EXCLUDED.model, prompt_version = EXCLUDED.prompt_version, created_at = now()
       RETURNING id, created_at`,
      [userId, resume.id, jobId, score, JSON.stringify(report), this.modelName, ANALYSIS_PROMPT_VERSION],
    );
    return { id: saved[0]!.id, jobId, score, report, createdAt: saved[0]!.created_at, stale: false };
  }

  /** Analyses for the user's current resume, flagged stale when inputs changed since they were computed. */
  async list(userId: string): Promise<AnalysisRow[]> {
    const resume = await this.currentResume(userId);
    if (!resume) return [];
    const jobs = new Map((await this.docs.listJobs(userId)).map((j) => [j.id, j]));
    const { rows } = await this.pool.query<{ id: string; job_id: string; score: number; report: MatchReport; created_at: Date }>(
      "SELECT id, job_id, score, report, created_at FROM analyses WHERE user_id = $1 AND resume_id = $2",
      [userId, resume.id],
    );
    return rows
      .filter((r) => jobs.has(r.job_id))
      .map((r) => {
        const job = jobs.get(r.job_id)!;
        const stale = r.report.inputs.resumeVersion !== resume.version || !job.parsed || r.report.inputs.jobHash !== jobHash(job.parsed);
        return { id: r.id, jobId: r.job_id, score: r.score, report: r.report, createdAt: r.created_at, stale };
      });
  }
}
