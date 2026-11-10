import express, { type ErrorRequestHandler, type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { Env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";

export interface AppDeps {
  env: Env;
  pool: pg.Pool;
}

export function buildApp({ env, pool }: AppDeps): Express {
  const app = express();

  app.use(
    pinoHttp({
      level: env.LOG_LEVEL,
      genReqId: (req) => (req.headers["x-request-id"] as string | undefined) ?? randomUUID(),
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(",") }));
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/v1", healthRouter(pool));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  // Consistent error shape: { error: { code, message } }. Internals are never leaked.
  const onError: ErrorRequestHandler = (err, req, res, _next) => {
    const status = typeof err.status === "number" && err.status < 500 ? err.status : 500;
    if (status >= 500) req.log.error({ err }, "unhandled error");
    res.status(status).json({
      error: {
        code: status === 500 ? "INTERNAL_ERROR" : (err.code ?? "BAD_REQUEST"),
        message: status === 500 ? "Something went wrong" : err.message,
      },
    });
  };
  app.use(onError);

  return app;
}
