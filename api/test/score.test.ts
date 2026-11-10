import { describe, expect, it } from "vitest";
import { experienceResult, overallScore, skillScore } from "../src/analysis/score.js";
import type { RequirementResult } from "../src/analysis/types.js";

const r = (kind: "required" | "preferred", verdict: RequirementResult["verdict"]): RequirementResult =>
  ({ id: "x", kind, requirement: "x", verdict, evidence: [], reason: "" });

describe("skillScore", () => {
  it("gives full credit for met, half for partial, none for missing", () => {
    expect(skillScore([r("required", "met"), r("required", "partial"), r("required", "missing"), r("required", "met")], "required")).toBe(63);
  });
  it("is null when there are no requirements of that kind", () => {
    expect(skillScore([r("required", "met")], "preferred")).toBeNull();
  });
});

describe("experienceResult", () => {
  it("compares years in code when both are known", () => {
    expect(experienceResult("5+ years", 5, 5.4, null)).toMatchObject({ verdict: "met", score: 100, source: "dates" });
    expect(experienceResult("5+ years", 5, 3.5, null)).toMatchObject({ verdict: "partial", score: 70 });
    expect(experienceResult("5+ years", 5, 1, null)).toMatchObject({ verdict: "missing", score: 20 });
  });
  it("ignores the model's opinion on numbers when dates exist", () => {
    const res = experienceResult("5+ years", 5, 1, { verdict: "met", evidence: [], reason: "trust me" });
    expect(res!.verdict).toBe("missing");
  });
  it("falls back to the model when there is no numeric requirement", () => {
    const res = experienceResult("Experience leading teams", null, 5, { verdict: "partial", evidence: ["R3"], reason: "some" });
    expect(res).toMatchObject({ verdict: "partial", score: 50, source: "model" });
  });
  it("falls back to the model when candidate years are unknown", () => {
    expect(experienceResult("5+ years", 5, null, { verdict: "met", evidence: [], reason: "" })!.source).toBe("model");
  });
  it("is null when the job states no experience requirement", () => {
    expect(experienceResult(null, null, 5, null)).toBeNull();
  });
});

describe("overallScore", () => {
  it("weights required 60%, experience 30%, preferred 10%", () => {
    expect(overallScore({ required: 100, experience: 0, preferred: 0 })).toBe(60);
    expect(overallScore({ required: 0, experience: 100, preferred: 0 })).toBe(30);
    expect(overallScore({ required: 0, experience: 0, preferred: 100 })).toBe(10);
  });
  it("renormalises when a component does not apply", () => {
    expect(overallScore({ required: 80, experience: null, preferred: null })).toBe(80);
    expect(overallScore({ required: 100, experience: 50, preferred: null })).toBe(83);
  });
  it("is 0 when nothing can be scored", () => {
    expect(overallScore({ required: null, experience: null, preferred: null })).toBe(0);
  });
});
