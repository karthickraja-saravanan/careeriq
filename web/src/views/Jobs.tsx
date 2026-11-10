import { jobs } from "../sampleData";
import { PageHead } from "../ui";

export function Jobs() {
  return (
    <>
      <PageHead title="Job descriptions" lead="Each role is kept separate so you can compare them. Paste text or upload a file; edit the extracted requirements if needed."
        action={<button className="btn" disabled title="Arrives in the next milestone">Add job</button>} />
      <section className="grid cols-2">
        {jobs.map((j) => (
          <article className="card" key={j.id}>
            <div className="row spread"><span className="label">{j.label}</span><button className="btn secondary">Edit</button></div>
            <div><h2>{j.title}</h2><p className="caption">{j.company} · {j.experience.need}</p></div>
            <div><span className="label">Required</span>
              <div className="chips" style={{ marginTop: 8 }}>{j.required.map((r) => <span className="chip" key={r.skill}>{r.skill}</span>)}</div></div>
            <div><span className="label">Preferred</span>
              <div className="chips" style={{ marginTop: 8 }}>{j.preferred.map((r) => <span className="chip" key={r.skill}>{r.skill}</span>)}</div></div>
          </article>
        ))}
      </section>
    </>
  );
}
