import type { ZodType, ZodTypeDef } from "zod";
import type { LlmClient } from "../llm/types.js";
import { JOB_SYSTEM, RESUME_SYSTEM, wrapDocument } from "./prompts.js";
import { jobParsedSchema, resumeParsedSchema, type JobParsed, type ResumeParsed } from "./schemas.js";

export class ParseError extends Error {}

const MAX_INPUT_CHARS = 14_000;

/** Skill names differ in spelling across documents; dedupe case-insensitively and keep the first spelling. */
export function dedupeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  return skills.map((s) => s.trim()).filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
}

/**
 * Ask the model for JSON, validate it, and give it one chance to repair a bad answer
 * by showing it the validation error. Fails with ParseError after that.
 */
async function extractStructured<T>(llm: LlmClient, system: string, documentText: string, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  const user = wrapDocument(documentText.slice(0, MAX_INPUT_CHARS));
  let history: { role: "assistant" | "user"; content: string }[] = [];
  let lastProblem = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await llm.completeJson({ tier: "main", system, user, history });
    let problem: string;
    try {
      const result = schema.safeParse(JSON.parse(raw));
      if (result.success) return result.data;
      problem = result.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; ");
    } catch {
      problem = "the response was not valid JSON";
    }
    lastProblem = problem;
    history = [
      { role: "assistant", content: raw },
      { role: "user", content: `That response was rejected: ${problem}. Return corrected JSON only, following the schema exactly.` },
    ];
  }
  throw new ParseError(`The model returned data that could not be validated (${lastProblem}).`);
}

export async function parseResume(llm: LlmClient, text: string): Promise<ResumeParsed> {
  const parsed = await extractStructured(llm, RESUME_SYSTEM, text, resumeParsedSchema);
  return { ...parsed, skills: dedupeSkills(parsed.skills) };
}

export async function parseJob(llm: LlmClient, text: string): Promise<JobParsed> {
  const parsed = await extractStructured(llm, JOB_SYSTEM, text, jobParsedSchema);
  return { ...parsed, requiredSkills: dedupeSkills(parsed.requiredSkills), preferredSkills: dedupeSkills(parsed.preferredSkills) };
}
