export const API = process.env.API_URL ?? "http://localhost:3001/api/v1";

export async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status} ${body?.error?.message ?? ""}`);
  return body as T;
}
