import { resume } from "../sampleData";
import { PageHead } from "../ui";

export function Resumes() {
  return (
    <>
      <PageHead title="Your resume" lead="Upload a PDF or DOCX and review what was extracted. Correct anything the parser got wrong; edits update every analysis." />
      <div className="dropzone">
        <h2>Drop a resume here</h2>
        <p className="caption">PDF or DOCX, up to 5 MB. The original file is kept.</p>
        <button className="btn" disabled title="Upload arrives in the next milestone">Choose file</button>
      </div>
      <section className="grid cols-2">
        <div className="card">
          <div className="row spread"><h2>Skills</h2><button className="btn secondary">Edit</button></div>
          <div className="chips">{resume.skills.map((s) => <span className="chip" key={s}>{s}</span>)}</div>
          <span className="label">Education</span><p>{resume.education}</p>
          <span className="label">Certifications</span><p>{resume.certifications.join(", ")}</p>
        </div>
        <div className="card">
          <h2>Experience</h2>
          {resume.experience.map((e) => (
            <div key={e.id}>
              <div className="row spread"><h3>{e.role}, {e.org}</h3><span className="caption">{e.dates}</span></div>
              <ul className="list" style={{ marginTop: 8 }}>{e.bullets.map((b) => <li key={b}><span className="dot" /><span>{b}</span></li>)}</ul>
            </div>
          ))}
          <span className="label">Projects</span>
          <ul className="list">{resume.projects.map((p) => <li key={p}><span className="dot" /><span>{p}</span></li>)}</ul>
        </div>
      </section>
    </>
  );
}
