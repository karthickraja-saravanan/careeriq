import mammoth from "mammoth";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import type { FileFormat } from "./fileTypes.js";

const MIN_TEXT_CHARS = 40;
const MAX_PDF_PAGES = 15;

export class ExtractionError extends Error {}

/** Tidy extracted text: unify newlines, join hyphenated line breaks, collapse blank runs. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractText(buf: Buffer, format: FileFormat): Promise<string> {
  let text: string;
  try {
    if (format === "txt") text = buf.toString("utf8");
    else if (format === "docx") text = (await mammoth.extractRawText({ buffer: buf })).value;
    else {
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      if (pdf.numPages > MAX_PDF_PAGES) throw new ExtractionError(`PDF has ${pdf.numPages} pages; the limit is ${MAX_PDF_PAGES}.`);
      text = (await extractPdfText(pdf, { mergePages: true })).text;
    }
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    throw new ExtractionError("The file could not be read. It may be corrupted or password protected.");
  }

  const normalized = normalizeText(text);
  if (normalized.length < MIN_TEXT_CHARS) {
    throw new ExtractionError("No readable text found. Scanned or image-only files are not supported; upload a text-based PDF or DOCX.");
  }
  return normalized;
}
