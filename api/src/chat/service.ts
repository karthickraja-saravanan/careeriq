import type pg from "pg";
import { z } from "zod";
import { HttpError } from "../errors.js";
import type { DocumentRepo } from "../documents/repo.js";
import type { Embedder } from "../embeddings/types.js";
import { LlmUnavailableError, type ChatMessage, type LlmClient } from "../llm/types.js";
import { retrieveBalanced } from "../retrieval/search.js";
import type { AnalysisService } from "../analysis/analyze.js";
import { sanitizeCitations } from "./citations.js";
import { buildContext, estimateTokens, type ContextSource } from "./context.js";
import { resolveJobRefs } from "./jobRefs.js";
import { resolveResumeMentions } from "./resumeRefs.js";
import { CHAT_SYSTEM, NO_DOCUMENTS_REPLY, REWRITE_SYSTEM, buildChatUser, buildRewriteUser } from "./prompt.js";
import type { ChatRepo } from "./repo.js";

const CONTEXT_BUDGET_TOKENS = 6000;
const HISTORY_TURNS = 6;

export type ChatEvent =
  | { type: "token"; text: string }
  | { type: "done"; messageId: string; content: string; citations: ContextSource[]; grounded: boolean; latencyMs: Record<string, number> };

export interface ChatStart {
  meta: { rewritten: string | null; jobIds: string[]; resumeIds: string[] };
  events: AsyncGenerator<ChatEvent>;
}

const rewriteSchema = z.object({ question: z.string().trim().min(3).max(600) });

