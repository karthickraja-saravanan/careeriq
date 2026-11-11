import { AiButton } from "../AiButton";
import type { JobInfo } from "../api";
import { PageHead, Ring, scoreTone } from "../ui";
import { needsAnalysis, readyJobs, useCareerData } from "../useCareerData";

/** "Good morning" / "Good afternoon" / "Good evening" from the viewer's local clock. */
export function greeting(date = new Date()): string {
  const h = date.getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function Dashboard({ go, ask }: { go: (v: string) => void; ask: (question: string) => void }) {
  const { data, error, busy, analyze } = useCareerData();
  if (!data) return <PageHead title={greeting()} lead="Loading your documents…" />;

  const { resume, jobs, analyses } = data;
  const resumeReady = resume?.status === "ready" && resume.parsed;
  // The dashboard summarises the newest resume; comparisons for other resumes are on the Compare page.
  const ranked = analyses
    .filter((a) => a.resumeId === resume?.id)
    .map((a) => ({ a, job: jobs.find((j) => j.id === a.jobId) }))
    .filter((x): x is { a: typeof analyses[number]; job: JobInfo } => !!x.job)
    .sort((x, y) => y.a.score - x.a.score);
  const todo = needsAnalysis(data);
  const best = ranked[0];

  const gaps = new Map<string, number>();
  ranked.forEach(({ a }) => a.report.requirements.filter((r) => r.kind === "required" && r.verdict === "missing").forEach((r) => gaps.set(r.requirement, (gaps.get(r.requirement) ?? 0) + 1)));
  const topGaps = [...gaps.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
  const gapQuestion = () =>
    `${resume ? `@${resume.label} has` : "My resume has"} no evidence for these required skills: ${topGaps.map(([s, n]) => `${s} (${n} ${n === 1 ? "role" : "roles"})`).join(", ")}. ` +
    "Which should I learn first to improve my chances, and what is the quickest way to build evidence for each (projects, courses, or changes to my resume)?";

  const firstName = resume?.parsed?.name?.trim().split(/\s+/)[0];
  const lead = !resumeReady ? "Start by adding your resume and a few job descriptions."
    : best ? `${best.job.label} at ${best.job.company ?? best.job.title} is your closest fit.`
    : "Your resume is ready. Analyze your roles to see how you compare.";

  return (
    <>
      <PageHead title={resumeReady && firstName ? `${greeting()}, ${firstName}` : greeting()} lead={lead} />
      {error && <p role="alert" className="chip bad notice">{error}</p>}
      <section className="grid cols-3" aria-label="Summary">
        <div className="card tight"><span className="label">Resume{resume ? ` · ${resume.label}` : ""}</span>
          <h2>{resumeReady ? (resume.parsed!.headline ?? resume.parsed!.name ?? "Resume ready") : resume ? "Processing…" : "Not added"}</h2>
          <span className="caption">{resumeReady ? `${resume.parsed!.skills.length} skills${resume.yearsExperience !== null ? ` · about ${resume.yearsExperience} years` : ""}` : "Upload a PDF or DOCX"}</span>
          {resume && <span className="caption">{resume.filename ?? "Pasted text"} · uploaded {new Date(resume.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{data.resumes.length > 1 ? ` · newest of ${data.resumes.length}` : ""}</span>}</div>
        <div className="card tight"><span className="label">Roles tracked</span><h2 className="num">{jobs.length}</h2><span className="caption">{readyJobs(data).length} ready to compare</span></div>
        <div className="card tight"><span className="label">Best match</span><h2 className="num">{best ? `${best.a.score} / 100` : "Not yet"}</h2><span className="caption">{best ? `${best.job.title ?? ""}, ${best.job.company ?? ""}` : "Run an analysis"}</span></div>
      </section>

      {!resumeReady && <div className="dropzone"><h2>Add your resume</h2><p className="caption">Everything else builds on it.</p><button className="btn" onClick={() => go("resume")}>Go to Resume</button></div>}
      {resumeReady && jobs.length === 0 && <div className="dropzone"><h2>Add a job to compare</h2><p className="caption">Two or three roles make the comparison useful.</p><button className="btn" onClick={() => go("jobs")}>Go to Jobs</button></div>}

      {resumeReady && todo.length > 0 && (
        <div className="card tight row spread">
          <span>{todo.length} {todo.length === 1 ? "role needs" : "roles need"} an analysis.</span>
          <AiButton busy={busy.size > 0} busyLabel="Analyzing…" onClick={() => void analyze(todo)}>Analyze all roles</AiButton>
        </div>
      )}

      {ranked.length > 0 && (
        <section className="grid cols-2">
          <div className="card">
            <h2>Roles ranked by fit</h2>
            <div>
              {ranked.map(({ a, job }) => (
                <div className="rank" key={a.id}>
                  <Ring score={a.score} />
                  <div className="grow">
                    <h3>{job.title ?? "Untitled role"}</h3>
                    <p className="caption">{job.label} · {job.company ?? "Company not set"} · {scoreTone(a.score).label}{a.stale ? " · out of date" : ""}</p>
                  </div>
                  <button className="btn secondary" onClick={() => go(`compare/${a.id}`)}>Details</button>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h2>Required skills with no evidence</h2>
            <p className="caption">Counted across your analyzed roles. A skill that several roles ask for is worth learning first.</p>
            {topGaps.length ? <div className="chips">{topGaps.map(([s, n]) => <span className="chip bad" key={s}>{s} · {n} {n === 1 ? "role" : "roles"}</span>)}</div> : <p className="caption">No gaps found.</p>}
            <div className="row"><button className="btn" disabled={topGaps.length === 0} onClick={() => ask(gapQuestion())}>Ask what to improve</button></div>
          </div>
        </section>
      )}
    </>
  );
}
