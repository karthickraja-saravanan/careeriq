import { z } from "zod";

export const verdictSchema = z.enum(["met", "partial", "missing"]);
export type Verdict = z.infer<typeof verdictSchema>;

/** What the model returns: one judgment per requirement, each pointing at resume evidence. */
export const judgeOutputSchema = z.object({
  requirements: z
    .array(
      z.object({
        id: z.string(),
        verdict: verdictSchema,
        evidence: z.array(z.string()).default([]),
        reason: z.string().trim().max(400).default(""),
      }),
    )
    .default([]),
  experience: z
    .object({ verdict: verdictSchema, evidence: z.array(z.string()).default([]), reason: z.string().trim().max(400).default("") })
    .nullable()
    .default(null),
  strengths: z.array(z.string().trim().max(400)).max(6).default([]),
  concerns: z.array(z.string().trim().max(400)).max(6).default([]),
  recommendations: z.array(z.string().trim().max(400)).max(6).default([]),
});
export type JudgeOutput = z.infer<typeof judgeOutputSchema>;

export interface RequirementResult {
  id: string;
  kind: "required" | "preferred";
  requirement: string;
  verdict: Verdict;
  evidence: string[];
  reason: string;
  /** True when the model claimed more than its evidence supports and code lowered the verdict. */
  adjusted?: string;
}

export interface ExperienceResult {
  requirement: string;
  verdict: Verdict;
  score: number;
  source: "dates" | "model";
  candidateYears: number | null;
  requiredYears: number | null;
  evidence: string[];
  reason: string;
}

export interface MatchReport {
  score: number;
  components: {
    required: { score: number | null; weight: number };
    preferred: { score: number | null; weight: number };
    experience: { score: number | null; weight: number };
  };
  requirements: RequirementResult[];
  experience: ExperienceResult | null;
  strengths: string[];
  concerns: string[];
  recommendations: string[];
  /** Text of every cited resume chunk, so the UI can show the evidence behind each verdict. */
  sources: Record<string, { section: string; content: string }>;
  inputs: { resumeVersion: number; jobHash: string; promptVersion: string; model: string };
}
