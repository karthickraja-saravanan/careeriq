import { describe, expect, it } from "vitest";
import { sanitizeCitations } from "../src/chat/citations.js";
import { resolveJobRefs } from "../src/chat/jobRefs.js";
import { buildContext } from "../src/chat/context.js";
import type { SearchHit } from "../src/retrieval/search.js";

describe("sanitizeCitations", () => {
  const allowed = new Set(["R1", "R2", "J2-1", "S"]);
  it("keeps valid labels and removes unknown ones", () => {
    const r = sanitizeCitations("Uses TypeScript [R1] and Kafka [R9].", allowed);
    expect(r.text).toBe("Uses TypeScript [R1] and Kafka.");
    expect(r.cited).toEqual(["R1"]);
    expect(r.invalid).toEqual(["R9"]);
  });
  it("handles several labels in one bracket and normalises case", () => {
    const r = sanitizeCitations("Fit [r1, J2-1, R7].", allowed);
    expect(r.text).toBe("Fit [R1, J2-1].");
    expect(r.invalid).toEqual(["R7"]);
  });
  it("leaves non-citation brackets alone", () => {
    expect(sanitizeCitations("See [optional] and [link text].", allowed).text).toBe("See [optional] and [link text].");
  });
  it("reports no citations for an ungrounded answer", () => {
    expect(sanitizeCitations("No idea.", allowed).cited).toEqual([]);
  });
});

describe("resolveJobRefs", () => {
  const jobs = [
    { id: "a", label: "Job #1", title: "Data Engineer", company: "Acme Corp" },
    { id: "b", label: "Job #2", title: "Backend Engineer", company: "Northwind Pay" },
  ];
  it("matches job numbers", () => expect(resolveJobRefs("How do I fit job #2?", jobs)).toEqual(["b"]));
  it("matches without a hash", () => expect(resolveJobRefs("compare job 1 and job 2", jobs).sort()).toEqual(["a", "b"]));
  it("matches company and title", () => {
    expect(resolveJobRefs("what does northwind pay want", jobs)).toEqual(["b"]);
    expect(resolveJobRefs("the data engineer role", jobs)).toEqual(["a"]);
  });
  it("returns nothing for a general question", () => expect(resolveJobRefs("What are my strengths?", jobs)).toEqual([]));
  it("does not confuse job 1 with job 12", () => expect(resolveJobRefs("job 12", jobs)).toEqual([]));
});

describe("buildContext", () => {
  const hit = (ownerId: string, ownerType: "resume" | "job", cite: string, score: number, size = 40): SearchHit => ({
    chunkId: cite, cite, ownerType, ownerId, section: "Skills", content: "x".repeat(size), vectorRank: 1, keywordRank: null, score,
  });
  const jobs = [{ id: "j1", label: "Job #1", title: "Dev", company: "Co" }];
  it("labels every passage", () => {
    const c = buildContext([hit("r", "resume", "R1", 0.5), hit("j1", "job", "J1-1", 0.4)], jobs, [], 1000);
    expect(c.text).toContain("[R1] (Your resume");
    expect(c.text).toContain("[J1-1] (Job #1 · Dev at Co");
  });
  it("trims by round so both sides keep evidence", () => {
    const hits = [hit("r", "resume", "R1", 0.9, 400), hit("r", "resume", "R2", 0.8, 400), hit("j1", "job", "J1-1", 0.1, 400), hit("j1", "job", "J1-2", 0.05, 400)];
    const c = buildContext(hits, jobs, [], 260);
    expect(c.sources.map((s) => s.cite)).toEqual(["R1", "J1-1"]);
    expect(c.dropped).toBe(2);
  });
});

import { resolveResumeMentions } from "../src/chat/resumeRefs.js";

describe("resolveResumeMentions", () => {
  const resumes = [{ id: "a", label: "CV1" }, { id: "b", label: "CV2" }];
  it("finds @CV and @R mentions case-insensitively and normalises them", () => {
    const r = resolveResumeMentions("Use @cv2 and @R1, then @CV2 again", resumes);
    expect(r.ids).toEqual(["b", "a"]);
    expect(r.unknown).toEqual([]);
    expect(r.text).toBe("Use CV2 and CV1, then CV2 again");
  });
  it("reports unknown labels and ignores look-alikes", () => {
    const r = resolveResumeMentions("@CV3 please, email me@R1.com, CV1 alone", resumes);
    expect(r.ids).toEqual([]);
    expect(r.unknown).toEqual(["CV3"]);
  });
  it("leaves questions without mentions untouched", () => {
    expect(resolveResumeMentions("What am I missing?", resumes)).toEqual({ ids: [], unknown: [], text: "What am I missing?" });
  });
});
