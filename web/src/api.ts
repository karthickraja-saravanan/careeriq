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
export interface JobInfo extends DocInfo {
  label: string;
  title: string | null;
  company: string | null;
}

export const isPending = (s: DocStatus) => s === "uploaded" || s === "extracting";

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
  listResumes: () => request<{ resumes: DocInfo[] }>("/resumes").then((r) => r.resumes),
  getResume: (id: string) => request<DocInfo>(`/resumes/${id}`),
  uploadResume: (file: File) => request<{ id: string }>("/resumes", { method: "POST", body: fileForm(file) }),
  deleteResume: (id: string) => request<void>(`/resumes/${id}`, { method: "DELETE" }),

  listJobs: () => request<{ jobs: JobInfo[] }>("/jobs").then((r) => r.jobs),
  addJobText: (text: string, title: string, company: string) =>
    request<{ id: string }>("/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, title: title || undefined, company: company || undefined }),
    }),
  addJobFile: (file: File, title: string, company: string) =>
    request<{ id: string }>("/jobs", { method: "POST", body: fileForm(file, { title, company }) }),
  deleteJob: (id: string) => request<void>(`/jobs/${id}`, { method: "DELETE" }),
};
