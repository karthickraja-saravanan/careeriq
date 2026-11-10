/**
 * Loads the sample resume and three sample jobs through the real API (and so through the real LLM and
 * embedding model), replacing anything the demo user already has. Run: npm run eval:seed -w api
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { call } from "./client.js";

const samples = path.resolve(import.meta.dirname, "../../samples");
type Doc = { id: string; status: string; error: string | null };

for (const r of (await call<{ resumes: Doc[] }>("/resumes")).resumes) await call(`/resumes/${r.id}`, { method: "DELETE" });
for (const j of (await call<{ jobs: Doc[] }>("/jobs")).jobs) await call(`/jobs/${j.id}`, { method: "DELETE" });

const upload = async (route: string, file: string) => {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(await readFile(path.join(samples, file)))]), file);
  return call<{ id: string }>(route, { method: "POST", body: form });
};

await upload("/resumes", "resume-priya-nair.docx");
for (const f of ["job1-senior-backend-engineer.txt", "job2-full-stack-engineer.txt", "job3-platform-engineer.txt"]) await upload("/jobs", f);

const deadline = Date.now() + 180_000;
for (;;) {
  const docs = [...(await call<{ resumes: Doc[] }>("/resumes")).resumes, ...(await call<{ jobs: Doc[] }>("/jobs")).jobs];
  const failed = docs.find((d) => d.status === "failed");
  if (failed) throw new Error(`Processing failed: ${failed.error}`);
  if (docs.every((d) => d.status === "ready")) break;
  if (Date.now() > deadline) throw new Error("Timed out waiting for documents to be processed");
  await new Promise((r) => setTimeout(r, 2000));
}
console.log("Seeded 1 resume and 3 jobs; all ready.");
