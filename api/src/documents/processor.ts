import type { DocumentRepo } from "./repo.js";
import type { FileStorage } from "./storage.js";
import { detectFormat } from "./fileTypes.js";
import { ExtractionError, extractText, normalizeText } from "./extract.js";

/**
 * Queue handler: turn an uploaded file (or pasted text) into clean text.
 * Expected failures (unreadable or scanned files) are recorded on the document and are not retried.
 * Unexpected errors are rethrown so the queue retries them.
 */
export function createExtractHandler(repo: DocumentRepo, storage: FileStorage, log: Pick<Console, "error"> = console) {
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
