import type pg from "pg";
import type { JobParsed, ResumeParsed } from "../parsing/schemas.js";
import type { Chunk } from "../chunking/chunker.js";

export type DocKind = "resume" | "job";
export type DocStatus = "uploaded" | "extracting" | "extracted" | "parsing" | "embedding" | "ready" | "failed";

export interface DocumentRow {
  id: string;
  kind: DocKind;
  original_filename: string | null;
  storage_path: string | null;
  status: DocStatus;
  error: string | null;
  raw_text: string | null;
  created_at: Date;
}

export interface JobSummary {
  id: string;
  label: string;
  title: string | null;
  company: string | null;
  parsed: JobParsed | null;
  userEdited: boolean;
  document: DocumentRow;
}
export interface ResumeSummary {
  id: string;
  parsed: ResumeParsed | null;
  yearsExperience: number | null;
  userEdited: boolean;
  document: DocumentRow;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toResume = ({ owner_id, parsed, years_experience, user_edited, ...document }: any): ResumeSummary => ({
  id: owner_id,
  parsed,
  yearsExperience: years_experience === null ? null : Number(years_experience),
  userEdited: user_edited,
  document,
});

const DOC_COLS = "d.id, d.kind, d.original_filename, d.storage_path, d.status, d.error, d.raw_text, d.created_at";

/** Every query here filters on user_id. This is the isolation boundary. */
export class DocumentRepo {
  constructor(private readonly pool: pg.Pool) {}

