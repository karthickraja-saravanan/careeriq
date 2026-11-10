import { EmbedderUnavailableError, type Embedder } from "./types.js";

const MODEL_ID = "Xenova/bge-small-en-v1.5";
const DIMENSIONS = 384;
const BATCH_SIZE = 16;
// bge models retrieve better when the question (not the passage) carries this instruction.
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

type Extractor = (texts: string[], opts: { pooling: "cls"; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

/**
 * Local embeddings with bge-small-en-v1.5 (384 dimensions) via Transformers.js / ONNX Runtime.
 * No API key and no per-call cost. The model (~130 MB) is downloaded on first use into `cacheDir`.
 */
export function createTransformersEmbedder(cacheDir: string): Embedder {
  let extractor: Promise<Extractor> | undefined;

  const load = () => {
    extractor ??= (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.cacheDir = cacheDir;
      return (await pipeline("feature-extraction", MODEL_ID, { dtype: "q8" })) as unknown as Extractor;
    })().catch((err) => {
      extractor = undefined; // allow a retry on the next call
      throw new EmbedderUnavailableError(`Could not load the embedding model: ${(err as Error).message}`);
    });
    return extractor;
  };

  return {
    model: `${MODEL_ID}:q8`,
    dimensions: DIMENSIONS,
    async embed(texts, kind) {
      if (texts.length === 0) return [];
      const run = await load();
      const inputs = kind === "query" ? texts.map((t) => QUERY_PREFIX + t) : texts;
      const out: number[][] = [];
      for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
        const tensor = await run(inputs.slice(i, i + BATCH_SIZE), { pooling: "cls", normalize: true });
        out.push(...tensor.tolist());
      }
      return out;
    },
  };
}
