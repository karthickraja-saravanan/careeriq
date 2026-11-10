import { pino, type DestinationStream, type Logger } from "pino";
import { devStream } from "./devFormat.js";

/**
 * Headers are never logged (see the req serializer below). These paths are a second line of defence:
 * if someone later logs a request or response object, credentials are still masked.
 */
export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "headers.authorization",
  "headers.cookie",
  'headers["set-cookie"]',
];

/** Only what is useful to find a request again: id, method, url. No headers, no query-string bodies. */
export const serializers = {
  req: (req: { id?: unknown; method?: string; url?: string }) => ({ id: req.id, method: req.method, url: req.url }),
  res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
  err: pino.stdSerializers.err,
};

export interface LoggerOptions {
  NODE_ENV: "development" | "test" | "production";
  LOG_LEVEL: string;
}

/**
 * One logger for the whole API.
 *  - development: short coloured lines, easy to scan in the terminal.
 *  - production / test: structured JSON, one object per line, ready for CloudWatch / Cloud Logging / Datadog.
 * `stream` is for tests that want to capture output.
 */
export function createLogger({ NODE_ENV, LOG_LEVEL }: LoggerOptions, stream?: DestinationStream): Logger {
  const destination = stream ?? (NODE_ENV === "development" ? devStream() : undefined);
  return pino(
    { level: LOG_LEVEL, base: { service: "careeriq-api" }, redact: { paths: REDACT_PATHS, censor: "[redacted]" }, serializers },
    destination,
  );
}
