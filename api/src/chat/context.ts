import type { SearchHit } from "../retrieval/search.js";
import type { AnalysisRow } from "../analysis/analyze.js";

export interface JobInfo {
  id: string;
  label: string;
  title: string | null;
  company: string | null;
}

export interface ContextSource {
  cite: string;
  title: string;
  section: string;
  content: string;
}

export const estimateTokens = (s: string) => Math.ceil(s.length / 4);

const jobName = (j: JobInfo) => `${j.label}${j.title ? ` · ${j.title}` : ""}${j.company ? ` at ${j.company}` : ""}`;

/** Short plain-text summary of a stored analysis, so chat answers agree with the Compare page. */
export function analysisSummary(a: AnalysisRow, job: JobInfo, resumeLabel?: string): string {
  const r = a.report;
  const list = (v: string) => r.requirements.filter((x) => x.verdict === v).map((x) => x.requirement).join(", ") || "none";
  return [
    `${resumeLabel ? `${resumeLabel} vs ` : ""}${jobName(job)}: match score ${a.score}/100.`,
    `Required/preferred skills met: ${list("met")}.`,
    `Partial: ${list("partial")}.`,
    `Missing: ${list("missing")}.`,
    r.experience ? `Experience: ${r.experience.reason}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export interface BuiltContext {
  text: string;
  sources: ContextSource[];
  dropped: number;
}

/**
 * Lay out retrieved chunks under a token budget. Chunks are taken in rounds across documents
 * (best resume chunk, best chunk of each job, next best, ...), so trimming never leaves one side with no evidence.
 */
export function buildContext(hits: SearchHit[], jobs: JobInfo[], analyses: { analysis: AnalysisRow; job: JobInfo; resumeLabel?: string }[], budgetTokens: number, resumeLabels?: Map<string, string>): BuiltContext {
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const groups = new Map<string, SearchHit[]>();
  for (const h of hits) groups.set(h.ownerId, [...(groups.get(h.ownerId) ?? []), h]);
  for (const g of groups.values()) g.sort((a, b) => b.score - a.score);

  const sources: ContextSource[] = [];
  let used = 0;
  let dropped = 0;

  const summaries = analyses.map(({ analysis, job, resumeLabel }) => analysisSummary(analysis, job, resumeLabel));
  if (summaries.length) {
    const content = summaries.join("\n");
    sources.push({ cite: "S", title: "Stored match analysis", section: "Match analysis", content });
    used += estimateTokens(content) + 12;
  }

  const lists = [...groups.values()];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let round = 0; round < longest; round++) {
    for (const list of lists) {
      const hit = list[round];
      if (!hit) continue;
      const cost = estimateTokens(hit.content) + 20;
      if (used + cost > budgetTokens) { dropped++; continue; }
      used += cost;
      const job = hit.ownerType === "job" ? jobById.get(hit.ownerId) : undefined;
      sources.push({ cite: hit.cite, title: hit.ownerType === "resume" ? (resumeLabels?.get(hit.ownerId) ? `Resume ${resumeLabels.get(hit.ownerId)}` : "Your resume") : job ? jobName(job) : "Job", section: hit.section, content: hit.content });
    }
  }

  const text = sources.map((s) => `[${s.cite}] (${s.title} · ${s.section})\n${s.content}`).join("\n\n");
  return { text, sources, dropped };
}
