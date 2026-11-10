import { RefreshCw } from "lucide-react";
import { AiButton } from "../AiButton";
import { useState } from "react";
import type { AnalysisInfo, JobInfo, MatchReport, RequirementResult, Verdict } from "../api";
import { Bar, Bullets, PageHead, Ring, scoreTone } from "../ui";
import { resumeLabel, useCareerData } from "../useCareerData";

const VERDICT: Record<Verdict, { label: string; cls: string; mark: string }> = {
  met: { label: "Evidenced", cls: "good", mark: "✓" },
  partial: { label: "Partly evidenced", cls: "warn", mark: "◐" },
  missing: { label: "No evidence", cls: "bad", mark: "✕" },
};

export function Compare({ go, selectedId }: { go: (v: string) => void; selectedId: string | null }) {
  const { data, error, isBusy, analyze } = useCareerData();

  if (!data) return <PageHead title="Comparisons" lead="Loading your documents…" />;

  const jobById = new Map(data.jobs.map((j) => [j.id, j]));
  const resumeById = new Map(data.resumes.map((r) => [r.id, r]));
  const rows = [...data.analyses]
    .filter((a) => jobById.has(a.jobId) && resumeById.has(a.resumeId))
    .sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt));
  const selected = rows.find((a) => a.id === selectedId) ?? rows[0];
  const job = selected ? jobById.get(selected.jobId) : undefined;
  const resume = selected ? resumeById.get(selected.resumeId) : undefined;

  const lead = "Each comparison pairs one resume with one job. A skill only counts as matched when the resume text backs it up; anything else counts as missing.";

  return (
    <>
      <PageHead title="Comparisons" lead={lead} action={<button className="btn secondary" onClick={() => go("jobs")}>New comparison</button>} />
      {error && <p role="alert" className="chip bad notice">{error}</p>}
      {rows.length === 0 ? (
        <div className="dropzone">
          <h2>No comparisons yet</h2>
          <p className="caption">
            {data.resumes.length === 0 ? "Add a resume first, then pick a job and compare." : data.jobs.length === 0 ? "Add a job, then pick a resume and compare." : "Open Jobs, choose a job and a resume, then press Compare."}
          </p>
          <button className="btn" onClick={() => go(data.resumes.length === 0 ? "resume" : "jobs")}>{data.resumes.length === 0 ? "Go to Resume" : "Go to Jobs"}</button>
        </div>
      ) : (
        <div className="cmp-layout">
          <nav className="cmp-list" aria-label="Comparisons">
            <span className="label">{rows.length} {rows.length === 1 ? "comparison" : "comparisons"}</span>
            {rows.map((a) => {
              const j = jobById.get(a.jobId)!;
              const r = resumeById.get(a.resumeId)!;
              const tone = scoreTone(a.score);
              return (
                <button key={a.id} type="button" className="cmp-item" aria-current={a.id === selected?.id ? "true" : undefined} onClick={() => go(`compare/${a.id}`)}>
                  <Ring score={a.score} />
                  <span className="cmp-text">
                    <strong>{j.title ?? "Untitled role"}</strong>
                    <span className="caption">{j.label}{j.company ? ` · ${j.company}` : ""}</span>
                    <span className="caption">Resume: {resumeLabel(r)}</span>
                    <span className="row" style={{ gap: 6 }}>
                      <span className="chip" style={{ color: tone.color }}>{tone.label}</span>
                      {a.stale && <span className="chip warn">Out of date</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="cmp-detail" key={selected!.id}>
            <div className="card tight cmp-head">
              <span className="label">Comparing</span>
              <p><strong>{resume ? resumeLabel(resume) : "Resume"}</strong> <span className="caption">({resume?.filename ?? "sample data"})</span> with <strong>{job?.label}{job?.title ? ` · ${job.title}` : ""}</strong>{job?.company ? ` at ${job.company}` : ""}</p>
            </div>
            <Report job={job!} analysis={selected!} busy={isBusy(selected!.jobId, selected!.resumeId)} onRerun={() => void analyze([selected!.jobId], selected!.resumeId)} />
          </div>
        </div>
      )}
    </>
  );
}

function Report({ job, analysis, busy, onRerun }: { job: JobInfo; analysis: AnalysisInfo; busy: boolean; onRerun: () => void }) {
  const r: MatchReport = analysis.report;
  const tone = scoreTone(r.score);
  const required = r.requirements.filter((x) => x.kind === "required");
  const preferred = r.requirements.filter((x) => x.kind === "preferred");
  const missingCount = r.requirements.filter((x) => x.verdict === "missing").length;

  return (
    <>
      {analysis.stale && (
        <div className="card tight row spread" role="status">
          <span>Your resume or this job changed after this analysis was run.</span>
          <AiButton icon={RefreshCw} busy={busy} busyLabel="Analyzing…" onClick={onRerun}>Re-run analysis</AiButton>
        </div>
      )}
      <section className="grid cols-2">
        <div className="card">
          <div className="row">
            <Ring score={r.score} big />
            <div className="grow">
              <h2>{job.title ?? "Untitled role"}</h2>
              <p className="caption">{job.company ?? "Company not set"}</p>
              <span className="chip" style={{ marginTop: 8, color: tone.color }}>{tone.label}</span>
            </div>
          </div>
          <Component label="Required skills" score={r.components.required.score} />
          <Component label="Experience" score={r.components.experience.score} detail={r.experience ? `${r.experience.candidateYears ?? "?"} yrs vs ${r.experience.requiredYears ?? "?"}+ asked` : undefined} />
          <Component label="Preferred skills" score={r.components.preferred.score} />
          <p className="caption">Score: required skills 60%, experience 30%, preferred 10%. Calculated from the verdicts, not guessed by the AI.</p>
          {!analysis.stale && <div><AiButton variant="secondary" icon={RefreshCw} busy={busy} busyLabel="Analyzing…" onClick={onRerun}>Re-run analysis</AiButton></div>}
        </div>
        <div className="card">
          <h2>Skill alignment</h2>
          <Requirements title="Required" items={required} sources={r.sources} />
          <Requirements title="Preferred" items={preferred} sources={r.sources} />
          <p className="caption">{missingCount} {missingCount === 1 ? "requirement has" : "requirements have"} no evidence in your resume.</p>
        </div>
      </section>
      <section className="grid cols-3">
        <div className="card"><h2>Strengths</h2>{r.strengths.length ? <Bullets items={r.strengths} tone="good" /> : <p className="caption">None identified.</p>}</div>
        <div className="card"><h2>Concerns</h2>{r.concerns.length ? <Bullets items={r.concerns} tone="warn" /> : <p className="caption">None identified.</p>}</div>
        <div className="card"><h2>What to do</h2>{r.recommendations.length ? <Bullets items={r.recommendations} tone="bad" /> : <p className="caption">None.</p>}</div>
      </section>
    </>
  );
}

function Component({ label, score, detail }: { label: string; score: number | null; detail?: string }) {
  if (score === null) return <div className="bar"><div className="row spread"><span>{label}</span><span className="caption">Not part of this job</span></div></div>;
  return <Bar label={label} value={score} detail={detail ? `${detail} · ${score}%` : undefined} />;
}

function Requirements({ title, items, sources }: { title: string; items: RequirementResult[]; sources: MatchReport["sources"] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (items.length === 0) return null;
  return (
    <div className="sub">
      <span className="label">{title}</span>
      <ul className="list">
        {items.map((x) => {
          const v = VERDICT[x.verdict];
          const showing = open === x.id;
          return (
            <li key={x.id} style={{ flexDirection: "column", gap: 6 }}>
              <div className="row">
                <span className={`chip ${v.cls}`}>{v.mark}&nbsp;{x.requirement}</span>
                <span className="caption">{v.label}</span>
                {x.evidence.map((c) => (
                  <button key={c} className="chip cite" aria-expanded={showing} onClick={() => setOpen(showing ? null : x.id)}>{c}</button>
                ))}
              </div>
              {x.reason && <span className="caption">{x.reason}</span>}
              {x.adjusted && <span className="caption" style={{ color: "var(--warn)" }}>{x.adjusted}</span>}
              {showing && x.evidence.map((c) => sources[c] && (
                <pre key={c} className="extract" style={{ maxHeight: 160 }}>{`[${c}] ${sources[c]!.content}`}</pre>
              ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