export class ChatService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly repo: ChatRepo,
    private readonly docs: DocumentRepo,
    private readonly analyses: AnalysisService,
    private readonly embedder: Embedder,
    private readonly llm: LlmClient | undefined,
    private readonly log: { warn: (o: object, m: string) => void } = { warn: () => undefined },
  ) {}

  /** Standalone version of a follow-up question. Fails open: on any error the original question is used. */
  private async rewrite(userId: string, history: { role: string; content: string }[], question: string): Promise<string | null> {
    if (history.length === 0 || !this.llm) return null;
    try {
      const raw = await this.llm.completeJson({ tier: "fast", meta: { userId, purpose: "chat_rewrite" }, system: REWRITE_SYSTEM, user: buildRewriteUser(history, question) });
      const out = rewriteSchema.parse(JSON.parse(raw)).question;
      return out === question ? null : out;
    } catch (err) {
      this.log.warn({ err }, "question rewrite failed, using original question");
      return null;
    }
  }

  /** Everything up to the first token (validation, rewrite, retrieval). Errors here are ordinary HTTP errors. */
  async start(userId: string, conversationId: string, question: string, signal?: AbortSignal): Promise<ChatStart> {
    if (!this.llm) throw new HttpError(503, "AI_NOT_CONFIGURED", "AI is not configured. Set GROQ_API_KEY and restart the API.");
    const llm = this.llm;
    if (!(await this.repo.getConversation(userId, conversationId))) throw new HttpError(404, "NOT_FOUND", "Conversation not found");

    // "@CV1" names a resume. Unknown ones are rejected before anything is stored or sent to the model.
    const allResumes = await this.docs.listResumes(userId);
    const mentions = resolveResumeMentions(question, allResumes.map((r) => ({ id: r.id, label: r.label })));
    if (mentions.unknown.length) {
      throw new HttpError(400, "UNKNOWN_RESUME", `You don't have ${mentions.unknown.join(", ")}. Type @ to pick one of your resumes.`);
    }
    const unready = allResumes.filter((r) => mentions.ids.includes(r.id) && r.document.status !== "ready");
    if (unready.length) {
      throw new HttpError(409, "RESUME_NOT_READY", `${unready.map((r) => r.label).join(", ")} is still being processed. Try again in a moment.`);
    }

    const t0 = Date.now();
    const history = (await this.repo.messages(userId, conversationId)).slice(-HISTORY_TURNS);
    await this.repo.addMessage(userId, conversationId, { role: "user", content: question });
    await this.repo.setTitleIfEmpty(userId, conversationId, question.length > 60 ? `${question.slice(0, 57)}...` : question);

    const rewritten = await this.rewrite(userId, history, mentions.text);
    const standalone = rewritten ?? mentions.text;
    const tRewrite = Date.now();

    const jobs = (await this.docs.listJobs(userId)).filter((j) => j.document.status === "ready");
    const jobInfos = jobs.map((j) => ({ id: j.id, label: j.label, title: j.title, company: j.company }));
    // Refs are resolved on the original text and the rewritten one: "what about the second one?" resolves after rewriting.
    const refs = [...new Set([...resolveJobRefs(question, jobInfos), ...resolveJobRefs(standalone, jobInfos)])];
    const jobIds = refs.length ? refs : jobInfos.map((j) => j.id);

    // No mention means the newest resume, as before. Mentioned resumes share the resume quota between them.
    const resumeIds = mentions.ids.length ? mentions.ids : allResumes[0] ? [allResumes[0].id] : [];
    const hits = await retrieveBalanced(this.pool, this.embedder, userId, standalone, {
      jobIds,
      resumeIds,
      resumeLimit: resumeIds.length > 1 ? 4 : 5,
      perJobLimit: 4,
    });
    const tRetrieve = Date.now();

    // Only stored analyses of the resumes being searched are quoted.
    const stored = (await this.analyses.list(userId)).filter((a) => !a.stale && resumeIds.includes(a.resumeId) && jobIds.includes(a.jobId));
    const resumeLabels = resumeIds.length > 1 ? new Map(allResumes.map((r) => [r.id, r.label])) : undefined;
    const withJobs = stored.flatMap((analysis) => {
      const job = jobInfos.find((j) => j.id === analysis.jobId);
      return job ? [{ analysis, job, resumeLabel: resumeLabels?.get(analysis.resumeId) }] : [];
    });
    const context = buildContext(hits, jobInfos, withJobs, CONTEXT_BUDGET_TOKENS, resumeLabels);
    const chunkIds = hits.map((h) => h.chunkId);
    const allowed = new Set(context.sources.map((s) => s.cite.toUpperCase()));
    const timings = { rewrite: tRewrite - t0, retrieve: tRetrieve - tRewrite };

    const finish = async (raw: string, extra: Record<string, number>, promptTokens: number): Promise<ChatEvent> => {
      const clean = sanitizeCitations(raw, allowed);
      if (clean.invalid.length) this.log.warn({ invalid: clean.invalid }, "removed citations that were not in the context");
      const citations = clean.cited.map((c) => context.sources.find((s) => s.cite.toUpperCase() === c)!);
      const latencyMs = { ...timings, ...extra, total: Date.now() - t0 };
      const messageId = await this.repo.addMessage(userId, conversationId, {
        role: "assistant",
        content: clean.text,
        chunkIds,
        citations,
        latencyMs,
        tokens: { prompt: promptTokens, completion: estimateTokens(raw) },
      });
      return { type: "done", messageId, content: clean.text, citations, grounded: citations.length > 0, latencyMs };
    };

    const meta = { rewritten, jobIds: refs, resumeIds: mentions.ids };

    if (context.sources.length === 0) {
      const events = async function* (): AsyncGenerator<ChatEvent> {
        yield { type: "token", text: NO_DOCUMENTS_REPLY };
        yield await finish(NO_DOCUMENTS_REPLY, {}, 0);
      };
      return { meta, events: events() };
    }

    const messages: ChatMessage[] = [
      { role: "system", content: CHAT_SYSTEM },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: buildChatUser(context.text, standalone) },
    ];
    const promptTokens = messages.reduce((n, m) => n + estimateTokens(m.content), 0);

    const events = async function* (): AsyncGenerator<ChatEvent> {
      let raw = "";
      let firstToken: number | null = null;
      try {
        for await (const piece of llm.streamChat({ tier: "main", meta: { userId, purpose: "chat" }, messages, signal })) {
          if (firstToken === null) firstToken = Date.now() - tRetrieve;
          raw += piece;
          yield { type: "token", text: piece };
        }
      } catch (err) {
        if (signal?.aborted) return;
        if (err instanceof LlmUnavailableError) throw new HttpError(503, "AI_UNAVAILABLE", "The AI service is busy or unreachable. Please try again in a moment.");
        throw err;
      }
      if (!raw.trim()) throw new HttpError(502, "AI_BAD_OUTPUT", "The AI returned an empty answer. Please try again.");
      yield await finish(raw, { firstToken: firstToken ?? 0 }, promptTokens);
    };
    return { meta, events: events() };
  }
}
