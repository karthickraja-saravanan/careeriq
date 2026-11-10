import { PgBoss } from "pg-boss";

export type Handler = (payload: { documentId: string }) => Promise<void>;

/** Minimal queue contract so the app does not depend on pg-boss directly (and tests can run inline). */
export interface JobQueue {
  enqueue(queue: string, payload: { documentId: string }): Promise<void>;
  stop(): Promise<void>;
}

export const EXTRACT_QUEUE = "extract-document";
export const PARSE_QUEUE = "parse-document";
export const EMBED_QUEUE = "embed-document";

/** Durable queue stored in Postgres: retries with backoff, survives API restarts, no Redis needed. */
export async function startPgBossQueue(connectionString: string, handlers: Record<string, Handler>): Promise<JobQueue> {
  const boss = new PgBoss(connectionString);
  boss.on("error", (err) => console.error("pg-boss error", err));
  await boss.start();
  for (const [name, handler] of Object.entries(handlers)) {
    await boss.createQueue(name);
    await boss.work<{ documentId: string }>(name, async (jobs) => {
      for (const job of jobs) await handler(job.data);
    });
  }
  return {
    async enqueue(queue, payload) {
      await boss.send(queue, payload, { retryLimit: 2, retryDelay: 5, retryBackoff: true });
    },
    stop: () => boss.stop({ graceful: true, timeout: 10_000 }),
  };
}

/** Test/dev helper: runs the handler immediately and lets callers await completion. */
export class InlineQueue implements JobQueue {
  private pending: Promise<void>[] = [];
  constructor(private readonly handlers: Record<string, Handler>) {}
  async enqueue(queue: string, payload: { documentId: string }) {
    this.pending.push(this.handlers[queue]!(payload).catch(() => undefined));
  }
  async drain() {
    // Handlers can enqueue follow-up work, so keep going until nothing is pending.
    while (this.pending.length) {
      const batch = this.pending;
      this.pending = [];
      await Promise.all(batch);
    }
  }
  async stop() {
    await this.drain();
  }
}
