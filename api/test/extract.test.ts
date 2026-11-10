import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ExtractionError, extractText, normalizeText } from "../src/documents/extract.js";
import { detectFormat } from "../src/documents/fileTypes.js";
import { fixtures, samples } from "./helpers.js";

describe("detectFormat", () => {
  it("accepts matching extension and content", () => {
    expect(detectFormat("cv.pdf", Buffer.from("%PDF-1.4 ..."))).toBe("pdf");
    expect(detectFormat("CV.DOCX", Buffer.from([0x50, 0x4b, 3, 4]))).toBe("docx");
    expect(detectFormat("jd.txt", Buffer.from("plain text"))).toBe("txt");
  });
  it("rejects unsupported extensions", () => {
    expect(() => detectFormat("run.exe", Buffer.from("MZ"))).toThrow(/Only PDF, DOCX/);
  });
  it("rejects content that does not match the extension", () => {
    expect(() => detectFormat("fake.pdf", Buffer.from("just text"))).toThrow(/does not match/);
    expect(() => detectFormat("fake.txt", Buffer.from([0x25, 0x00, 0x01]))).toThrow(/does not match/);
  });
});

describe("normalizeText", () => {
  it("joins hyphenated breaks and collapses blank lines", () => {
    expect(normalizeText("micro-\nservices\r\n\r\n\r\n\r\nare   fine  ")).toBe("microservices\n\nare fine");
  });
});

describe("extractText", () => {
  it("reads a DOCX resume", async () => {
    const text = await extractText(readFileSync(samples("resume-priya-nair.docx")), "docx");
    expect(text).toContain("TypeScript");
    expect(text).toContain("Finlytics");
  });
  it("reads a PDF resume", async () => {
    const text = await extractText(readFileSync(samples("resume-priya-nair.pdf")), "pdf");
    expect(text).toContain("PostgreSQL");
  });
  it("rejects image-only PDFs with a helpful message", async () => {
    await expect(extractText(readFileSync(fixtures("scanned.pdf")), "pdf")).rejects.toThrow(/No readable text/);
  });
  it("wraps parser failures in ExtractionError", async () => {
    await expect(extractText(Buffer.from("%PDF-1.4 garbage"), "pdf")).rejects.toBeInstanceOf(ExtractionError);
  });
});
