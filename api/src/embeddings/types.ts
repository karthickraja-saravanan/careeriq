export interface Embedder {
  /** Stored with each chunk so a model change is detectable (and requires re-embedding). */
  readonly model: string;
  readonly dimensions: number;
  /** Passages are documents to index; queries are user questions (some models embed them differently). */
  embed(texts: string[], kind: "passage" | "query"): Promise<number[][]>;
}

export class EmbedderUnavailableError extends Error {}
