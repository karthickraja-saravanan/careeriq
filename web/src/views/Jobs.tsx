import { Building2, ChevronDown, Clock, GitCompare, LayoutGrid, List, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { AiButton } from "../AiButton";
import { useRef, useState } from "react";
import { api, isPending, type AnalysisInfo, type JobInfo, type JobParsed, type ResumeInfo } from "../api";
import { useAsyncList } from "../useAsyncList";
import { PageHead, scoreTone } from "../ui";
import { StatusChip } from "./Resumes";
import { JobEditor } from "../JobEditor";
import { readyResumes, resumeLabel, resumeOption, useCareerData } from "../useCareerData";

const anyPending = (items: JobInfo[]) => items.some((d) => isPending(d.status));

export function Jobs({ go }: { go: (v: string) => void }) {
  const { items, error, refresh } = useAsyncList(api.listJobs, anyPending);
  const { data: career } = useCareerData();
  const resumes = career ? readyResumes(career) : [];
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setViewState] = useState<"cards" | "list">(() => { try { return localStorage.getItem("jobs-view") === "list" ? "list" : "cards"; } catch { return "cards"; } });
  const setView = (v: "cards" | "list") => { setViewState(v); try { localStorage.setItem("jobs-view", v); } catch { /* ignore */ } };
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
        action={(
          <div className="row head-actions">
            {items && items.length > 0 && (
              <div className="seg" role="tablist" aria-label="Job layout">
                {([["cards", "Cards", LayoutGrid], ["list", "List", List]] as const).map(([id, label, Icon]) => (
                  <button key={id} type="button" role="tab" aria-selected={view === id} aria-label={`${label} view`} title={`${label} view`} className="seg-item" onClick={() => setView(id)}>
                    {view === id && <motion.span layoutId="jobs-seg" className="seg-pill" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                    <Icon size={16} aria-hidden />
                  </button>
                ))}
              </div>
            )}
            <button className="btn" onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Add job"}</button>
          </div>
        )}
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
      <section className={view === "list" ? "job-list" : "grid cols-2"}>
        {items?.map((j, i) => {
          const common = {
            job: j,
            busy,
            editing: editingId === j.id,
            resumes,
            analyses: career?.analyses ?? [],
            go,
            onEdit: () => setEditingId(j.id),
            onCancelEdit: () => setEditingId(null),
            onSave: (t: string | null, c: string | null, p: JobParsed) => save(j.id, t, c, p),
            onReparse: () => void run(() => api.reparseJob(j.id)),
            onDelete: () => { if (window.confirm(`Delete ${j.label} and its comparisons? This cannot be undone.`)) void run(() => api.deleteJob(j.id)); },
          };
          return view === "list" ? <JobRow key={j.id} {...common} defaultOpen={i === 0} /> : <JobCard key={j.id} {...common} />;
        })}
      </section>
    </>
  );
}

const VISIBLE_SKILLS = 6;

interface CardProps {
  job: JobInfo; busy: boolean; editing: boolean; resumes: ResumeInfo[]; analyses: AnalysisInfo[]; go: (v: string) => void;
  onEdit: () => void; onCancelEdit: () => void; onSave: (t: string | null, c: string | null, p: JobParsed) => void; onReparse: () => void; onDelete: () => void;
}

