import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { HttpError } from "../errors.js";
import type { ChatRepo } from "../chat/repo.js";
import type { ChatService } from "../chat/service.js";

const idParam = z.string().uuid();
const body = z.object({ content: z.string().trim().min(1, "Write a question first").max(2000, "Keep questions under 2000 characters") });

const send = (res: Response, event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

export function chatRoutes(repo: ChatRepo, service: ChatService): Router {
  const router = Router();

  router.post("/conversations", async (req, res) => {
    res.status(201).json(await repo.createConversation(req.userId));
  });

  router.get("/conversations", async (req, res) => {
    res.json({ conversations: await repo.listConversations(req.userId) });
  });

  router.get("/conversations/:id/messages", async (req, res) => {
    const id = idParam.parse(req.params.id);
    if (!(await repo.getConversation(req.userId, id))) throw new HttpError(404, "NOT_FOUND", "Conversation not found");
    res.json({ messages: await repo.messages(req.userId, id) });
  });

  router.delete("/conversations/:id", async (req, res) => {
    if (!(await repo.deleteConversation(req.userId, idParam.parse(req.params.id)))) throw new HttpError(404, "NOT_FOUND", "Conversation not found");
    res.status(204).end();
  });

  // Each answer costs LLM tokens, so this route has its own, tighter limit.
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many questions. Please wait a moment." } }),
  });

  router.post("/conversations/:id/messages", limiter, async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { content } = body.parse(req.body);

    const abort = new AbortController();
    res.on("close", () => { if (!res.writableFinished) abort.abort(); });

    // Anything thrown before the first byte is sent becomes a normal JSON error response.
    const { meta, events } = await service.start(req.userId, id, content, abort.signal);

    res.status(200).set({ "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" });
    res.flushHeaders();
    send(res, "meta", meta);
    try {
      for await (const ev of events) {
        if (ev.type === "token") send(res, "token", { text: ev.text });
        else send(res, "done", ev);
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        const known = err instanceof HttpError;
        if (!known) req.log.error({ err }, "chat stream failed");
        send(res, "error", { code: known ? err.code : "INTERNAL_ERROR", message: known ? err.message : "Something went wrong" });
      }
    }
    res.end();
  });

  return router;
}
