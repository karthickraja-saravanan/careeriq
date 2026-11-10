import type { ExperienceResult, RequirementResult, Verdict } from "./types.js";

export const VERDICT_POINTS: Record<Verdict, number> = { met: 1, partial: 0.5, missing: 0 };

/** Weights for the overall score. Components that do not apply (e.g. no preferred skills) are left out and the rest renormalised. */
export const WEIGHTS = { required: 0.6, experience: 0.3, preferred: 0.1 } as const;

const pct = (x: number) => Math.round(x * 100);

export function skillScore(results: RequirementResult[], kind: "required" | "preferred"): number | null {
  const items = results.filter((r) => r.kind === kind);
  if (items.length === 0) return null;
  return pct(items.reduce((sum, r) => sum + VERDICT_POINTS[r.verdict], 0) / items.length);
}

/**
 * Years of experience are compared in code when both numbers are known, so the model never decides them.
 * Falls back to the model's judgment of the experience text when there is no numeric requirement.
 */
export function experienceResult(
  requirement: string | null,
  requiredYears: number | null,
  candidateYears: number | null,
  model: { verdict: Verdict; evidence: string[]; reason: string } | null,
): ExperienceResult | null {
  if (!requirement && requiredYears === null) return null;
  const text = requirement ?? `${requiredYears}+ years`;
  if (requiredYears !== null && requiredYears > 0 && candidateYears !== null) {
    const ratio = Math.min(1, candidateYears / requiredYears);
    const verdict: Verdict = ratio >= 1 ? "met" : ratio >= 0.7 ? "partial" : "missing";
    return {
      requirement: text, verdict, score: pct(ratio), source: "dates", candidateYears, requiredYears, evidence: model?.evidence ?? [],
      reason: `${candidateYears} years from your role dates against ${requiredYears}+ required.`,
    };
  }
  if (!model) return null;
  return {
    requirement: text, verdict: model.verdict, score: pct(VERDICT_POINTS[model.verdict]), source: "model",
    candidateYears, requiredYears, evidence: model.evidence, reason: model.reason,
  };
}

export function overallScore(parts: { required: number | null; preferred: number | null; experience: number | null }) {
  let total = 0;
  let weight = 0;
  for (const key of ["required", "experience", "preferred"] as const) {
    const s = parts[key];
    if (s === null) continue;
    total += s * WEIGHTS[key];
    weight += WEIGHTS[key];
  }
  return weight === 0 ? 0 : Math.round(total / weight);
}
