import { useCallback, useState } from "react";
import { api, isPending, type AnalysisInfo, type JobInfo, type ResumeInfo } from "./api";
import { useAsyncList } from "./useAsyncList";

export interface CareerData {
  /** The newest resume. Dashboard, chat and "analyze all" use this one. */
  resume: ResumeInfo | null;
  /** Every resume, newest first. */
  resumes: ResumeInfo[];
  jobs: JobInfo[];
  /** One entry per resume and job pair that was compared. */
  analyses: AnalysisInfo[];
}

const load = async (): Promise<CareerData[]> => {
  const [resumes, jobs, analyses] = await Promise.all([api.listResumes(), api.listJobs(), api.listAnalyses()]);
  return [{ resume: resumes[0] ?? null, resumes, jobs, analyses }];
};

const stillProcessing = ([d]: CareerData[]) =>
  (d?.resumes.some((r) => isPending(r.status)) ?? false) || (d?.jobs.some((j) => isPending(j.status)) ?? false);

export const pairKey = (jobId: string, resumeId: string) => `${resumeId}:${jobId}`;

/** Resumes, jobs and their comparisons in one place, with an action to (re)run comparisons. */
export function useCareerData() {
  const { items, error, refresh } = useAsyncList(load, stillProcessing);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const data = items?.[0] ?? null;
  const newestResumeId = data?.resume?.id;

  /** Compare each job with the given resume (default: the newest). Resolves with the last comparison made. */
  const analyze = useCallback(async (jobIds: string[], resumeId?: string): Promise<AnalysisInfo | null> => {
    const rid = resumeId ?? newestResumeId;
    if (!rid) return null;
    setActionError(null);
    let last: AnalysisInfo | null = null;
    for (const id of jobIds) {
      const key = pairKey(id, rid);
      setBusy((b) => new Set(b).add(key));
      try {
        last = await api.analyze(id, rid);
        await refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Analysis failed");
        break;
      } finally {
        setBusy((b) => { const n = new Set(b); n.delete(key); return n; });
      }
    }
    return last;
  }, [newestResumeId, refresh]);

  return { data, error: actionError ?? error, busy, isBusy: (jobId: string, resumeId: string) => busy.has(pairKey(jobId, resumeId)), analyze };
}

export const readyJobs = (d: CareerData) => d.jobs.filter((j) => j.status === "ready");
export const readyResumes = (d: CareerData) => d.resumes.filter((r) => r.status === "ready");

/** Jobs that have no up-to-date comparison with the newest resume. */
export const needsAnalysis = (d: CareerData) =>
  readyJobs(d).filter((j) => { const a = d.analyses.find((x) => x.jobId === j.id && x.resumeId === d.resume?.id); return !a || a.stale; }).map((j) => j.id);

export const resumeLabel = (r: ResumeInfo) => r.parsed?.name ?? r.filename ?? "Resume";

/** Name plus file name and upload date, so two resumes with the same name can be told apart in a picker. */
export const resumeOption = (r: ResumeInfo) =>
  `${resumeLabel(r)} · ${r.filename ?? "sample data"} · ${new Date(r.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${new Date(r.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