function JobCard({ job: j, busy, editing, resumes, analyses, go, onEdit, onCancelEdit, onSave, onReparse, onDelete }: CardProps) {
  const [showAll, setShowAll] = useState(false);
  const required = j.parsed?.requiredSkills ?? [];
  const preferred = j.parsed?.preferredSkills ?? [];
  const shown = showAll ? required : required.slice(0, VISIBLE_SKILLS);
  const results = analyses.filter((a) => a.jobId === j.id).sort((x, y) => y.score - x.score).slice(0, 3);
  const resumeName = (id: string) => { const r = resumes.find((x) => x.id === id); return r ? resumeLabel(r) : "Resume"; };

  return (
    <article className="card job-card">
      <header className="job-head">
        <div className="job-meta">
          <span className="label">{j.label}</span>
          <StatusChip d={j} edited={j.userEdited} />
        </div>
        <div className="card-actions">
          {j.status === "ready" && !editing && <button type="button" className="icon-action" aria-label={`Edit ${j.label}`} title="Edit" onClick={onEdit}><Pencil size={16} /></button>}
          {(j.status === "ready" || j.status === "failed") && (
            <button type="button" className={`icon-action ${busy ? "spin" : ""}`} aria-label={`Reparse ${j.label}`} title="Reparse with AI" disabled={busy} onClick={onReparse}><RefreshCw size={16} /></button>
          )}
          <button type="button" className="icon-action danger" aria-label={`Delete ${j.label}`} title="Delete" disabled={busy} onClick={onDelete}><Trash2 size={16} /></button>
        </div>
      </header>

      {editing && j.parsed ? (
        <JobEditor id={`job-${j.id}`} title={j.title} company={j.company} value={j.parsed} saving={busy} onSave={onSave} onCancel={onCancelEdit} />
      ) : (
        <>
          <div className="job-title">
            <h2>{j.title ?? j.filename ?? "Untitled role"}</h2>
            <p className="caption"><Building2 size={13} aria-hidden="true" /> {j.company ?? "Company not set"}{j.parsed?.experienceRequirement ? <><span aria-hidden="true"> · </span><Clock size={13} aria-hidden="true" /> {j.parsed.experienceRequirement}</> : null}</p>
          </div>
          {j.status === "failed" && <p role="alert" className="chip bad notice">{j.error}</p>}
          {isPending(j.status) && <p className="caption">Reading the job description…</p>}
          {j.parsed && (
            <div className="job-skills">
              <span className="label">Required skills</span>
              <div className="chips">
                {required.length === 0 && <span className="caption">None found</span>}
                {shown.map((s) => <span className="chip" key={s}>{s}</span>)}
                {required.length > VISIBLE_SKILLS && (
                  <button type="button" className="chip more" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>{showAll ? "Show less" : `+${required.length - VISIBLE_SKILLS} more`}</button>
                )}
              </div>
              {preferred.length > 0 && <p className="nice"><span>Nice to have</span> {preferred.join(", ")}</p>}
            </div>
          )}
          {results.length > 0 && (
            <div className="job-results" aria-label="Previous comparisons">
              <span className="label">Compared</span>
              {results.map((a) => (
                <button key={a.id} type="button" className="chip result" style={{ color: scoreTone(a.score).color }} onClick={() => go(`compare/${a.id}`)} title={`Open comparison with ${resumeName(a.resumeId)}`}>
                  <strong>{a.score}</strong> <span>{resumeName(a.resumeId)}</span>
                </button>
              ))}
            </div>
          )}
          {j.status === "ready" && <CompareBar job={j} resumes={resumes} analyses={analyses} go={go} />}
        </>
      )}
    </article>
  );
}

