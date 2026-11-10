import { RefreshCw } from "lucide-react";
import { AiButton } from "../AiButton";
import { useRef, useState } from "react";
import { api, isPending, type DocInfo, type ResumeInfo, type ResumeParsed } from "../api";
import { useAsyncList } from "../useAsyncList";
import { PageHead } from "../ui";
import { ResumeEditor } from "../ResumeEditor";

const anyPending = (items: ResumeInfo[]) => items.some((d) => isPending(d.status));

export function Resumes() {
  const { items, error, refresh } = useAsyncList(api.listResumes, anyPending);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [rawText, setRawText] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const current = items?.[0];

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

  const upload = (file: File | undefined) => {
    if (!file) return;
    void run(async () => {
      for (const old of items ?? []) await api.deleteResume(old.id); // one active resume for now
      setEditing(false); setRawText(null);
      await api.uploadResume(file);
      if (input.current) input.current.value = "";
    });
  };

  const save = (parsed: ResumeParsed) => void run(async () => { await api.saveResume(current!.id, parsed); setEditing(false); });

  return (
    <>
      <PageHead title="Your resume" lead="Upload a PDF or DOCX. We extract the text and pull out your skills and experience. Check the result and correct anything that is wrong." />
      <div className="dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); }}>
        <h2>{current ? "Replace your resume" : "Drop a resume here"}</h2>
        <p className="caption">PDF, DOCX or TXT, up to 5 MB. Scanned images are not supported.</p>
        <input id="resume-file" ref={input} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => upload(e.target.files?.[0])} />
        <button className="btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Working…" : "Choose file"}</button>
      </div>
      {(message || error) && <p role="alert" className="chip bad notice">{message ?? error}</p>}
      {current && (
        <section className="card">
          <div className="row spread">
            <div><h2>{current.parsed?.name ?? current.filename ?? "Resume"}</h2><p className="caption">{current.filename} · uploaded {new Date(current.createdAt).toLocaleString()}</p></div>
            <div className="row">
              <StatusChip d={current} edited={current.userEdited} />
              {current.status === "ready" && !editing && <button className="btn secondary" onClick={() => setEditing(true)}>Edit</button>}
              {(current.status === "ready" || current.status === "failed") && <AiButton variant="secondary" icon={RefreshCw} busy={busy} busyLabel="Reparsing…" onClick={() => void run(() => api.reparseResume(current.id))}>Reparse</AiButton>}
              <button className="btn secondary" onClick={() => void run(async () => { await api.deleteResume(current.id); setEditing(false); })}>Delete</button>
            </div>
          </div>
          {current.status === "failed" && <p role="alert" className="chip bad notice">{current.error}</p>}
          {isPending(current.status) && <p className="caption">Reading your resume. This takes a few seconds.</p>}
          {current.parsed && (editing
            ? <ResumeEditor value={current.parsed} saving={busy} onSave={save} onCancel={() => setEditing(false)} />
            : <ResumeView r={current} />)}
          {current.status !== "failed" && !isPending(current.status) && (
            <div>
              <button className="btn secondary" onClick={async () => setRawText(rawText === null ? ((await api.getResume(current.id)).text ?? "") : null)}>
                {rawText === null ? "Show extracted text" : "Hide extracted text"}
              </button>
              {rawText !== null && <pre className="extract" style={{ marginTop: 12 }}>{rawText}</pre>}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function ResumeView({ r }: { r: ResumeInfo }) {
  const p = r.parsed!;
  return (
    <div className="grid cols-2">
      <div className="sub" style={{ gap: 16 }}>
        {p.summary && <><span className="label">Summary</span><p>{p.summary}</p></>}
        <span className="label">Experience{r.yearsExperience !== null ? ` · about ${r.yearsExperience} years` : ""}</span>
        {p.experience.length === 0 && <p className="caption">No roles found. Use Edit to add them.</p>}
        {p.experience.map((e, i) => (
          <div key={i}>
            <div className="row spread"><h3>{e.title}{e.company ? `, ${e.company}` : ""}</h3><span className="caption">{[e.start, e.end].filter(Boolean).join(" to ")}</span></div>
            <ul className="list" style={{ marginTop: 8 }}>{e.bullets.map((b) => <li key={b}><span className="dot" /><span>{b}</span></li>)}</ul>
          </div>
        ))}
      </div>
      <div className="sub" style={{ gap: 16 }}>
        <span className="label">Skills</span>
        <div className="chips">{p.skills.map((s) => <span className="chip" key={s}>{s}</span>)}</div>
        {p.projects.length > 0 && <><span className="label">Projects</span><ul className="list">{p.projects.map((x) => <li key={x}><span className="dot" /><span>{x}</span></li>)}</ul></>}
        {p.education.length > 0 && <><span className="label">Education</span><ul className="list">{p.education.map((x) => <li key={x}><span className="dot" /><span>{x}</span></li>)}</ul></>}
        {p.certifications.length > 0 && <><span className="label">Certifications</span><div className="chips">{p.certifications.map((x) => <span className="chip" key={x}>{x}</span>)}</div></>}
      </div>
    </div>
  );
}

export function StatusChip({ d, edited }: { d: DocInfo; edited?: boolean }) {
  if (d.status === "failed") return <span className="chip bad">Failed</span>;
  if (isPending(d.status)) return <span className="chip warn">Processing…</span>;
  return <span className="chip good">{edited ? "Edited by you" : "Ready"}</span>;
}
