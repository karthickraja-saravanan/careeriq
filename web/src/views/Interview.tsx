import { useEffect, useState } from "react";
import { api, type InterviewPrep } from "../api";
import { PageHead } from "../ui";
import { readyJobs, useCareerData } from "../useCareerData";

const KIND: Record<string, string> = { experience: "From your resume", gap: "Gap", technical: "Technical", behavioral: "Behavioral" };

export function Interview({ go }: { go: (v: string) => void }) {
  const { data } = useCareerData();
  const [preps, setPreps] = useState<InterviewPrep[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCite, setOpenCite] = useState<string | null>(null);

  useEffect(() => { api.listInterviewPreps().then(setPreps).catch(() => undefined); }, []);

  if (!data) return <PageHead title="Interview prep" lead="Loading your documents…" />;
  const jobs = readyJobs(data);
  const job = jobs.find((j) => j.id === selected) ?? jobs[0];
  const prep = job ? preps.find((p) => p.jobId === job.id) : undefined;
  const resumeReady = data.resume?.status === "ready";

  const generate = async () => {
    if (!job) return;
    setBusy(true); setError(null); setOpenCite(null);
    try {
      const p = await api.generateInterviewPrep(job.id);
      setPreps((l) => [...l.filter((x) => x.jobId !== job.id), p]);
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
            {jobs.map((j) => (<button key={j.id} className="pill" aria-pressed={j.id === job?.id} onClick={() => { setSelected(j.id); setOpenCite(null); setError(null); }}>{j.label} · {j.company ?? j.title ?? "Job"}</button>))}
          </div>
          {error && <p role="alert" className="chip bad notice">{error}</p>}
          {!prep ? (
            <div className="card">
              <h2>No questions yet for {job?.label}</h2>
              <p className="muted">Generating takes a few seconds. For the sharpest gap questions, run the comparison for this job first.</p>
              <div className="row"><button className="btn" type="button" disabled={busy} onClick={() => void generate()}>{busy ? "Generating…" : "Generate questions"}</button></div>
            </div>
          ) : (
            <section className="grid cols-2">
              <div className="grid">
                {prep.stale && <p className="chip warn notice" role="status">Your resume or this job changed since these were generated. Regenerate to refresh.</p>}
                {prep.report.questions.map((q) => (
                  <article className="card" key={q.question}>
                    <div className="row spread">
                      <h2>{q.question}</h2>
                      <span className="row">
                        <span className={`chip ${q.kind === "gap" ? "warn" : ""}`}>{KIND[q.kind]}</span>
                        {q.basedOn.map((c) => (<button key={c} type="button" className="chip cite" aria-label={`Show source ${c}`} onClick={() => setOpenCite(openCite === c ? null : c)}>{c}</button>))}
                      </span>
                    </div>
                    {q.why && <p className="caption">{q.why}</p>}
                    {q.structure && (<><span className="label">Suggested structure</span><p>{q.structure}</p></>)}
                    {q.basedOn.includes(openCite ?? "") && prep.report.sources[openCite!] && (
                      <blockquote className="source"><strong>{openCite} · {prep.report.sources[openCite!]!.section}</strong><span>{prep.report.sources[openCite!]!.content}</span></blockquote>
                    )}
                  </article>
                ))}
              </div>
              <div className="grid" style={{ alignSelf: "start" }}>
                <div className="card">
                  <h2>Topics to prepare</h2>
                  {prep.report.topics.length
                    ? <div className="chips">{prep.report.topics.map((t) => <span className={`chip ${t.verdict === "missing" ? "bad" : "warn"}`} key={t.requirement}>{t.requirement}</span>)}</div>
                    : <p className="caption">No gaps found in the latest comparison, or no comparison has been run for this job yet.</p>}
                  <p className="caption">Do not claim experience you lack. Interviewers respond well to an honest gap with a concrete plan.</p>
                </div>
                <button className="btn secondary" type="button" disabled={busy} onClick={() => void generate()}>{busy ? "Generating…" : "Regenerate questions"}</button>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