/** Footer of a job card: pick a resume and compare it with this job. Opens the Compare page on the result. */
function CompareBar({ job, resumes, analyses, go }: { job: JobInfo; resumes: ResumeInfo[]; analyses: AnalysisInfo[]; go: (v: string) => void }) {
  const [resumeId, setResumeId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = resumes.find((r) => r.id === resumeId) ?? resumes[0];

  if (resumes.length === 0) {
    return <footer className="job-foot"><p className="caption">To compare this job, <button type="button" className="link" onClick={() => go("resume")}>add a resume</button> first.</p></footer>;
  }

  const compare = async () => {
    if (!chosen) return;
    setError(null);
    const existing = analyses.find((a) => a.jobId === job.id && a.resumeId === chosen.id && !a.stale);
    if (existing) { go(`compare/${existing.id}`); return; } // already compared and nothing changed since
    setBusy(true);
    try {
      const made = await api.analyze(job.id, chosen.id);
      go(`compare/${made.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed");
      setBusy(false);
    }
  };

  return (
    <footer className="job-foot">
      <div className="compare-bar">
        <label className="compare-pick">
          <span className="label">Compare with</span>
          <select className="select" value={chosen?.id ?? ""} disabled={busy} onChange={(e) => setResumeId(e.target.value)} aria-label={`Resume to compare with ${job.label}`}>
            {resumes.map((r) => <option key={r.id} value={r.id}>{resumeOption(r)}</option>)}
          </select>
        </label>
        <AiButton icon={GitCompare} busy={busy} busyLabel="Comparing…" onClick={() => void compare()}>Compare</AiButton>
      </div>
      {error && <p role="alert" className="chip bad notice">{error}</p>}
    </footer>
  );
}

/** Minimal one-line version of a job for the list layout. Click the row to expand the full details. */
function JobRow({ job: j, busy, editing, resumes, analyses, go, onEdit, onCancelEdit, onSave, onReparse, onDelete, defaultOpen = false }: CardProps & { defaultOpen?: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const isOpen = expanded || editing;
  const required = j.parsed?.requiredSkills ?? [];
  const preferred = j.parsed?.preferredSkills ?? [];
  const results = analyses.filter((a) => a.jobId === j.id).sort((x, y) => y.score - x.score);
  const best = results[0];
  const resumeName = (id: string) => { const r = resumes.find((x) => x.id === id); return r ? resumeLabel(r) : "Resume"; };
  const panelId = `job-panel-${j.id}`;

  return (
    <motion.article layout="position" className="card job-row" data-open={isOpen || undefined} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <div className="job-row-bar">
        <button type="button" className="job-row-toggle" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setExpanded((v) => !v)}>
          <ChevronDown size={18} aria-hidden className="job-row-chev" />
          <span className="label">{j.label}</span>
          <span className="job-row-title">{j.title ?? j.filename ?? "Untitled role"}</span>
          <span className="caption job-row-company">{j.company ?? "Company not set"}</span>
        </button>
        <StatusChip d={j} edited={j.userEdited} />
        {best && <span className="chip result" style={{ color: scoreTone(best.score).color }} title={`Best match: ${resumeName(best.resumeId)}`}><strong>{best.score}</strong></span>}
        <div className="card-actions">
          {j.status === "ready" && !editing && <button type="button" className="icon-action" aria-label={`Edit ${j.label}`} title="Edit" onClick={() => { setExpanded(true); onEdit(); }}><Pencil size={16} /></button>}
          {(j.status === "ready" || j.status === "failed") && (
            <button type="button" className={`icon-action ${busy ? "spin" : ""}`} aria-label={`Reparse ${j.label}`} title="Reparse with AI" disabled={busy} onClick={onReparse}><RefreshCw size={16} /></button>
          )}
          <button type="button" className="icon-action danger" aria-label={`Delete ${j.label}`} title="Delete" disabled={busy} onClick={onDelete}><Trash2 size={16} /></button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div id={panelId} key="panel" className="job-row-panel" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: "hidden" }}>
            <div className="job-row-body">
              {editing && j.parsed ? (
                <JobEditor id={`job-${j.id}`} title={j.title} company={j.company} value={j.parsed} saving={busy} onSave={onSave} onCancel={onCancelEdit} />
              ) : (
                <>
                  {j.parsed?.experienceRequirement && <p className="caption"><Clock size={13} aria-hidden="true" /> {j.parsed.experienceRequirement}</p>}
                  {j.status === "failed" && <p role="alert" className="chip bad notice">{j.error}</p>}
                  {isPending(j.status) && <p className="caption">Reading the job description…</p>}
                  {j.parsed && (
                    <div className="job-skills">
                      <span className="label">Required skills</span>
                      <div className="chips">
                        {required.length === 0 && <span className="caption">None found</span>}
                        {required.map((s) => <span className="chip" key={s}>{s}</span>)}
                      </div>
                      {preferred.length > 0 && <p className="nice"><span>Nice to have</span> {preferred.join(", ")}</p>}
                    </div>
                  )}
                  {results.length > 0 && (
                    <div className="job-results" aria-label="Previous comparisons">
                      <span className="label">Compared</span>
                      {results.map((a) => (
                        <button key={a.id} type="button" className="chip result" style={{ color: scoreTone(a.score).color }} onClick={() => go(`compare/${a.id}`)} title={`Open comparison with ${resumeName(a.resumeId)}`}>
                          <strong>{a.score}</strong> <span>{resumeName(a.resumeId)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {j.status === "ready" && <CompareBar job={j} resumes={resumes} analyses={analyses} go={go} />}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
