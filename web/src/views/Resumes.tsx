import { useRef, useState } from "react";
import { api, isPending, type DocInfo } from "../api";
import { useAsyncList } from "../useAsyncList";
import { PageHead } from "../ui";

const anyPending = (items: DocInfo[]) => items.some((d) => isPending(d.status));

export function Resumes() {
  const { items, error, refresh } = useAsyncList(api.listResumes, anyPending);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [full, setFull] = useState<Record<string, string>>({});
  const input = useRef<HTMLInputElement>(null);
  const current = items?.[0];

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setUploadError(null);
    try {
      // One active resume for now: replace any existing one.
      for (const old of items ?? []) await api.deleteResume(old.id);
      await api.uploadResume(file);
      await refresh();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function showText(d: DocInfo) {
    const r = await api.getResume(d.id);
    setFull((f) => ({ ...f, [d.id]: r.text ?? "" }));
  }

  return (
    <>
      <PageHead title="Your resume" lead="Upload a PDF or DOCX. The text is extracted in the background so you can check it before any analysis." />
      <div
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files[0]); }}
      >
        <h2>{current ? "Replace your resume" : "Drop a resume here"}</h2>
        <p className="caption">PDF, DOCX or TXT, up to 5 MB. Scanned images are not supported.</p>
        <input id="resume-file" ref={input} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => void upload(e.target.files?.[0])} />
        <button className="btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : "Choose file"}</button>
        {uploadError && <p role="alert" className="chip bad">{uploadError}</p>}
      </div>
      {error && <p role="alert" className="chip bad">{error}</p>}
      {current && (
        <section className="card">
          <div className="row spread">
            <div><h2>{current.filename ?? "Resume"}</h2><p className="caption">Uploaded {new Date(current.createdAt).toLocaleString()}</p></div>
            <div className="row">
              <StatusChip d={current} />
              <button className="btn secondary" onClick={async () => { await api.deleteResume(current.id); await refresh(); }}>Delete</button>
            </div>
          </div>
          {current.status === "failed" && <p role="alert" className="chip bad" style={{ height: "auto", padding: "8px 12px" }}>{current.error}</p>}
          {current.status !== "failed" && (
            <>
              <span className="label">Extracted text</span>
              <pre className="extract">{full[current.id] ?? current.textPreview ?? "Extracting…"}</pre>
              {full[current.id] === undefined && current.textPreview && (
                <div><button className="btn secondary" onClick={() => void showText(current)}>Show full text</button></div>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}

export function StatusChip({ d }: { d: DocInfo }) {
  if (d.status === "failed") return <span className="chip bad">Failed</span>;
  if (isPending(d.status)) return <span className="chip warn">Processing…</span>;
  return <span className="chip good">Text extracted</span>;
}
