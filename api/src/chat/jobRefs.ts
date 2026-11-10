export interface JobRef {
  id: string;
  label: string;
  title: string | null;
  company: string | null;
}

/**
 * Which jobs does the question talk about? "Job #2", "job 2", the company name or the title.
 * Returns the matching job ids, or an empty list meaning "no specific job, use all of them".
 */
export function resolveJobRefs(question: string, jobs: JobRef[]): string[] {
  const q = question.toLowerCase();
  const numbers = new Set([...q.matchAll(/\bjobs?\s*#?\s*(\d+)\b/g)].map((m) => m[1]!));
  const matched = new Set<string>();
  for (const job of jobs) {
    const labelNumber = job.label.replace(/\D/g, "");
    if (labelNumber && numbers.has(labelNumber)) matched.add(job.id);
    for (const name of [job.company, job.title]) {
      const n = name?.trim().toLowerCase();
      if (n && n.length >= 4 && q.includes(n)) matched.add(job.id);
    }
  }
  return [...matched];
}

export interface JobMentions {
  ids: string[];
  /** Mentions that match no job of this user, e.g. "Job #9". */
  unknown: string[];
  /** The question with "@J2" / "@Job2" replaced by the plain label "Job #2". */
  text: string;
}

const JOB_MENTION = /(^|[^\w@])@(?:Job|J)\s?#?(\d+)\b/gi;

/** "@J2" is what the composer inserts. It names a job exactly, unlike the looser matching in resolveJobRefs. */
export function resolveJobMentions(question: string, jobs: JobRef[]): JobMentions {
  const byNumber = new Map(jobs.map((j) => [Number(j.label.replace(/\D/g, "")), j.id]));
  const ids: string[] = [];
  const unknown: string[] = [];
  const text = question.replace(JOB_MENTION, (_m, lead: string, n: string) => {
    const num = Number(n);
    const id = byNumber.get(num);
    if (id) { if (!ids.includes(id)) ids.push(id); }
    else if (!unknown.includes(`Job #${num}`)) unknown.push(`Job #${num}`);
    return `${lead}Job #${num}`;
  });
  return { ids, unknown, text };
}
