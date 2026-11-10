import { AnimatePresence, motion } from "motion/react";
import { Layers, ListChecks, RefreshCw } from "lucide-react";
import { FaqList } from "../interview/FaqList";
import { PracticeMode } from "../interview/PracticeMode";
import { AiButton } from "../AiButton";
import { useEffect, useState } from "react";
import { api, type InterviewPrep } from "../api";
import { PageHead } from "../ui";
import { readyJobs, readyResumes, resumeOption, useCareerData } from "../useCareerData";

export function Interview({ go }: { go: (v: string) => void }) {
  const { data } = useCareerData();
  const [preps, setPreps] = useState<InterviewPrep[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [resumeSel, setResumeSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"faq" | "practice">("faq");

  useEffect(() => { api.listInterviewPreps().then(setPreps).catch(() => undefined); }, []);

  if (!data) return <PageHead title="Interview prep" lead="Loading your documents…" />;
  const jobs = readyJobs(data);
  const job = jobs.find((j) => j.id === selected) ?? jobs[0];
  const resumes = readyResumes(data);
  const resume = resumes.find((r) => r.id === resumeSel) ?? resumes[0];
  const prep = job && resume ? preps.find((p) => p.jobId === job.id && p.resumeId === resume.id) : undefined;
  const resumeReady = resumes.length > 0;

  const generate = async () => {
    if (!job) return;
    setBusy(true); setError(null);
    try {
      const p = await api.generateInterviewPrep(job.id, resume?.id);
      setPreps((l) => [...l.filter((x) => !(x.jobId === p.jobId && x.resumeId === p.resumeId)), p]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="Interview prep" lead="Questions come from the role and from what your resume actually says. Where you have a gap, the advice is to say so and show how you would learn." />
      {!resumeReady || jobs.length === 0 ? (
        <div className="card">
          <p className="muted">{!resumeReady ? "Add and process your resume first." : "Add at least one job description first."}</p>
          <div className="row"><button className="btn" type="button" onClick={() => go(!resumeReady ? "resume" : "jobs")}>{!resumeReady ? "Go to resume" : "Go to jobs"}</button></div>
        </div>
      ) : (
        <>
          <div className="pill-select" role="group" aria-label="Choose a role">
            {jobs.map((j) => (<button key={j.id} className="pill" aria-pressed={j.id === job?.id} onClick={() => { setSelected(j.id); setError(null); }}>{j.label} · {j.company ?? j.title ?? "Job"}</button>))}
          </div>
          {resumes.length > 1 && (
            <label className="compare-pick">
              <span className="label">Prepare using resume</span>
              <select className="select" value={resume?.id ?? ""} onChange={(e) => { setResumeSel(e.target.value); }}>
                {resumes.map((r) => <option key={r.id} value={r.id}>{resumeOption(r)}</option>)}
              </select>
            </label>
          )}
          {error && <p role="alert" className="chip bad notice">{error}</p>}
          {!prep ? (
            <div className="card">
              <h2>No questions yet for {job?.label}</h2>
              <p className="muted">Generating takes a few seconds. For the sharpest gap questions, run the comparison for this job first.</p>
              <div className="row"><AiButton busy={busy} busyLabel="Generating…" onClick={() => void generate()}>Generate questions</AiButton></div>
            </div>
          ) : (
            <section className="iv-layout">
              <div className="iv-main">
                {prep.stale && <p className="chip warn notice" role="status">Your resume or this job changed since these were generated. Regenerate to refresh.</p>}
                <div className="seg" role="tablist" aria-label="View">
                  {([["faq", "Question list", ListChecks], ["practice", "Practice mode", Layers]] as const).map(([id, label, Icon]) => (
                    <button key={id} type="button" role="tab" aria-selected={mode === id} className="seg-item" onClick={() => setMode(id)}>
                      {mode === id && <motion.span layoutId="seg-pill" className="seg-pill" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                      <Icon size={16} aria-hidden="true" /><span>{label}</span>
                    </button>
                  ))}
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                    {mode === "faq" ? <FaqList report={prep.report} /> : <PracticeMode report={prep.report} />}
                  </motion.div>
                </AnimatePresence>
              </div>
              <aside className="iv-side">
                <div className="card">
                  <h2>Topics to prepare</h2>
                  {prep.report.topics.length
                    ? <div className="chips">{prep.report.topics.map((t) => <span className={`chip ${t.verdict === "missing" ? "bad" : "warn"}`} key={t.requirement}>{t.requirement}</span>)}</div>
                    : <p className="caption">No gaps found in the latest comparison, or no comparison has been run for this job yet.</p>}
                  <p className="caption">Do not claim experience you lack. Interviewers respond well to an honest gap with a concrete plan.</p>
                </div>
                <AiButton variant="secondary" icon={RefreshCw} busy={busy} busyLabel="Generating…" onClick={() => void generate()}>Regenerate questions</AiButton>
              </aside>
            </section>
          )}
        </>
      )}
    </>
  );
}
