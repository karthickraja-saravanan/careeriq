import { HttpError } from "../errors.js";

export type FileFormat = "pdf" | "docx" | "txt";

const EXT_TO_FORMAT: Record<string, FileFormat> = { ".pdf": "pdf", ".docx": "docx", ".txt": "txt" };
export const MIME_BY_FORMAT: Record<FileFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

/**
 * Decide the file format from the extension AND the file's leading bytes.
 * The client-declared MIME type is ignored because it is trivially spoofed.
 */
export function detectFormat(filename: string, buf: Buffer): FileFormat {
  const dot = filename.lastIndexOf(".");
  const format = dot >= 0 ? EXT_TO_FORMAT[filename.slice(dot).toLowerCase()] : undefined;
  if (!format) throw new HttpError(415, "UNSUPPORTED_FILE_TYPE", "Only PDF, DOCX and TXT files are supported.");

  const head = buf.subarray(0, 5).toString("latin1");
  const ok =
    (format === "pdf" && head.startsWith("%PDF-")) ||
    (format === "docx" && buf[0] === 0x50 && buf[1] === 0x4b) || // zip container "PK"
    (format === "txt" && !buf.subarray(0, 1024).includes(0)); // no NUL bytes in text
  if (!ok) throw new HttpError(415, "FILE_CONTENT_MISMATCH", "The file content does not match its extension.");
  return format;
}
