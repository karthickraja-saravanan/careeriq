import express, { type ErrorRequestHandler, type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import type { Logger } from "pino";
import { createLogger, serializers } from "./logging/logger.js";
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
import { interviewRoutes } from "./routes/interview.js";
import { InterviewService } from "./interview/service.js";
import { settingsRoutes } from "./routes/settings.js";
import { usageRoutes } from "./routes/usage.js";
import { UsageRepo } from "./llm/usage.js";
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
  /** Shared with the queue and LLM client so every log line goes through one place. Defaults to a new one from env. */
  logger?: Logger;
}

export function buildApp({ env, pool, storage, queue, embedder, llm, logger = createLogger(env) }: AppDeps): Express {
  const app = express();

  const httpLogger = pinoHttp({
    logger,
    // pino-http applies its own req/res serializers (full headers) unless told otherwise.
    serializers: { req: serializers.req, res: serializers.res },
    genReqId: (req) => (req.headers["x-request-id"] as string | undefined) ?? randomUUID(),
    // One line per request: "GET /api/v1/resumes 304 2ms". Level follows the outcome so errors stand out.
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
    customSuccessMessage: (req, res, ms) => `${req.method} ${req.url} ${res.statusCode} ${Math.round(ms)}ms`,
    customErrorMessage: (req, res, err) => `${req.method} ${req.url} ${res.statusCode} ${err.message}`,
    customReceivedMessage: undefined,
    // Probes hit these every few seconds; logging them would bury real traffic.
    autoLogging: { ignore: (req) => req.url === "/api/v1/health" || req.url === "/api/v1/ready" },
  });
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
  app.use("/api/v1", demoUser, interviewRoutes(new InterviewService(pool, docs, analyses, llm, env.LLM_MODEL_MAIN)));
  const chatRepo = new ChatRepo(pool);
  const chat = new ChatService(pool, chatRepo, docs, analyses, embedder, llm, { warn: (o, m) => logger.warn(o, m) });
  app.use("/api/v1", demoUser, chatRoutes(chatRepo, chat));
  app.use("/api/v1", demoUser, settingsRoutes(pool, docs, storage, queue));
  app.use("/api/v1", demoUser, usageRoutes(new UsageRepo(pool)));
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
