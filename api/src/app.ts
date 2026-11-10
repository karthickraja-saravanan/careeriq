import express, { type ErrorRequestHandler, type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { Env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { documentRoutes } from "./routes/documents.js";
import { demoUser } from "./auth/demoUser.js";
import { HttpError } from "./errors.js";
import { ZodError } from "zod";
import { DocumentRepo } from "./documents/repo.js";
import type { FileStorage } from "./documents/storage.js";
import type { JobQueue } from "./queue/jobQueue.js";
import type { Embedder } from "./embeddings/types.js";
import { searchRoutes } from "./routes/search.js";
import { analysisRoutes } from "./routes/analyses.js";
import { AnalysisService } from "./analysis/analyze.js";
import type { LlmClient } from "./llm/types.js";
import { chatRoutes } from "./routes/chat.js";
import { ChatRepo } from "./chat/repo.js";
import { ChatService } from "./chat/service.js";

export interface AppDeps {
  env: Env;
  pool: pg.Pool;
  storage: FileStorage;
  queue: JobQueue;
  embedder: Embedder;
  llm?: LlmClient;
}

export function buildApp({ env, pool, storage, queue, embedder, llm }: AppDeps): Express {
  const app = express();

  const httpLogger = pinoHttp({
    level: env.LOG_LEVEL,
    genReqId: (req) => (req.headers["x-request-id"] as string | undefined) ?? randomUUID(),
  });
  const logger = httpLogger.logger;
  app.use(httpLogger);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(",") }));
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/v1", healthRouter(pool));
  const docs = new DocumentRepo(pool);
  app.use("/api/v1", demoUser, searchRoutes(pool, embedder));
  const analyses = new AnalysisService(pool, docs, llm, env.LLM_MODEL_MAIN);
  app.use("/api/v1", demoUser, analysisRoutes(analyses));
  const chatRepo = new ChatRepo(pool);
  const chat = new ChatService(pool, chatRepo, docs, analyses, embedder, llm, { warn: (o, m) => logger.warn(o, m) });
  app.use("/api/v1", demoUser, chatRoutes(chatRepo, chat));
  app.use("/api/v1", demoUser, documentRoutes({ repo: docs, storage, queue, maxUploadBytes: env.MAX_UPLOAD_BYTES }));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  // Consistent error shape: { error: { code, message } }. Internals are never leaked.
  const onError: ErrorRequestHandler = (err, req, res, _next) => {
    let status = 500;
    let code = "INTERNAL_ERROR";
    let message = "Something went wrong";
    if (err instanceof HttpError) ({ status, code, message } = err);
    else if (err instanceof ZodError) {
      status = 400; code = "VALIDATION_ERROR";
      message = err.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message).join("; ");
    } else if (err?.code === "LIMIT_FILE_SIZE") {
      status = 413; code = "FILE_TOO_LARGE"; message = `File is larger than ${Math.round(env.MAX_UPLOAD_BYTES / 1_048_576)} MB.`;
    } else if (typeof err?.status === "number" && err.status < 500) {
      status = err.status; code = err.code ?? "BAD_REQUEST"; message = err.message;
    }
    if (status >= 500) req.log.error({ err }, "unhandled error");
    res.status(status).json({ error: { code, message } });
  };
  app.use(onError);

  return app;
}