  async createResume(userId: string, doc: { filename: string | null; mime: string | null; storagePath: string | null; sha256: string | null; rawText: string | null }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const d = await client.query<{ id: string }>(
        `INSERT INTO documents (user_id, kind, original_filename, mime_type, storage_path, sha256, raw_text)
         VALUES ($1, 'resume', $2, $3, $4, $5, $6) RETURNING id`,
        [userId, doc.filename, doc.mime, doc.storagePath, doc.sha256, doc.rawText],
      );
      const r = await client.query<{ id: string }>(
        "INSERT INTO resumes (user_id, document_id) VALUES ($1, $2) RETURNING id",
        [userId, d.rows[0]!.id],
      );
      await client.query("COMMIT");
      return { resumeId: r.rows[0]!.id, documentId: d.rows[0]!.id };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async createJob(
    userId: string,
    doc: { filename: string | null; mime: string | null; storagePath: string | null; sha256: string | null; rawText: string | null },
    meta: { title?: string; company?: string },
  ) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Serialize label allocation per user so "Job #n" stays unique under concurrent uploads.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
      const { rows: cnt } = await client.query<{ n: number }>("SELECT count(*)::int AS n FROM jobs WHERE user_id = $1", [userId]);
      const label = `Job #${cnt[0]!.n + 1}`;
      const d = await client.query<{ id: string }>(
        `INSERT INTO documents (user_id, kind, original_filename, mime_type, storage_path, sha256, raw_text)
         VALUES ($1, 'job', $2, $3, $4, $5, $6) RETURNING id`,
        [userId, doc.filename, doc.mime, doc.storagePath, doc.sha256, doc.rawText],
      );
      const j = await client.query<{ id: string }>(
        "INSERT INTO jobs (user_id, document_id, label, title, company) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [userId, d.rows[0]!.id, label, meta.title ?? null, meta.company ?? null],
      );
      await client.query("COMMIT");
      return { jobId: j.rows[0]!.id, documentId: d.rows[0]!.id, label };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async listResumes(userId: string): Promise<ResumeSummary[]> {
    const { rows } = await this.pool.query(
      `SELECT r.id AS owner_id, r.parsed, r.years_experience, r.user_edited, ${DOC_COLS} FROM resumes r JOIN documents d ON d.id = r.document_id
       WHERE r.user_id = $1 ORDER BY d.created_at DESC`,
      [userId],
    );
    return rows.map(toResume);
  }

  async getResume(userId: string, id: string): Promise<ResumeSummary | null> {
    const { rows } = await this.pool.query(
      `SELECT r.id AS owner_id, r.parsed, r.years_experience, r.user_edited, ${DOC_COLS} FROM resumes r JOIN documents d ON d.id = r.document_id
       WHERE r.user_id = $1 AND r.id = $2`,
      [userId, id],
    );
    return rows[0] ? toResume(rows[0]) : null;
  }

  async listJobs(userId: string): Promise<JobSummary[]> {
    const { rows } = await this.pool.query(
      `SELECT j.id AS owner_id, j.label, j.title, j.company, j.parsed, j.user_edited, ${DOC_COLS} FROM jobs j JOIN documents d ON d.id = j.document_id
       WHERE j.user_id = $1 ORDER BY j.created_at ASC`,
      [userId],
    );
    return rows.map(({ owner_id, label, title, company, parsed, user_edited, ...document }) => ({
      id: owner_id, label, title, company, parsed, userEdited: user_edited, document,
    }));
  }

  async getJob(userId: string, id: string): Promise<JobSummary | null> {
    return (await this.listJobs(userId)).find((j) => j.id === id) ?? null;
  }

  async getDocument(userId: string, id: string) {
    const { rows } = await this.pool.query<DocumentRow & { mime_type: string | null }>(
      `SELECT ${DOC_COLS} FROM documents d WHERE d.user_id = $1 AND d.id = $2`,
      [userId, id],
    );
    return rows[0] ?? null;
  }

  /** Deletes the document; resume/job rows, chunks and analyses cascade. Returns the stored file name. */
  async deleteDocument(userId: string, id: string): Promise<{ storagePath: string | null } | null> {
    const { rows } = await this.pool.query<{ storage_path: string | null }>(
      "DELETE FROM documents WHERE user_id = $1 AND id = $2 RETURNING storage_path",
      [userId, id],
    );
    return rows[0] ? { storagePath: rows[0].storage_path } : null;
  }

  async setStatus(id: string, status: DocStatus, patch: { error?: string | null; rawText?: string } = {}) {
    await this.pool.query(
      `UPDATE documents SET status = $2, error = $3, raw_text = COALESCE($4, raw_text), updated_at = now() WHERE id = $1`,
      [id, status, patch.error ?? null, patch.rawText ?? null],
    );
  }

  /** Worker-side lookup (not user-scoped: the job payload comes from our own queue, not from a request). */
  async getForProcessing(id: string) {
    const { rows } = await this.pool.query<{ kind: DocKind; storage_path: string | null; raw_text: string | null; original_filename: string | null }>(
      "SELECT kind, storage_path, raw_text, original_filename FROM documents WHERE id = $1",
      [id],
    );
    return rows[0] ?? null;
  }

  async saveResumeParse(documentId: string, parsed: ResumeParsed, years: number | null) {
    await this.pool.query(
      "UPDATE resumes SET parsed = $2, years_experience = $3, user_edited = false, version = version + 1 WHERE document_id = $1",
      [documentId, JSON.stringify(parsed), years],
    );
  }

  /** Title and company typed by the user at upload time win over what the model extracted. */
  async saveJobParse(documentId: string, parsed: JobParsed) {
    await this.pool.query(
      `UPDATE jobs SET parsed = $2, user_edited = false,
         title = COALESCE(NULLIF(title, ''), $3), company = COALESCE(NULLIF(company, ''), $4)
       WHERE document_id = $1`,
      [documentId, JSON.stringify(parsed), parsed.title, parsed.company],
    );
  }

  async updateResume(userId: string, id: string, parsed: ResumeParsed, years: number | null): Promise<boolean> {
    const r = await this.pool.query(
      "UPDATE resumes SET parsed = $3, years_experience = $4, user_edited = true, version = version + 1 WHERE user_id = $1 AND id = $2",
      [userId, id, JSON.stringify(parsed), years],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async updateJob(userId: string, id: string, patch: { title: string | null; company: string | null; parsed: JobParsed }): Promise<boolean> {
    const r = await this.pool.query(
      "UPDATE jobs SET title = $3, company = $4, parsed = $5, user_edited = true WHERE user_id = $1 AND id = $2",
      [userId, id, patch.title, patch.company, JSON.stringify(patch.parsed)],
    );
    return (r.rowCount ?? 0) > 0;
  }

  /** Everything the indexer needs to chunk a document, looked up by document id (worker side, not user-scoped). */
  async getIndexSource(documentId: string) {
    const { rows } = await this.pool.query<{
      user_id: string; kind: DocKind; raw_text: string | null; resume_id: string | null; resume_parsed: ResumeParsed | null;
      job_id: string | null; job_parsed: JobParsed | null; label: string | null; title: string | null; company: string | null;
    }>(
      `SELECT d.user_id, d.kind, d.raw_text, r.id AS resume_id, r.parsed AS resume_parsed,
              j.id AS job_id, j.parsed AS job_parsed, j.label, j.title, j.company
       FROM documents d
       LEFT JOIN resumes r ON r.document_id = d.id
       LEFT JOIN jobs j ON j.document_id = d.id
       WHERE d.id = $1`,
      [documentId],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      userId: r.user_id,
      kind: r.kind,
      rawText: r.raw_text,
      ownerId: (r.kind === "resume" ? r.resume_id : r.job_id) as string,
      parsed: (r.kind === "resume" ? r.resume_parsed : r.job_parsed) as ResumeParsed | JobParsed | null,
      label: r.label,
      title: r.title,
      company: r.company,
    };
  }

  /** Replace all chunks of a document atomically so searches never see a half-built index. */
  async replaceChunks(
    userId: string,
    documentId: string,
    owner: { type: DocKind; id: string },
    chunks: (Chunk & { embedding: number[] })[],
    embeddingModel: string,
  ) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM chunks WHERE document_id = $1", [documentId]);
      for (const c of chunks) {
        await client.query(
          `INSERT INTO chunks (user_id, document_id, owner_type, owner_id, section, ordinal, content, token_count, embedding, embedding_model)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector, $10)`,
          [userId, documentId, owner.type, owner.id, c.section, c.ordinal, c.content, c.tokenCount, `[${c.embedding.join(",")}]`, embeddingModel],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
