/**
 * Retrieval hit-rate eval. For each golden question, search the user's indexed documents and check that
 * a chunk containing the expected text appears in the top K results of the relevant document.
 * Needs the API running with the sample documents seeded (npm run eval:seed). Run: npm run eval:retrieval -w api
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { call } from "./client.js";

interface Golden { question: string; job?: string; owner?: "resume"; contains: string }
interface Hit { ownerType: "resume" | "job"; ownerId: string; content: string }

const TOP_K = Number(process.env.TOP_K ?? 3);
const golden: Golden[] = JSON.parse(await readFile(path.resolve(import.meta.dirname, "golden.json"), "utf8"));
const jobs = (await call<{ jobs: { id: string; label: string }[] }>("/jobs")).jobs;

let hits = 0;
for (const g of golden) {
  const job = g.job ? jobs.find((j) => j.label === g.job) : undefined;
  if (g.job && !job) throw new Error(`${g.job} not found. Run npm run eval:seed first.`);
  const res = await call<{ hits: Hit[] }>(`/search?q=${encodeURIComponent(g.question)}${job ? `&job=${job.id}` : ""}`);
  const pool = res.hits.filter((h) => (job ? h.ownerType === "job" : h.ownerType === "resume"));
  const ok = pool.slice(0, TOP_K).some((h) => h.content.toLowerCase().includes(g.contains.toLowerCase()));
  if (ok) hits++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${g.question}  (expects "${g.contains}")`);
}
const rate = hits / golden.length;
console.log(`\nHit rate @${TOP_K}: ${hits}/${golden.length} = ${(rate * 100).toFixed(0)}%`);
process.exit(rate >= Number(process.env.MIN_HIT_RATE ?? 0.8) ? 0 : 1);
