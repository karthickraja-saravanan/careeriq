import type { ZodType, ZodTypeDef } from "zod";
import type { LlmCallMeta, LlmClient } from "../llm/types.js";
import { ParseError, completeValidated } from "../llm/structured.js";
import { JOB_SYSTEM, RESUME_SYSTEM, wrapDocument } from "./prompts.js";
import { jobParsedSchema, resumeParsedSchema, type JobParsed, type ResumeParsed } from "./schemas.js";

export { ParseError };

const MAX_INPUT_CHARS = 14_000;

/** Skill names differ in spelling across documents; dedupe case-insensitively and keep the first spelling. */
export function dedupeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  return skills.map((s) => s.trim()).filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
}

function extractStructured<T>(llm: LlmClient, meta: LlmCallMeta, system: string, documentText: string, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  return completeValidated(llm, { tier: "main", meta, system, user: wrapDocument(documentText.slice(0, MAX_INPUT_CHARS)) }, schema);
}

export async function parseResume(llm: LlmClient, text: string, userId?: string): Promise<ResumeParsed> {
  const parsed = await extractStructured(llm, { userId, purpose: "parse_resume" }, RESUME_SYSTEM, text, resumeParsedSchema);
  return { ...parsed, skills: dedupeSkills(parsed.skills) };
}

export async function parseJob(llm: LlmClient, text: string, userId?: string): Promise<JobParsed> {
  const parsed = await extractStructured(llm, { userId, purpose: "parse_job" }, JOB_SYSTEM, text, jobParsedSchema);
  return { ...parsed, requiredSkills: dedupeSkills(parsed.requiredSkills), preferredSkills: dedupeSkills(parsed.preferredSkills) };
}
