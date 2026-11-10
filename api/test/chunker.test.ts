import { describe, expect, it } from "vitest";
import { chunkJob, chunkPlainText, chunkResume, estimateTokens, splitLong } from "../src/chunking/chunker.js";
import { FAKE_JOB, FAKE_RESUME } from "./helpers.js";
import { resumeParsedSchema, jobParsedSchema } from "../src/parsing/schemas.js";

const resume = resumeParsedSchema.parse(FAKE_RESUME);
const job = jobParsedSchema.parse(FAKE_JOB);

describe("chunkResume", () => {
  const chunks = chunkResume(resume);
  it("creates one chunk per role, plus skills, summary, project, education and certifications", () => {
    expect(chunks.map((c) => c.section)).toEqual(["summary", "skills", "experience", "experience", "projects", "education", "certifications"]);
  });
  it("numbers chunks sequentially from 1 for stable citations", () => {
    expect(chunks.map((c) => c.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("prefixes every chunk with a context header", () => {
    expect(chunks[2]!.content.startsWith("Resume > Experience > Backend Engineer at Finlytics (2023 to present)\n")).toBe(true);
    expect(chunks[2]!.content).toContain("Built billing APIs");
  });
  it("skips empty sections", () => {
    const sparse = chunkResume(resumeParsedSchema.parse({ skills: ["Go"] }));
    expect(sparse.map((c) => c.section)).toEqual(["skills"]);
  });
});

describe("chunkJob", () => {
  const chunks = chunkJob(job, "Job #1", null, null);
  it("separates responsibilities, required and preferred skills", () => {
    expect(chunks.map((c) => c.section)).toEqual(["overview", "responsibilities", "required_skills", "preferred_skills"]);
  });
  it("labels chunks with the job so they stand alone", () => {
    expect(chunks[2]!.content).toBe("Job #1 Senior Backend Engineer at Northwind Pay > Required skills\nRequired skills: TypeScript, Kafka");
  });
  it("prefers a user-edited title and company", () => {
    expect(chunkJob(job, "Job #2", "Staff Engineer", "Acme")[0]!.content).toContain("Job #2 Staff Engineer at Acme > Overview");
  });
});

describe("splitLong", () => {
  it("leaves short text alone", () => {
    expect(splitLong("short text")).toEqual(["short text"]);
  });
  it("splits long text on line boundaries within the token limit, with overlap", () => {
    const lines = Array.from({ length: 80 }, (_, i) => `- bullet number ${i} describing some work done on a project`);
    const pieces = splitLong(lines.join("\n"), 100, 20);
    expect(pieces.length).toBeGreaterThan(3);
    for (const p of pieces) expect(estimateTokens(p)).toBeLessThanOrEqual(110);
    // overlap: the start of piece 2 repeats the end of piece 1
    const tail = pieces[0]!.split("\n").pop()!;
    expect(pieces[1]).toContain(tail.slice(-20));
  });
  it("breaks a single over-long line", () => {
    expect(splitLong("x".repeat(2000), 100, 10).length).toBeGreaterThan(3);
  });
});

describe("chunkPlainText", () => {
  it("falls back to paragraph chunks", () => {
    const c = chunkPlainText("first paragraph\n\nsecond paragraph", "Resume");
    expect(c.map((x) => x.content)).toEqual(["Resume\nfirst paragraph", "Resume\nsecond paragraph"]);
  });
});
