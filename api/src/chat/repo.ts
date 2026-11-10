import type pg from "pg";
import type { ContextSource } from "./context.js";

export interface ConversationRow {
  id: string;
  title: string | null;
  createdAt: Date;
}
export interface MessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: ContextSource[] | null;
  latencyMs: Record<string, number> | null;
  createdAt: Date;
}

/** Every query filters on user_id: a conversation id from another user behaves as if it does not exist. */
export class ChatRepo {
  constructor(private readonly pool: pg.Pool) {}

  async createConversation(userId: string): Promise<ConversationRow> {
    const { rows } = await this.pool.query("INSERT INTO conversations (user_id) VALUES ($1) RETURNING id, title, created_at", [userId]);
    return { id: rows[0].id, title: rows[0].title, createdAt: rows[0].created_at };
  }

  async listConversations(userId: string): Promise<ConversationRow[]> {
    const { rows } = await this.pool.query(
      "SELECT id, title, created_at FROM conversations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
      [userId],
    );
    return rows.map((r) => ({ id: r.id, title: r.title, createdAt: r.created_at }));
  }

  async getConversation(userId: string, id: string): Promise<ConversationRow | null> {
    const { rows } = await this.pool.query("SELECT id, title, created_at FROM conversations WHERE user_id = $1 AND id = $2", [userId, id]);
    return rows[0] ? { id: rows[0].id, title: rows[0].title, createdAt: rows[0].created_at } : null;
  }

  async deleteConversation(userId: string, id: string): Promise<boolean> {
    const r = await this.pool.query("DELETE FROM conversations WHERE user_id = $1 AND id = $2", [userId, id]);
    return (r.rowCount ?? 0) > 0;
  }

  async setTitleIfEmpty(userId: string, id: string, title: string) {
    await this.pool.query("UPDATE conversations SET title = $3 WHERE user_id = $1 AND id = $2 AND title IS NULL", [userId, id, title]);
  }

  async messages(userId: string, conversationId: string): Promise<MessageRow[]> {
    const { rows } = await this.pool.query(
      "SELECT id, role, content, citations, latency_ms, created_at FROM messages WHERE user_id = $1 AND conversation_id = $2 ORDER BY created_at, id",
      [userId, conversationId],
    );
    return rows.map((r) => ({ id: r.id, role: r.role, content: r.content, citations: r.citations, latencyMs: r.latency_ms, createdAt: r.created_at }));
  }

  async addMessage(
    userId: string,
    conversationId: string,
    m: { role: "user" | "assistant"; content: string; chunkIds?: string[]; citations?: ContextSource[]; latencyMs?: Record<string, number>; tokens?: Record<string, number> },
  ): Promise<string> {
    const { rows } = await this.pool.query(
      `INSERT INTO messages (user_id, conversation_id, role, content, retrieved_chunk_ids, citations, latency_ms, tokens)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [userId, conversationId, m.role, m.content, m.chunkIds ?? [], m.citations ? JSON.stringify(m.citations) : null, m.latencyMs ? JSON.stringify(m.latencyMs) : null, m.tokens ? JSON.stringify(m.tokens) : null],
    );
    return rows[0].id;
  }
}
