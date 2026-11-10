import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { Env } from "./config/env.js";
import { healthRoutes } from "./routes/health.js";

export interface AppDeps {
  env: Env;
  pool: pg.Pool;
}

export async function buildApp({ env, pool }: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    genReqId: (req) => (req.headers["x-request-id"] as string | undefined) ?? randomUUID(),
    bodyLimit: 1_048_576,
  });

  await app.register(helmet);
  await app.register(cors, { origin: env.CORS_ORIGIN.split(",") });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  // Consistent error shape: { error: { code, message } }. Internals are never leaked.
  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, req, reply) => {
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 500;
    if (status >= 500) req.log.error({ err }, "unhandled error");
    reply.status(status).send({
      error: {
        code: status === 500 ? "INTERNAL_ERROR" : (err.code ?? "BAD_REQUEST"),
        message: status === 500 ? "Something went wrong" : err.message,
      },
    });
  });
  app.setNotFoundHandler((_req, reply) =>
    reply.status(404).send({ error: { code: "NOT_FOUND", message: "Route not found" } }),
  );

  await app.register(healthRoutes(pool), { prefix: "/api/v1" });
  return app;
}
