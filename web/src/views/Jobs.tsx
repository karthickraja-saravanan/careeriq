import { useRef, useState } from "react";
import { api, isPending, type JobInfo, type JobParsed } from "../api";
import { useAsyncList } from "../useAsyncList";
import { PageHead } from "../ui";
import { StatusChip } from "./Resumes";
import { JobEditor } from "../JobEditor";

const anyPending = (items: JobInfo[]) => items.some((d) => isPending(d.status));

export function Jobs() {
  const { items, error, refresh } = useAsyncList(api.listJobs, anyPending);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const add = (file?: File) =>
    void run(async () => {
      if (file) await api.addJobFile(file, title, company);
      else await api.addJobText(text, title, company);
      setText(""); setTitle(""); setCompany(""); setOpen(false);
      if (fileInput.current) fileInput.current.value = "";
    });

  const save = (id: string, t: string | null, c: string | null, parsed: JobParsed) =>
    void run(async () => { await api.saveJob(id, t, c, parsed); setEditingId(null); });

  return (
    <>
      <PageHead
        title="Job descriptions"
        lead="Each role is kept separate so you can compare them. Paste the text or upload a file, then check the requirements we pulled out."
        action={<button className="btn" onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Add job"}</button>}
      />
      {open && (
        <form className="card" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <div className="grid cols-2">
            <input id="job-title" className="input" placeholder="Job title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Job title" />
            <input id="job-company" className="input" placeholder="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Company" />
          </div>
          <textarea id="job-text" className="input area" placeholder="Paste the job description here" value={text} onChange={(e) => setText(e.target.value)} aria-label="Job description text" />
          <div className="row">
            <button className="btn" type="submit" disabled={busy || text.trim().length < 50}>Add pasted text</button>
            <span className="caption">or</span>
            <input id="job-file" ref={fileInput} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => e.target.files?.[0] && add(e.target.files[0])} />
            <button className="btn secondary" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>Upload a file</button>
          </div>
        </form>
      )}
      {(message || error) && <p role="alert" className="chip bad notice">{message ?? error}</p>}
      {items && items.length === 0 && !open && (
        <div className="dropzone"><h2>No jobs yet</h2><p className="caption">Add two or three roles to compare against your resume.</p></div>
      )}
      <section className="grid cols-2">
        {items?.map((j) => (
          <article className="card" key={j.id}>
            <div className="row spread"><span className="label">{j.label}</span><StatusChip d={j} edited={j.userEdited} /></div>
            {editingId === j.id && j.parsed ? (
              <JobEditor id={`job-${j.id}`} title={j.title} company={j.company} value={j.parsed} saving={busy} onSave={(t, c, p) => save(j.id, t, c, p)} onCancel={() => setEditingId(null)} />
            ) : (
              <>
                <div>
                  <h2>{j.title ?? j.filename ?? "Untitled role"}</h2>
                  <p className="caption">{[j.company, j.parsed?.experienceRequirement].filter(Boolean).join(" · ") || "Company not set"}</p>
                </div>
                {j.status === "failed" && <p role="alert" className="chip bad notice">{j.error}</p>}
                {isPending(j.status) && <p className="caption">Reading the job description…</p>}
                {j.parsed && (
                  <>
                    <div className="sub"><span className="label">Required</span>
                      <div className="chips">{j.parsed.requiredSkills.map((s) => <span className="chip" key={s}>{s}</span>)}{j.parsed.requiredSkills.length === 0 && <span className="caption">None found</span>}</div></div>
                    <div className="sub"><span className="label">Preferred</span>
                      <div className="chips">{j.parsed.preferredSkills.map((s) => <span className="chip" key={s}>{s}</span>)}{j.parsed.preferredSkills.length === 0 && <span className="caption">None found</span>}</div></div>
                  </>
                )}
                <div className="row">
                  {j.status === "ready" && <button className="btn secondary" onClick={() => setEditingId(j.id)}>Edit</button>}
                  {(j.status === "ready" || j.status === "failed") && <button className="btn secondary" disabled={busy} onClick={() => void run(() => api.reparseJob(j.id))}>Reparse</button>}
                  <button className="btn secondary" onClick={() => void run(() => api.deleteJob(j.id))}>Delete</button>
                </div>
              </>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
