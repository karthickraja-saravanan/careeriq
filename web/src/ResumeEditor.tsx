import { useState } from "react";
import type { ResumeParsed } from "./api";
import { Field, TextArea, TextInput, fromCommas, fromLines, toLines } from "./fields";

interface RoleDraft { title: string; company: string; start: string; end: string; bullets: string }

/** Edit form for a parsed resume. Lists are edited as text (one item per line, or comma separated for skills). */
export function ResumeEditor({ value, onSave, onCancel, saving }: { value: ResumeParsed; onSave: (v: ResumeParsed) => void; onCancel: () => void; saving: boolean }) {
  const [summary, setSummary] = useState(value.summary);
  const [skills, setSkills] = useState(value.skills.join(", "));
  const [projects, setProjects] = useState(toLines(value.projects));
  const [education, setEducation] = useState(toLines(value.education));
  const [certs, setCerts] = useState(toLines(value.certifications));
  const [roles, setRoles] = useState<RoleDraft[]>(
    value.experience.map((r) => ({ title: r.title, company: r.company, start: r.start ?? "", end: r.end ?? "", bullets: toLines(r.bullets) })),
  );
  const setRole = (i: number, patch: Partial<RoleDraft>) => setRoles((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = () =>
    onSave({
      ...value,
      summary,
      skills: fromCommas(skills),
      projects: fromLines(projects),
      education: fromLines(education),
      certifications: fromLines(certs),
      experience: roles
        .filter((r) => r.title.trim() || r.company.trim())
        .map((r) => ({ title: r.title.trim(), company: r.company.trim(), start: r.start.trim() || null, end: r.end.trim() || null, bullets: fromLines(r.bullets) })),
    });

  return (
    <form className="editor" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <Field id="ed-summary" label="Summary"><TextArea id="ed-summary" value={summary} onChange={setSummary} /></Field>
      <Field id="ed-skills" label="Skills" hint="Separate with commas"><TextArea id="ed-skills" value={skills} onChange={setSkills} /></Field>
      <span className="label">Experience</span>
      {roles.map((r, i) => (
        <div className="card tight" key={i}>
          <div className="grid cols-2">
            <Field id={`ed-title-${i}`} label="Title"><TextInput id={`ed-title-${i}`} value={r.title} onChange={(v) => setRole(i, { title: v })} /></Field>
            <Field id={`ed-company-${i}`} label="Company"><TextInput id={`ed-company-${i}`} value={r.company} onChange={(v) => setRole(i, { company: v })} /></Field>
            <Field id={`ed-start-${i}`} label="Start" hint="YYYY or YYYY-MM"><TextInput id={`ed-start-${i}`} value={r.start} onChange={(v) => setRole(i, { start: v })} /></Field>
            <Field id={`ed-end-${i}`} label="End" hint="YYYY, YYYY-MM or present"><TextInput id={`ed-end-${i}`} value={r.end} onChange={(v) => setRole(i, { end: v })} /></Field>
          </div>
          <Field id={`ed-bullets-${i}`} label="Highlights" hint="One per line"><TextArea id={`ed-bullets-${i}`} value={r.bullets} onChange={(v) => setRole(i, { bullets: v })} rows={4} /></Field>
          <div><button type="button" className="btn secondary" onClick={() => setRoles((rs) => rs.filter((_, j) => j !== i))}>Remove role</button></div>
        </div>
      ))}
      <div><button type="button" className="btn secondary" onClick={() => setRoles((rs) => [...rs, { title: "", company: "", start: "", end: "", bullets: "" }])}>Add role</button></div>
      <Field id="ed-projects" label="Projects" hint="One per line"><TextArea id="ed-projects" value={projects} onChange={setProjects} /></Field>
      <Field id="ed-education" label="Education" hint="One per line"><TextArea id="ed-education" value={education} onChange={setEducation} rows={2} /></Field>
      <Field id="ed-certs" label="Certifications" hint="One per line"><TextArea id="ed-certs" value={certs} onChange={setCerts} rows={2} /></Field>
      <div className="row">
        <button className="btn" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
