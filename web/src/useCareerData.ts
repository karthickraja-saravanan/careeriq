import { useCallback, useState } from "react";
import { api, isPending, type AnalysisInfo, type JobInfo, type ResumeInfo } from "./api";
import { useAsyncList } from "./useAsyncList";

export interface CareerData { resume: ResumeInfo | null; jobs: JobInfo[]; analyses: AnalysisInfo[] }

const load = async (): Promise<CareerData[]> => {
  const [resumes, jobs, analyses] = await Promise.all([api.listResumes(), api.listJobs(), api.listAnalyses()]);
  return [{ resume: resumes[0] ?? null, jobs, analyses }];
};

const stillProcessing = ([d]: CareerData[]) => (d?.resume ? isPending(d.resume.status) : false) || (d?.jobs.some((j) => isPending(j.status)) ?? false);

/** Resume, jobs and their analyses in one place, with actions to (re)run analyses. */
export function useCareerData() {
  const { items, error, refresh } = useAsyncList(load, stillProcessing);
  const [busyJobs, setBusyJobs] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const analyze = useCallback(async (jobIds: string[]) => {
    setActionError(null);
    for (const id of jobIds) {
      setBusyJobs((b) => new Set(b).add(id));
      try {
        await api.analyze(id);
        await refresh();
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Analysis failed");
        break;
      } finally {
        setBusyJobs((b) => { const n = new Set(b); n.delete(id); return n; });
      }
    }
  }, [refresh]);

  return { data: items?.[0] ?? null, error: actionError ?? error, busyJobs, analyze };
}

export const readyJobs = (d: CareerData) => d.jobs.filter((j) => j.status === "ready");
export const needsAnalysis = (d: CareerData) =>
  readyJobs(d).filter((j) => { const a = d.analyses.find((x) => x.jobId === j.id); return !a || a.stale; }).map((j) => j.id);
