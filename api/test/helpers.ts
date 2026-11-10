import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { buildApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { createPool } from "../src/db/pool.js";
import { runMigrations } from "../src/db/migrate.js";
import { FileStorage } from "../src/documents/storage.js";
import { DocumentRepo } from "../src/documents/repo.js";
import { createEmbedHandler, createExtractHandler, createParseHandler } from "../src/documents/processor.js";
import { EMBED_QUEUE, EXTRACT_QUEUE, InlineQueue, PARSE_QUEUE, type JobQueue } from "../src/queue/jobQueue.js";
import type { Embedder } from "../src/embeddings/types.js";
import type { JsonCompletionRequest, LlmClient } from "../src/llm/types.js";

export const TEST_DB_URL = process.env.TEST_DATABASE_URL;
export const samples = (name: string) => path.resolve(__dirname, "../../samples", name);
export const fixtures = (name: string) => path.resolve(__dirname, "fixtures", name);

/** Scripted LLM: returns queued responses in order, or a default by document type. Records every request. */
export class FakeLlm implements LlmClient {
  calls: JsonCompletionRequest[] = [];
  constructor(public responses: (string | Error)[] = []) {}
  async completeJson(req: JsonCompletionRequest) {
    this.calls.push(req);
    const next = this.responses.shift();
    if (next instanceof Error) throw next;
    if (next !== undefined) return next;
    return req.system.includes('"requiredSkills"') ? JSON.stringify(FAKE_JOB) : JSON.stringify(FAKE_RESUME);
  }
}

/**
 * Deterministic stand-in for the real embedding model: hashes words into 384 buckets.
 * Texts that share words get similar vectors, which is enough to exercise indexing and ranking.
 * It does NOT measure real semantic quality; that is what the retrieval eval is for.
 */
export class HashEmbedder implements Embedder {
  readonly model = "hash-test";
  readonly dimensions = 384;
  failNext = false;
  async embed(texts: string[], _kind?: "passage" | "query") {
    if (this.failNext) { this.failNext = false; throw new Error("embedder down"); }
    return texts.map((t) => {
      const v = new Array<number>(384).fill(0);
      for (const w of t.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
        let h = 2166136261;
        for (const ch of w) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
        v[Math.abs(h) % 384]! += 1;
      }
      const norm = Math.hypot(...v) || 1;
      return v.map((x) => x / norm);
    });
  }
}

export const FAKE_RESUME = {
  name: "Priya Nair", headline: "Backend Engineer", summary: "Backend engineer with 5 years of experience.",
  skills: ["TypeScript", "Node.js", "PostgreSQL", "typescript"],
  experience: [
    { title: "Backend Engineer", company: "Finlytics", start: "2023", end: "present", bullets: ["Built billing APIs"] },
    { title: "Software Engineer", company: "Cartwheel", start: "2021", end: "2023", bullets: ["Shipped order tracking"] },
  ],
  projects: ["CSV validator"], education: ["B.Tech Computer Science, 2021"], certifications: ["AWS Cloud Practitioner"],
};
export const FAKE_JOB = {
  title: "Senior Backend Engineer", company: "Northwind Pay", summary: "Own payment services.",
  responsibilities: ["Build services"], requiredSkills: ["TypeScript", "Kafka"], preferredSkills: ["AWS"],
  experienceRequirement: "5+ years backend", minYears: 5,
};

export async function startTestApp(overrides: Record<string, string> = {}, llm: FakeLlm | null = new FakeLlm(), embedder: HashEmbedder = new HashEmbedder()) {
  const pool = createPool(TEST_DB_URL!);
  await runMigrations(pool, path.resolve(__dirname, "../migrations"));
  const storageDir = await mkdtemp(path.join(tmpdir(), "careeriq-"));
  const storage = new FileStorage(storageDir);
  const repo = new DocumentRepo(pool);
  const silent = { error: () => undefined };
  const queue: InlineQueue & JobQueue = new InlineQueue({
    [EXTRACT_QUEUE]: createExtractHandler(repo, storage, (documentId) => queue.enqueue(PARSE_QUEUE, { documentId }), silent),
    [PARSE_QUEUE]: createParseHandler(repo, llm ?? undefined, (documentId) => queue.enqueue(EMBED_QUEUE, { documentId }), silent),
    [EMBED_QUEUE]: createEmbedHandler(repo, embedder, silent),
  });
  const env = loadEnv({ DATABASE_URL: TEST_DB_URL!, LOG_LEVEL: "silent", ...overrides });
  const server: Server = buildApp({ env, pool, storage, queue, embedder }).listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  return {
    base, pool, repo, queue, storage, storageDir, llm, embedder,
    reset: async () => {
      await pool.query("TRUNCATE documents CASCADE");
      for (const f of await readdir(storageDir)) await rm(path.join(storageDir, f));
    },
    close: async () => { server.close(); await pool.end(); },
  };
}

export function form(file: { name: string; data: Buffer | string; type?: string }, fields: Record<string, string> = {}) {
  const f = new FormData();
  f.append("file", new Blob([new Uint8Array(typeof file.data === "string" ? Buffer.from(file.data) : file.data)], { type: file.type ?? "application/octet-stream" }), file.name);
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}
