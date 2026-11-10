import { useState } from "react";
import { jobs } from "../sampleData";
import { PageHead } from "../ui";

export function Interview() {
  const [id, setId] = useState(jobs[0]!.id);
  const job = jobs.find((j) => j.id === id)!;
  const topics = job.required.filter((r) => !r.met).map((r) => r.skill);
  return (
    <>
      <PageHead title="Interview prep" lead="Questions come from the role and from what your resume actually says. Where you have a gap, the advice is to say so and show how you would learn." />
      <div className="pill-select" role="group" aria-label="Choose a role">
        {jobs.map((j) => (<button key={j.id} className="pill" aria-pressed={j.id === id} onClick={() => setId(j.id)}>{j.label} · {j.company}</button>))}
      </div>
      <section className="grid cols-2">
        <div className="grid">
          {job.questions.map((q) => (
            <article className="card" key={q.q}>
              <div className="row spread"><h2>{q.q}</h2><span className="chip cite">{q.basedOn}</span></div>
              <p className="caption">{q.why}</p>
              <span className="label">Suggested structure</span>
              <p>{q.structure}</p>
            </article>
          ))}
        </div>
        <div className="card" style={{ alignSelf: "start" }}>
          <h2>Topics to prepare</h2>
          {topics.length ? <div className="chips">{topics.map((t) => <span className="chip warn" key={t}>{t}</span>)}</div> : <p className="caption">No required gaps for this role.</p>}
          <p className="caption">Do not claim experience you lack. Interviewers respond well to an honest gap with a concrete plan.</p>
        </div>
      </section>
    </>
  );
}
