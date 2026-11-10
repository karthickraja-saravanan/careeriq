import type pg from "pg";

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
  document: DocumentRow;
}
export interface ResumeSummary {
  id: string;
  document: DocumentRow;
}

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
      `SELECT r.id AS owner_id, ${DOC_COLS} FROM resumes r JOIN documents d ON d.id = r.document_id
       WHERE r.user_id = $1 ORDER BY d.created_at DESC`,
      [userId],
    );
    return rows.map(({ owner_id, ...document }) => ({ id: owner_id, document }));
  }

  async getResume(userId: string, id: string): Promise<ResumeSummary | null> {
    const { rows } = await this.pool.query(
      `SELECT r.id AS owner_id, ${DOC_COLS} FROM resumes r JOIN documents d ON d.id = r.document_id
       WHERE r.user_id = $1 AND r.id = $2`,
      [userId, id],
    );
    const row = rows[0];
    if (!row) return null;
    const { owner_id, ...document } = row;
    return { id: owner_id, document };
  }

  async listJobs(userId: string): Promise<JobSummary[]> {
    const { rows } = await this.pool.query(
      `SELECT j.id AS owner_id, j.label, j.title, j.company, ${DOC_COLS} FROM jobs j JOIN documents d ON d.id = j.document_id
       WHERE j.user_id = $1 ORDER BY j.created_at ASC`,
      [userId],
    );
    return rows.map(({ owner_id, label, title, company, ...document }) => ({ id: owner_id, label, title, company, document }));
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
    const { rows } = await this.pool.query<{ storage_path: string | null; raw_text: string | null; original_filename: string | null }>(
      "SELECT storage_path, raw_text, original_filename FROM documents WHERE id = $1",
      [id],
    );
    return rows[0] ?? null;
  }
}
