export type DocStatus = "uploaded" | "extracting" | "extracted" | "parsing" | "embedding" | "ready" | "failed";

export interface DocInfo {
  id: string;
  documentId: string;
  filename: string | null;
  status: DocStatus;
  error: string | null;
  createdAt: string;
  textPreview?: string | null;
  text?: string | null;
}
export type Verdict = "met" | "partial" | "missing";
export interface RequirementResult {
  id: string; kind: "required" | "preferred"; requirement: string; verdict: Verdict; evidence: string[]; reason: string; adjusted?: string;
}
export interface MatchReport {
  score: number;
  components: { required: { score: number | null }; preferred: { score: number | null }; experience: { score: number | null } };
  requirements: RequirementResult[];
  experience: { requirement: string; verdict: Verdict; score: number; source: "dates" | "model"; candidateYears: number | null; requiredYears: number | null; evidence: string[]; reason: string } | null;
  strengths: string[]; concerns: string[]; recommendations: string[];
  sources: Record<string, { section: string; content: string }>;
}
export interface AnalysisInfo { id: string; jobId: string; score: number; report: MatchReport; createdAt: string; stale: boolean }

export interface InterviewQuestion { question: string; kind: "experience" | "gap" | "technical" | "behavioral"; why: string; structure: string; basedOn: string[] }
export interface InterviewPrep {
  id: string; jobId: string; createdAt: string; stale: boolean;
  report: { questions: InterviewQuestion[]; topics: { requirement: string; verdict: "missing" | "partial" }[]; sources: Record<string, { section: string; content: string }> };
}

export interface ResumeInfo extends DocInfo {
  parsed: ResumeParsed | null;
  yearsExperience: number | null;
  userEdited: boolean;
}
export interface JobInfo extends DocInfo {
  label: string;
  title: string | null;
  company: string | null;
  parsed: JobParsed | null;
  userEdited: boolean;
}

export const isPending = (s: DocStatus) => s !== "ready" && s !== "failed";

export interface ResumeParsed {
  name: string | null;
  headline: string | null;
  summary: string;
  skills: string[];
  experience: { title: string; company: string; start: string | null; end: string | null; bullets: string[] }[];
  projects: string[];
  education: string[];
  certifications: string[];
}
export interface JobParsed {
  title: string | null;
  company: string | null;
  summary: string;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  experienceRequirement: string | null;
  minYears: number | null;
}

const JSON_HEADERS = { "content-type": "application/json" };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, init);
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  return body as T;
}

const fileForm = (file: File, fields: Record<string, string> = {}) => {
  const f = new FormData();
  f.append("file", file);
  for (const [k, v] of Object.entries(fields)) if (v) f.append(k, v);
  return f;
};

export interface Source { cite: string; title: string; section: string; content: string }
export interface Conversation { id: string; title: string | null; createdAt: string }
export interface ChatMessage { id: string; role: "user" | "assistant"; content: string; citations: Source[] | null; latencyMs?: Record<string, number> | null }
export interface ChatDone { messageId: string; content: string; citations: Source[]; grounded: boolean; latencyMs: Record<string, number> }

export interface StreamHandlers {
  onMeta?: (m: { rewritten: string | null }) => void;
  onToken: (text: string) => void;
  onDone: (d: ChatDone) => void;
}

/** Ask a question and read the answer as it streams in (server-sent events over fetch). Throws on any failure. */
export async function streamAnswer(conversationId: string, content: string, h: StreamHandlers, signal?: AbortSignal): Promise<void> {
  const res = await fetch(`/api/v1/conversations/${conversationId}/messages`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ content }), signal });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const raw = /^data: (.*)$/m.exec(block)?.[1];
      if (!event || raw === undefined) continue;
      const data = JSON.parse(raw);
      if (event === "meta") h.onMeta?.(data);
      else if (event === "token") h.onToken(data.text);
      else if (event === "done") { finished = true; h.onDone(data); }
      else if (event === "error") throw new Error(data.message ?? "Something went wrong");
    }
  }
  if (!finished) throw new Error("The answer was cut off. Please try again.");
}

export const api = {
  listInterviewPreps: () => request<{ preps: InterviewPrep[] }>("/interview-preps").then((r) => r.preps),
  generateInterviewPrep: (jobId: string) => request<InterviewPrep>("/interview-preps", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ jobId }) }),
  seedDemoData: () => request<{ resumes: number; jobs: number }>("/settings/seed-demo-data", { method: "POST" }),
  clearAllData: () => request<void>("/settings/data", { method: "DELETE" }),
  listConversations: () => request<{ conversations: Conversation[] }>("/conversations").then((r) => r.conversations),
  createConversation: () => request<Conversation>("/conversations", { method: "POST" }),
  conversationMessages: (id: string) => request<{ messages: ChatMessage[] }>(`/conversations/${id}/messages`).then((r) => r.messages),
  deleteConversation: (id: string) => request<void>(`/conversations/${id}`, { method: "DELETE" }),

  listResumes: () => request<{ resumes: ResumeInfo[] }>("/resumes").then((r) => r.resumes),
  getResume: (id: string) => request<ResumeInfo>(`/resumes/${id}`),
  saveResume: (id: string, parsed: ResumeParsed) => request<ResumeInfo>(`/resumes/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ parsed }) }),
  reparseResume: (id: string) => request<void>(`/resumes/${id}/reparse`, { method: "POST" }),
  uploadResume: (file: File) => request<{ id: string }>("/resumes", { method: "POST", body: fileForm(file) }),
  deleteResume: (id: string) => request<void>(`/resumes/${id}`, { method: "DELETE" }),

  listJobs: () => request<{ jobs: JobInfo[] }>("/jobs").then((r) => r.jobs),
  addJobText: (text: string, title: string, company: string) =>
    request<{ id: string }>("/jobs", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ text, title: title || undefined, company: company || undefined }),
    }),
  addJobFile: (file: File, title: string, company: string) =>
    request<{ id: string }>("/jobs", { method: "POST", body: fileForm(file, { title, company }) }),
  saveJob: (id: string, title: string | null, company: string | null, parsed: JobParsed) =>
    request<JobInfo>(`/jobs/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ title, company, parsed }) }),
  reparseJob: (id: string) => request<void>(`/jobs/${id}/reparse`, { method: "POST" }),
  listAnalyses: () => request<{ analyses: AnalysisInfo[] }>("/analyses").then((r) => r.analyses),
  analyze: (jobId: string) => request<AnalysisInfo>("/analyses", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ jobId }) }),
  deleteJob: (id: string) => request<void>(`/jobs/${id}`, { method: "DELETE" }),
};
