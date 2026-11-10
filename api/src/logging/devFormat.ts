/**
 * Dev-only log formatter: turns pino's JSON lines into one short, coloured line each.
 *
 *   14:02:11.532 INFO  GET /api/v1/resumes 304 2ms  a1b2c3d4
 *   14:02:13.870 INFO  llm call  purpose=chat model=llama-3.3-70b-versatile tokens=1204/210 latencyMs=850
 *   14:02:14.001 ERROR parsing failed  documentId=9f3c...
 *       Error: boom
 *           at ...
 *
 * Production keeps raw JSON (one object per line) for log aggregators; see logger.ts.
 * Not a dependency on purpose: it is ~60 lines and works without `npm install`.
 * If you want more features, `pino-pretty` is a drop-in replacement for this file.
 */

const LEVELS: Record<number, { label: string; color: string }> = {
  10: { label: "TRACE", color: "90" },
  20: { label: "DEBUG", color: "36" },
  30: { label: "INFO ", color: "32" },
  40: { label: "WARN ", color: "33" },
  50: { label: "ERROR", color: "31" },
  60: { label: "FATAL", color: "35" },
};

/** Keys that are either already in the headline or are noise in a terminal. */
const HIDDEN = new Set(["level", "time", "msg", "pid", "hostname", "service", "req", "res", "responseTime", "err"]);

export interface DevFormatOptions {
  color?: boolean;
}

export function formatDevLine(line: string, { color = false }: DevFormatOptions = {}): string {
  const paint = (code: string, s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);

  let rec: Record<string, unknown>;
  try {
    rec = JSON.parse(line);
  } catch {
    return line.trimEnd(); // not JSON (e.g. a stray library write): pass through untouched
  }

  const time = typeof rec.time === "number" ? new Date(rec.time) : new Date();
  const clock = time.toTimeString().slice(0, 8) + "." + String(time.getMilliseconds()).padStart(3, "0");
  const lvl = LEVELS[rec.level as number] ?? LEVELS[30]!;

  const parts = [paint("90", clock), paint(lvl.color, lvl.label), String(rec.msg ?? "")];

  const req = rec.req as { id?: unknown } | undefined;
  if (req?.id) parts.push(paint("90", String(req.id).slice(0, 8)));

  const extras = Object.entries(rec)
    .filter(([k]) => !HIDDEN.has(k))
    .map(([k, v]) => `${paint("90", k + "=")}${short(v)}`);
  if (extras.length) parts.push(extras.join(" "));

  let out = parts.join(" ");
  const err = rec.err as { stack?: string; message?: string } | undefined;
  if (err) {
    const detail = (err.stack ?? err.message ?? "").split("\n").map((l) => "    " + l).join("\n");
    out += "\n" + paint("31", detail);
  }
  return out;
}

function short(v: unknown): string {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  const clipped = s.length > 100 ? s.slice(0, 97) + "..." : s;
  return /\s/.test(clipped) ? JSON.stringify(clipped) : clipped;
}

/** A pino destination: anything with write(). pino calls it once per log line. */
export function devStream(out: NodeJS.WriteStream = process.stdout) {
  const color = Boolean(out.isTTY) && !process.env.NO_COLOR;
  return { write: (line: string) => void out.write(formatDevLine(line, { color }) + "\n") };
}
