export interface ResumeRef {
  id: string;
  label: string; // "CV1"
}

export interface ResumeMentions {
  /** Resumes the question names, in the order first mentioned. */
  ids: string[];
  /** Mentions that match no resume of this user, e.g. "CV9". */
  unknown: string[];
  /** The question with "@CV1" / "@R1" replaced by the plain label "CV1", for the model and for search. */
  text: string;
}

// "@CV1" is the badge shown on the Resume page. "@R1" is accepted too because people type it that way.
const MENTION = /(^|[^\w@])@(?:CV|R)(\d+)\b/gi;

export function resolveResumeMentions(question: string, resumes: ResumeRef[]): ResumeMentions {
  const byLabel = new Map(resumes.map((r) => [r.label.toUpperCase(), r.id]));
  const ids: string[] = [];
  const unknown: string[] = [];
  const text = question.replace(MENTION, (_m, lead: string, n: string) => {
    const label = `CV${Number(n)}`;
    const id = byLabel.get(label);
    if (id) { if (!ids.includes(id)) ids.push(id); }
    else if (!unknown.includes(label)) unknown.push(label);
    return `${lead}${label}`;
  });
  return { ids, unknown, text };
}
