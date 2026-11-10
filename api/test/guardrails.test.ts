import { describe, expect, it } from "vitest";
import { enforceEvidence, evidenceMentions, keyTerms, stripInvalidCitations, type ChunkMap } from "../src/analysis/guardrails.js";

const chunks: ChunkMap = new Map([
  ["R2", { section: "skills", content: "Skills: TypeScript, Node.js, PostgreSQL" }],
  ["R3", { section: "experience", content: "Backend Engineer at Finlytics\n- Built billing APIs" }],
]);

describe("keyTerms", () => {
  it("drops filler words and keeps the technologies", () => {
    expect(keyTerms("Go or Python")).toEqual(["go", "python"]);
    expect(keyTerms("Strong Node.js experience")).toEqual(["node.js"]);
  });
});

describe("evidenceMentions", () => {
  it("checks the cited text for the requirement", () => {
    expect(evidenceMentions("TypeScript", ["R2"], chunks)).toBe(true);
    expect(evidenceMentions("Kafka", ["R3"], chunks)).toBe(false);
  });
});

describe("enforceEvidence", () => {
  it("keeps a well supported verdict", () => {
    const r = enforceEvidence("TypeScript", { verdict: "met", evidence: ["R2"], reason: "listed" }, chunks);
    expect(r).toMatchObject({ verdict: "met", evidence: ["R2"] });
    expect(r.adjusted).toBeUndefined();
  });
  it("turns an uncited met into missing", () => {
    const r = enforceEvidence("Kafka", { verdict: "met", evidence: [], reason: "probably" }, chunks);
    expect(r.verdict).toBe("missing");
    expect(r.adjusted).toMatch(/counts as missing/);
  });
  it("drops invented citations, and a claim left with none becomes missing", () => {
    const r = enforceEvidence("Kafka", { verdict: "partial", evidence: ["R9"], reason: "" }, chunks);
    expect(r).toMatchObject({ verdict: "missing", evidence: [] });
  });
  it("lowers met to partial when the cited text never mentions the skill", () => {
    const r = enforceEvidence("Kafka", { verdict: "met", evidence: ["R3"], reason: "billing is similar" }, chunks);
    expect(r).toMatchObject({ verdict: "partial", evidence: ["R3"] });
    expect(r.adjusted).toMatch(/partial/);
  });
  it("accepts citations written as [R2] and in lower case", () => {
    expect(enforceEvidence("Node.js", { verdict: "met", evidence: ["[r2]"], reason: "" }, chunks).evidence).toEqual(["R2"]);
  });
  it("leaves missing verdicts alone", () => {
    expect(enforceEvidence("Kafka", { verdict: "missing", evidence: [], reason: "absent" }, chunks)).toEqual({ verdict: "missing", evidence: [], reason: "absent" });
  });
});

describe("stripInvalidCitations", () => {
  it("removes references to chunks that do not exist and keeps real ones", () => {
    expect(stripInvalidCitations("Strong backend work [R3] and cloud [R9].", chunks)).toBe("Strong backend work [R3] and cloud.");
  });
});
