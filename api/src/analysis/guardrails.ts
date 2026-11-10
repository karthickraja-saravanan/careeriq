import type { Verdict } from "./types.js";

export type ChunkMap = Map<string, { section: string; content: string }>;

const STOP = new Set(["and", "or", "the", "of", "in", "with", "for", "to", "a", "an", "experience", "years", "skills", "knowledge", "strong", "good"]);

/** Significant lowercase words of a requirement ("Go or Python" -> go, python). */
export function keyTerms(requirement: string): string[] {
  return [...new Set((requirement.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []).filter((w) => w.length >= 2 && !STOP.has(w)))];
}

/** Does any cited chunk literally mention any key term of the requirement? */
export function evidenceMentions(requirement: string, cites: string[], chunks: ChunkMap): boolean {
  const text = cites.map((c) => chunks.get(c)?.content.toLowerCase() ?? "").join("\n");
  return keyTerms(requirement).some((t) => text.includes(t));
}

/**
 * Enforce "never fabricate" in code, regardless of what the model said:
 *  - citations must be real resume chunks (unknown ones are dropped)
 *  - met or partial without any real citation becomes missing
 *  - met whose citations never mention the requirement is lowered to partial
 */
export function enforceEvidence(
  requirement: string,
  claim: { verdict: Verdict; evidence: string[]; reason: string },
  chunks: ChunkMap,
): { verdict: Verdict; evidence: string[]; reason: string; adjusted?: string } {
  const evidence = [...new Set(claim.evidence.map((c) => c.replace(/[\[\]\s]/g, "").toUpperCase()))].filter((c) => chunks.has(c));
  if (claim.verdict !== "missing" && evidence.length === 0) {
    return { verdict: "missing", evidence: [], reason: "No supporting evidence found in your resume.", adjusted: "No valid evidence was cited, so this counts as missing." };
  }
  if (claim.verdict === "met" && !evidenceMentions(requirement, evidence, chunks)) {
    return { verdict: "partial", evidence, reason: claim.reason, adjusted: "The cited text does not mention this skill directly, so it counts as partial." };
  }
  return { verdict: claim.verdict, evidence, reason: claim.reason };
}

/** Remove [R3]-style references that do not point at a real resume chunk from free text. */
export function stripInvalidCitations(text: string, chunks: ChunkMap): string {
  return text.replace(/\s*\[(R\d+)\]/gi, (m, c: string) => (chunks.has(c.toUpperCase()) ? m : "")).trim();
}

