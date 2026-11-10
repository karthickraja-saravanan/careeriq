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

export const api = {
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
  deleteJob: (id: string) => request<void>(`/jobs/${id}`, { method: "DELETE" }),
};
