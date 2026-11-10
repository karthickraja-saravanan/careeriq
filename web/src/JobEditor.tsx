import { useState } from "react";
import type { JobParsed } from "./api";
import { Field, TextArea, TextInput, fromCommas, fromLines, toLines } from "./fields";

export function JobEditor({ id, title, company, value, onSave, onCancel, saving }: {
  id: string; title: string | null; company: string | null; value: JobParsed;
  onSave: (title: string | null, company: string | null, parsed: JobParsed) => void; onCancel: () => void; saving: boolean;
}) {
  const [t, setT] = useState(title ?? "");
  const [c, setC] = useState(company ?? "");
  const [required, setRequired] = useState(value.requiredSkills.join(", "));
  const [preferred, setPreferred] = useState(value.preferredSkills.join(", "));
  const [resp, setResp] = useState(toLines(value.responsibilities));
  const [exp, setExp] = useState(value.experienceRequirement ?? "");

  return (
    <form className="editor" onSubmit={(e) => {
      e.preventDefault();
      onSave(t.trim() || null, c.trim() || null, {
        ...value, title: t.trim() || null, company: c.trim() || null,
        requiredSkills: fromCommas(required), preferredSkills: fromCommas(preferred),
        responsibilities: fromLines(resp), experienceRequirement: exp.trim() || null,
      });
    }}>
      <div className="grid cols-2">
        <Field id={`${id}-t`} label="Title"><TextInput id={`${id}-t`} value={t} onChange={setT} /></Field>
        <Field id={`${id}-c`} label="Company"><TextInput id={`${id}-c`} value={c} onChange={setC} /></Field>
      </div>
      <Field id={`${id}-req`} label="Required skills" hint="Separate with commas"><TextArea id={`${id}-req`} value={required} onChange={setRequired} /></Field>
      <Field id={`${id}-pref`} label="Preferred skills" hint="Separate with commas"><TextArea id={`${id}-pref`} value={preferred} onChange={setPreferred} /></Field>
      <Field id={`${id}-exp`} label="Experience requirement"><TextInput id={`${id}-exp`} value={exp} onChange={setExp} placeholder="e.g. 5+ years backend experience" /></Field>
      <Field id={`${id}-resp`} label="Responsibilities" hint="One per line"><TextArea id={`${id}-resp`} value={resp} onChange={setResp} rows={4} /></Field>
      <div className="row">
        <button className="btn" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        <button className="btn secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
