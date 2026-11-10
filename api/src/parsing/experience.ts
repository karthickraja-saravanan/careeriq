/** Year-only dates map to mid-year, so "2019 - 2022" counts as 3 years rather than 4. */
function toMonthIndex(value: string | null | undefined, now: Date): number | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (/^(present|current|now|ongoing|today)$/.test(v)) return now.getUTCFullYear() * 12 + now.getUTCMonth();
  const m = /^(\d{4})(?:-(\d{1,2}))?$/.exec(v);
  if (!m) return null;
  const year = Number(m[1]);
  if (year < 1970 || year > now.getUTCFullYear() + 1) return null;
  const month = m[2] ? Math.min(Math.max(Number(m[2]), 1), 12) - 1 : 5;
  return year * 12 + month;
}

/**
 * Total professional experience in years, from role dates.
 * Overlapping roles are merged so parallel jobs are not double counted.
 * Roles with unreadable dates are skipped (and reported), never guessed.
 */
export function computeYearsOfExperience(
  roles: { start: string | null; end: string | null }[],
  now: Date = new Date(),
): { years: number | null; skippedRoles: number } {
  const spans: [number, number][] = [];
  let skipped = 0;
  for (const r of roles) {
    const start = toMonthIndex(r.start, now);
    const end = toMonthIndex(r.end ?? "present", now);
    if (start === null || end === null || end < start) { skipped++; continue; }
    spans.push([start, end]);
  }
  if (spans.length === 0) return { years: null, skippedRoles: skipped };

  spans.sort((a, b) => a[0] - b[0]);
  let months = 0;
  let [curStart, curEnd] = spans[0]!;
  for (const [s, e] of spans.slice(1)) {
    if (s <= curEnd) curEnd = Math.max(curEnd, e);
    else { months += curEnd - curStart; [curStart, curEnd] = [s, e]; }
  }
  months += curEnd - curStart;
  return { years: Math.round((months / 12) * 10) / 10, skippedRoles: skipped };
}
