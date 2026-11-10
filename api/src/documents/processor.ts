import type { DocumentRepo } from "./repo.js";
import type { FileStorage } from "./storage.js";
import { detectFormat } from "./fileTypes.js";
import { ExtractionError, extractText, normalizeText } from "./extract.js";
import type { LlmClient } from "../llm/types.js";
import { LlmUnavailableError } from "../llm/types.js";
import { ParseError, parseJob, parseResume } from "../parsing/parse.js";
import { computeYearsOfExperience } from "../parsing/experience.js";
import type { Embedder } from "../embeddings/types.js";
import { chunkJob, chunkPlainText, chunkResume } from "../chunking/chunker.js";
import type { JobParsed, ResumeParsed } from "../parsing/schemas.js";

/** The slice of a logger the handlers need. A pino Logger satisfies it; tests pass a no-op. */
export interface ErrorLog {
  error(obj: object, msg: string): void;
}

/**
 * Queue handler: turn an uploaded file (or pasted text) into clean text.
 * Expected failures (unreadable or scanned files) are recorded on the document and are not retried.
 * Unexpected errors are rethrown so the queue retries them.
 */
export function createExtractHandler(
  repo: DocumentRepo,
  storage: FileStorage,
  onExtracted: (documentId: string) => Promise<void>,
  log: ErrorLog,
) {
  return async ({ documentId }: { documentId: string }) => {
    const doc = await repo.getForProcessing(documentId);
    if (!doc) return; // deleted before processing
    await repo.setStatus(documentId, "extracting");
    try {
      let text: string;
      if (doc.storage_path) {
        const buf = await storage.read(doc.storage_path);
        text = await extractText(buf, detectFormat(doc.original_filename ?? doc.storage_path, buf));
      } else {
        text = normalizeText(doc.raw_text ?? "");
      }
      await repo.setStatus(documentId, "extracted", { rawText: text });
      await onExtracted(documentId);
    } catch (err) {
      if (err instanceof ExtractionError) {
        await repo.setStatus(documentId, "failed", { error: err.message });
        return;
      }
      log.error({ err, documentId }, "extraction failed unexpectedly");
      await repo.setStatus(documentId, "failed", { error: "Processing failed. Please try again." });
      throw err;
    }
  };
}

/**
 * Queue handler: turn extracted text into structured data with the LLM.
 * Bad model output is recorded as a failure the user can retry; transient LLM problems are retried by the queue.
 */
export function createParseHandler(
  repo: DocumentRepo,
  llm: LlmClient | undefined,
  onParsed: (documentId: string) => Promise<void>,
  log: ErrorLog,
) {
  return async ({ documentId }: { documentId: string }) => {
    const doc = await repo.getForProcessing(documentId);
    if (!doc?.raw_text) return;
    if (!llm) {
      await repo.setStatus(documentId, "failed", { error: "AI parsing is not configured. Set GROQ_API_KEY, restart the API, then use Reparse." });
      return;
    }
    await repo.setStatus(documentId, "parsing");
    try {
      if (doc.kind === "resume") {
        const parsed = await parseResume(llm, doc.raw_text, doc.user_id);
        await repo.saveResumeParse(documentId, parsed, computeYearsOfExperience(parsed.experience).years);
      } else {
        await repo.saveJobParse(documentId, await parseJob(llm, doc.raw_text, doc.user_id));
      }
      await onParsed(documentId); // indexing marks the document ready
    } catch (err) {
      if (err instanceof ParseError) {
        await repo.setStatus(documentId, "failed", { error: `${err.message} Use Reparse to try again.` });
        return;
      }
      log.error({ err, documentId }, "parsing failed");
      const busy = err instanceof LlmUnavailableError;
      await repo.setStatus(documentId, "failed", { error: busy ? "The AI service is busy or unreachable. Use Reparse in a moment." : "Processing failed. Use Reparse to try again." });
      throw err;
    }
  };
}

/** Queue handler: chunk a parsed document, embed the chunks and store them for search. */
export function createEmbedHandler(repo: DocumentRepo, embedder: Embedder, log: ErrorLog) {
  return async ({ documentId }: { documentId: string }) => {
    const src = await repo.getIndexSource(documentId);
    if (!src) return; // deleted meanwhile
    await repo.setStatus(documentId, "embedding");
    try {
      const chunks = src.parsed
        ? src.kind === "resume"
          ? chunkResume(src.parsed as ResumeParsed)
          : chunkJob(src.parsed as JobParsed, src.label ?? "Job", src.title, src.company)
        : chunkPlainText(src.rawText ?? "", src.kind === "resume" ? "Resume" : src.label ?? "Job");
      const vectors = await embedder.embed(chunks.map((c) => c.content), "passage");
      await repo.replaceChunks(src.userId, documentId, { type: src.kind, id: src.ownerId }, chunks.map((c, i) => ({ ...c, embedding: vectors[i]! })), embedder.model);
      await repo.setStatus(documentId, "ready");
    } catch (err) {
      log.error({ err, documentId }, "indexing failed");
      await repo.setStatus(documentId, "failed", { error: "The search index could not be built. Use Reparse in a moment." });
      throw err;
    }
  };
}
