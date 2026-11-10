import { describe, expect, it } from "vitest";
import { buildKeywordQuery, fuseRankings } from "../src/retrieval/search.js";

describe("buildKeywordQuery", () => {
  it("keeps alphanumeric words joined with OR and drops one-letter noise", () => {
    expect(buildKeywordQuery("What skills am I missing for Job #2?")).toBe("what | skills | am | missing | for | job");
  });
  it("splits punctuation so it cannot break the tsquery syntax", () => {
    expect(buildKeywordQuery("C++ & node.js (kafka)")).toBe("node | js | kafka");
  });
  it("returns null for input with no words", () => {
    expect(buildKeywordQuery("?! ...")).toBeNull();
  });
});

describe("fuseRankings", () => {
  it("ranks items found by both methods above items found by one", () => {
    const scores = fuseRankings(["a", "b", "c"], ["b", "d"]);
    const order = [...scores.entries()].sort((x, y) => y[1] - x[1]).map(([id]) => id);
    expect(order[0]).toBe("b");
    expect(order).toContain("d");
  });
  it("weights rank position", () => {
    const s = fuseRankings(["a", "b"], []);
    expect(s.get("a")!).toBeGreaterThan(s.get("b")!);
  });
});
