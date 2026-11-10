import { describe, expect, it } from "vitest";
import express from "express";
import { pinoHttp } from "pino-http";
import { createLogger, serializers } from "../src/logging/logger.js";
import { formatDevLine } from "../src/logging/devFormat.js";

function capture() {
  const lines: string[] = [];
  return { lines, stream: { write: (l: string) => void lines.push(l) } };
}

describe("logger", () => {
  it("redacts credentials even if a headers object is logged", () => {
    const { lines, stream } = capture();
    const log = createLogger({ NODE_ENV: "production", LOG_LEVEL: "info" }, stream);
    log.info({ headers: { cookie: "session=SECRET", authorization: "Bearer SECRET", accept: "x" } }, "oops");
    const out = lines.join("");
    expect(out).not.toContain("SECRET");
    expect(out).toContain("[redacted]");
  });

  it("logs one slim line per request: no headers, request id kept", async () => {
    const { lines, stream } = capture();
    const log = createLogger({ NODE_ENV: "production", LOG_LEVEL: "info" }, stream);
    const app = express();
    app.use(pinoHttp({
      logger: log,
      serializers: { req: serializers.req, res: serializers.res },
      genReqId: () => "req-123",
      customSuccessMessage: (req, res, ms) => `${req.method} ${req.url} ${res.statusCode} ${Math.round(ms)}ms`,
    }));
    app.get("/x", (_req, res) => void res.json({ ok: true }));
    const server = app.listen(0);
    const { port } = server.address() as { port: number };
    await fetch(`http://127.0.0.1:${port}/x`, { headers: { cookie: "session=SECRET", authorization: "Bearer SECRET" } });
    await new Promise((r) => server.close(r));

    const out = lines.join("");
    expect(out).not.toContain("SECRET");
    const rec = JSON.parse(lines[0]!);
    expect(rec.req).toEqual({ id: "req-123", method: "GET", url: "/x" });
    expect(rec.res).toEqual({ statusCode: 200 });
    expect(rec.msg).toMatch(/^GET \/x 200 \d+ms$/);
    expect(rec.req.headers).toBeUndefined();
  });

  it("serializers keep only id, method and url", () => {
    expect(serializers.req({ id: "a", method: "GET", url: "/", headers: { cookie: "x" } } as never)).toEqual({ id: "a", method: "GET", url: "/" });
  });
});

describe("dev formatter", () => {
  const line = (o: object) => JSON.stringify({ level: 30, time: Date.UTC(2026, 10, 10, 12, 0, 0), ...o });

  it("renders a request as a single short line", () => {
    const out = formatDevLine(line({ msg: "GET /api/v1/resumes 304 2ms", req: { id: "a1b2c3d4-ffff", method: "GET", url: "/" }, res: { statusCode: 304 }, responseTime: 2 }));
    expect(out).toMatch(/INFO\s+GET \/api\/v1\/resumes 304 2ms a1b2c3d4$/);
    expect(out.split("\n")).toHaveLength(1);
  });

  it("shows extra fields as key=value and errors with an indented stack", () => {
    const out = formatDevLine(line({ level: 50, msg: "parsing failed", documentId: "doc1", err: { message: "boom", stack: "Error: boom\n    at x" } }));
    expect(out).toContain("ERROR parsing failed documentId=doc1");
    expect(out).toContain("    Error: boom\n        at x");
  });

  it("passes non-JSON through", () => {
    expect(formatDevLine("plain text\n")).toBe("plain text");
  });
});
