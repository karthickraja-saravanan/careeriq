import type { ZodType, ZodTypeDef } from "zod";
import type { JsonCompletionRequest, LlmClient } from "./types.js";

/** The model kept returning data that did not match the expected shape. */
export class ParseError extends Error {}

/**
 * Ask the model for JSON, validate it against a schema, and give it one chance to repair a bad answer
 * by showing it the validation error. Throws ParseError after that.
 */
export async function completeValidated<T>(
  llm: LlmClient,
  req: Pick<JsonCompletionRequest, "tier" | "system" | "user" | "meta">,
  schema: ZodType<T, ZodTypeDef, unknown>,
): Promise<T> {
  let history: NonNullable<JsonCompletionRequest["history"]> = [];
  let lastProblem = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await llm.completeJson({ ...req, history });
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
