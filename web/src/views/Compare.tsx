import { useState } from "react";
import { jobs } from "../sampleData";
import { Bar, Bullets, PageHead, Ring, scoreTone } from "../ui";

export function Compare() {
  const [id, setId] = useState(jobs[0]!.id);
  const job = jobs.find((j) => j.id === id)!;
  const missingReq = job.required.filter((r) => !r.met);
  const missingPref = job.preferred.filter((r) => !r.met);

  return (
    <>
      <PageHead title="Compare and close gaps" lead="Every skill marked as matched points to evidence in your resume. Anything without evidence counts as missing." />
      <div className="pill-select" role="group" aria-label="Choose a role">
        {jobs.map((j) => (<button key={j.id} className="pill" aria-pressed={j.id === id} onClick={() => setId(j.id)}>{j.label} · {j.company}</button>))}
      </div>
      <section className="grid cols-2">
        <div className="card">
          <div className="row">
            <Ring score={job.score} big />
            <div className="grow"><h2>{job.title}</h2><p className="caption">{job.company}</p>
              <span className="chip" style={{ marginTop: 8, color: scoreTone(job.score).color }}>{scoreTone(job.score).label}</span></div>
          </div>
          <Bar label="Required skills" value={job.skillScore} />
          <Bar label="Experience" value={job.experience.score} detail={`${job.experience.have} vs ${job.experience.need}`} />
          <Bar label="Preferred skills" value={job.preferredScore} />
        </div>
        <div className="card">
          <h2>Skill alignment</h2>
          <span className="label">Required</span>
          <div className="chips">{job.required.map((r) => (
            <span key={r.skill} className={`chip ${r.met ? "good" : "bad"}`}>{r.met ? "✓" : "✕"}&nbsp;{r.skill}{r.evidence ? ` [${r.evidence}]` : ""}</span>))}</div>
          <span className="label">Preferred</span>
          <div className="chips">{job.preferred.map((r) => (<span key={r.skill} className={`chip ${r.met ? "good" : "warn"}`}>{r.met ? "✓" : "–"}&nbsp;{r.skill}</span>))}</div>
          <p className="caption">{missingReq.length} required and {missingPref.length} preferred skills have no evidence in your resume.</p>
        </div>
      </section>
      <section className="grid cols-3">
        <div className="card"><h2>Strengths</h2><Bullets items={job.strengths} tone="good" /></div>
        <div className="card"><h2>Concerns</h2><Bullets items={job.concerns} tone="warn" /></div>
        <div className="card"><h2>What to do</h2><Bullets items={job.recommendations} tone="bad" /></div>
      </section>
    </>
  );
}
