import type { JobParsed, ResumeParsed } from "../parsing/schemas.js";

export interface Chunk {
  section: string;
  /** Position within the document, used to build citation labels such as R3 or J2-1. */
  ordinal: number;
  /** Text that is embedded and shown as evidence. Starts with a context header. */
  content: string;
  tokenCount: number;
}

const MAX_TOKENS = 400;
const OVERLAP_TOKENS = 40;

/** Rough estimate (about 4 characters per token). Good enough for sizing chunks. */
export const estimateTokens = (s: string) => Math.ceil(s.length / 4);

/**
 * Split text that is too long for one chunk, preferring line boundaries so bullets stay whole,
 * and carrying a small overlap into the next piece.
 */
export function splitLong(text: string, maxTokens = MAX_TOKENS, overlapTokens = OVERLAP_TOKENS): string[] {
  if (estimateTokens(text) <= maxTokens) return [text];
  const maxChars = maxTokens * 4;
  const overlapChars = overlapTokens * 4;
  const lines = text.split("\n").flatMap((l) => (l.length > maxChars ? l.match(new RegExp(`.{1,${maxChars}}`, "g")) ?? [] : [l]));

  const pieces: string[] = [];
  let current = "";
  for (const line of lines) {
    if (current && current.length + line.length + 1 > maxChars) {
      pieces.push(current);
      current = current.slice(-overlapChars).replace(/^\S*\s/, "") + "\n" + line; // start the overlap on a word boundary
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/** Builds chunks with a shared header and sequential ordinals; over-long sections become several chunks. */
class ChunkBuilder {
  readonly chunks: Chunk[] = [];
  add(header: string, section: string, body: string) {
    const text = body.trim();
    if (!text) return;
    for (const piece of splitLong(text)) {
      const content = `${header}\n${piece}`;
      this.chunks.push({ section, ordinal: this.chunks.length + 1, content, tokenCount: estimateTokens(content) });
    }
  }
}

const dates = (start: string | null, end: string | null) => [start, end].filter(Boolean).join(" to ");

/** One chunk per role, per project, plus skills, summary, education and certifications. */
export function chunkResume(p: ResumeParsed): Chunk[] {
  const b = new ChunkBuilder();
  if (p.summary) b.add("Resume > Summary", "summary", [p.headline, p.summary].filter(Boolean).join("\n"));
  if (p.skills.length) b.add("Resume > Skills", "skills", `Skills: ${p.skills.join(", ")}`);
  for (const e of p.experience) {
    const when = dates(e.start, e.end);
    const title = `${e.title}${e.company ? ` at ${e.company}` : ""}${when ? ` (${when})` : ""}`;
    b.add(`Resume > Experience > ${title}`, "experience", [title, ...e.bullets.map((x) => `- ${x}`)].join("\n"));
  }
  for (const proj of p.projects) b.add("Resume > Projects", "projects", proj);
  if (p.education.length) b.add("Resume > Education", "education", p.education.join("\n"));
  if (p.certifications.length) b.add("Resume > Certifications", "certifications", `Certifications: ${p.certifications.join(", ")}`);
  return b.chunks;
}

/** Overview, responsibilities, required skills and preferred skills, each separately retrievable. */
export function chunkJob(p: JobParsed, label: string, title: string | null, company: string | null): Chunk[] {
  const b = new ChunkBuilder();
  const name = [title ?? p.title, company ?? p.company].filter(Boolean).join(" at ");
  const head = (part: string) => `${label}${name ? ` ${name}` : ""} > ${part}`;
  b.add(head("Overview"), "overview", [name, p.summary, p.experienceRequirement && `Experience required: ${p.experienceRequirement}`].filter(Boolean).join("\n"));
  b.add(head("Responsibilities"), "responsibilities", p.responsibilities.map((x) => `- ${x}`).join("\n"));
  if (p.requiredSkills.length) b.add(head("Required skills"), "required_skills", `Required skills: ${p.requiredSkills.join(", ")}`);
  if (p.preferredSkills.length) b.add(head("Preferred skills"), "preferred_skills", `Preferred skills (nice to have): ${p.preferredSkills.join(", ")}`);
  return b.chunks;
}

/** Fallback when structured parsing is unavailable: paragraph-based chunks of the raw text. */
export function chunkPlainText(text: string, header: string): Chunk[] {
  const b = new ChunkBuilder();
  for (const para of text.split(/\n{2,}/)) b.add(header, "text", para);
  return b.chunks;
}
