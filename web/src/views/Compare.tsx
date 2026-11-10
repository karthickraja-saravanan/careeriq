import { RefreshCw } from "lucide-react";
import { AiButton } from "../AiButton";
import { useState } from "react";
import type { AnalysisInfo, JobInfo, MatchReport, RequirementResult, Verdict } from "../api";
import { Bar, Bullets, PageHead, Ring, scoreTone } from "../ui";
import { needsAnalysis, readyJobs, useCareerData } from "../useCareerData";

const VERDICT: Record<Verdict, { label: string; cls: string; mark: string }> = {
  met: { label: "Evidenced", cls: "good", mark: "✓" },
  partial: { label: "Partly evidenced", cls: "warn", mark: "◐" },
  missing: { label: "No evidence", cls: "bad", mark: "✕" },
};

export function Compare({ go }: { go: (v: string) => void }) {
  const { data, error, busyJobs, analyze } = useCareerData();
  const [selected, setSelected] = useState<string | null>(null);

  if (!data) return <PageHead title="Compare and close gaps" lead="Loading your documents…" />;
  const jobs = readyJobs(data);
  const job = jobs.find((j) => j.id === selected) ?? jobs[0];
  const analysis = job ? data.analyses.find((a) => a.jobId === job.id) : undefined;
  const todo = needsAnalysis(data);

  return (
    <>
      <PageHead
        title="Compare and close gaps"
        lead="Each skill is judged against your resume. A skill only counts as matched when the resume text backs it up; anything else counts as missing."
        action={todo.length > 1 ? <AiButton busy={busyJobs.size > 0} busyLabel="Analyzing…" onClick={() => void analyze(todo)}>{`Analyze all (${todo.length})`}</AiButton> : undefined}
      />
      {error && <p role="alert" className="chip bad notice">{error}</p>}
      {!data.resume || data.resume.status !== "ready" ? (
        <Empty title={data.resume ? "Your resume is still being processed" : "Add your resume first"} text="Comparison needs a parsed resume." action="Go to Resume" onClick={() => go("resume")} />
      ) : jobs.length === 0 ? (
        <Empty title="Add a job to compare" text="Paste or upload at least one job description." action="Go to Jobs" onClick={() => go("jobs")} />
      ) : (
        <>
          <div className="pill-select" role="group" aria-label="Choose a role">
            {jobs.map((j) => (
              <button key={j.id} className="pill" aria-pressed={j.id === job!.id} onClick={() => setSelected(j.id)}>
                {j.label} · {j.company ?? j.title ?? "Untitled"}
              </button>
            ))}
          </div>
          {analysis ? (
            <Report job={job!} analysis={analysis} busy={busyJobs.has(job!.id)} onRerun={() => void analyze([job!.id])} />
          ) : (
            <Empty
              title={busyJobs.has(job!.id) ? "Analyzing…" : "Not analyzed yet"}
              text={busyJobs.has(job!.id) ? "Checking each requirement against your resume. This takes a few seconds." : "Check this role's requirements against your resume."}
              action="Analyze this role" busy={busyJobs.has(job!.id)} onClick={() => void analyze([job!.id])}
            />
          )}
        </>
      )}
    </>
  );
}

function Empty({ title, text, action, onClick, busy }: { title: string; text: string; action: string; onClick: () => void; busy?: boolean }) {
  return (
    <div className="dropzone"><h2>{title}</h2><p className="caption">{text}</p><AiButton busy={busy} busyLabel="Analyzing…" onClick={onClick}>{action}</AiButton></div>
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
