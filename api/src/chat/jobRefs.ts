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
