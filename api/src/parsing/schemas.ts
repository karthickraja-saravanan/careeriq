import { z } from "zod";

const text = z.string().trim().max(2000);
const list = (max = 60) => z.array(text).max(max).default([]);

export const resumeParsedSchema = z.object({
  name: text.nullable().default(null),
  headline: text.nullable().default(null),
  summary: z.string().trim().max(3000).default(""),
  skills: list(80),
  experience: z
    .array(
      z.object({
        title: text,
        company: text,
        /** "YYYY-MM", "YYYY", or null when not stated. */
        start: z.string().trim().max(20).nullable().default(null),
        /** "YYYY-MM", "YYYY", "present", or null when not stated. */
        end: z.string().trim().max(20).nullable().default(null),
        bullets: list(30),
      }),
    )
    .max(30)
    .default([]),
  projects: list(30),
  education: list(10),
  certifications: list(20),
});
export type ResumeParsed = z.infer<typeof resumeParsedSchema>;

export const jobParsedSchema = z.object({
  title: text.nullable().default(null),
  company: text.nullable().default(null),
  summary: z.string().trim().max(3000).default(""),
  responsibilities: list(40),
  requiredSkills: list(40),
  preferredSkills: list(40),
  experienceRequirement: text.nullable().default(null),
  minYears: z.number().min(0).max(40).nullable().default(null),
});
export type JobParsed = z.infer<typeof jobParsedSchema>;
