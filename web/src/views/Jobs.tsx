import { useRef, useState } from "react";
import { api, isPending, type JobInfo } from "../api";
import { useAsyncList } from "../useAsyncList";
import { PageHead } from "../ui";
import { StatusChip } from "./Resumes";

const anyPending = (items: JobInfo[]) => items.some((d) => isPending(d.status));

export function Jobs() {
  const { items, error, refresh } = useAsyncList(api.listJobs, anyPending);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit(file?: File) {
    setBusy(true);
    setFormError(null);
    try {
      if (file) await api.addJobFile(file, title, company);
      else await api.addJobText(text, title, company);
      setText(""); setTitle(""); setCompany(""); setOpen(false);
      await refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not add the job");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <>
      <PageHead
        title="Job descriptions"
        lead="Each role is kept separate so you can compare them. Paste the text or upload a file."
        action={<button className="btn" onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Add job"}</button>}
      />
      {open && (
        <form className="card" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div className="grid cols-2">
            <input id="job-title" className="input" placeholder="Job title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Job title" />
            <input id="job-company" className="input" placeholder="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Company" />
          </div>
          <textarea id="job-text" className="input area" placeholder="Paste the job description here" value={text} onChange={(e) => setText(e.target.value)} aria-label="Job description text" />
          {formError && <p role="alert" className="chip bad">{formError}</p>}
          <div className="row">
            <button className="btn" type="submit" disabled={busy || text.trim().length < 50}>Add pasted text</button>
            <span className="caption">or</span>
            <input id="job-file" ref={fileInput} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => e.target.files?.[0] && void submit(e.target.files[0])} />
            <button className="btn secondary" type="button" disabled={busy} onClick={() => fileInput.current?.click()}>Upload a file</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="chip bad">{error}</p>}
      {items && items.length === 0 && !open && (
        <div className="dropzone"><h2>No jobs yet</h2><p className="caption">Add two or three roles to compare against your resume.</p></div>
      )}
      <section className="grid cols-2">
        {items?.map((j) => (
          <article className="card" key={j.id}>
            <div className="row spread"><span className="label">{j.label}</span><StatusChip d={j} /></div>
            <div>
              <h2>{j.title ?? j.filename ?? "Untitled role"}</h2>
              <p className="caption">{j.company ?? "Company not set"}</p>
            </div>
            {j.status === "failed" ? <p role="alert" className="chip bad" style={{ height: "auto", padding: "8px 12px" }}>{j.error}</p> : <p className="clamp">{j.textPreview ?? "Extracting…"}</p>}
            <div><button className="btn secondary" onClick={async () => { await api.deleteJob(j.id); await refresh(); }}>Delete</button></div>
          </article>
        ))}
      </section>
    </>
  );
}
