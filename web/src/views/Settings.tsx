import { AiButton } from "../AiButton";
import { useEffect, useState } from "react";
import { api, type UsageSummary } from "../api";
import { PageHead } from "../ui";
import { useCareerData } from "../useCareerData";

const PURPOSE_LABELS: Record<string, string> = {
  parse_resume: "Resume parsing",
  parse_job: "Job parsing",
  analysis: "Comparisons",
  interview: "Interview prep",
  chat: "Assistant answers",
  chat_rewrite: "Assistant question rewrite",
};
const num = (n: number) => n.toLocaleString();

function UsageCard({ refreshKey }: { refreshKey: number }) {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    api.usage().then((u) => live && setUsage(u)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [refreshKey]);

  return (
    <section className="card" aria-labelledby="usage-h">
      <h2 id="usage-h">AI usage</h2>
      <p className="muted">Every call to the language model is recorded with its token counts and response time.</p>
      {failed && <p className="muted">Usage could not be loaded.</p>}
      {usage && usage.totals.calls === 0 && <p className="muted">No AI calls yet. Upload a document or ask the assistant something.</p>}
      {usage && usage.totals.calls > 0 && (
        <>
          <dl className="usage-totals">
            <div><dt>Calls</dt><dd>{num(usage.totals.calls)}</dd></div>
            <div><dt>Input tokens</dt><dd>{num(usage.totals.promptTokens)}</dd></div>
            <div><dt>Output tokens</dt><dd>{num(usage.totals.completionTokens)}</dd></div>
            <div><dt>Failed</dt><dd>{num(usage.totals.errors)}</dd></div>
          </dl>
          <table className="usage-table">
            <thead><tr><th>Feature</th><th>Calls</th><th>Tokens</th></tr></thead>
            <tbody>
              {usage.byPurpose.map((g) => (
                <tr key={g.key}><td>{PURPOSE_LABELS[g.key] ?? g.key}</td><td>{num(g.calls)}</td><td>{num(g.totalTokens)}</td></tr>
              ))}
            </tbody>
          </table>
          <table className="usage-table">
            <thead><tr><th>Model</th><th>Calls</th><th>Tokens</th></tr></thead>
            <tbody>
              {usage.byModel.map((g) => (
                <tr key={g.key}><td>{g.key}</td><td>{num(g.calls)}</td><td>{num(g.totalTokens)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

type Tab = "sample" | "usage" | "delete";
const TABS: { id: Tab; label: string }[] = [
  { id: "sample", label: "Sample data" },
  { id: "usage", label: "AI usage" },
  { id: "delete", label: "Delete data" },
];

export function Settings({ go, onReset }: { go: (v: string) => void; onReset: () => void }) {
  const { data } = useCareerData();
  const [usageKey, setUsageKey] = useState(0);
  const [tab, setTab] = useState<Tab>(() => {
    try { const t = sessionStorage.getItem("settings-tab"); return TABS.some((x) => x.id === t) ? (t as Tab) : "sample"; } catch { return "sample"; }
  });
  const pick = (t: Tab) => {
    setTab(t);
    try { sessionStorage.setItem("settings-tab", t); } catch { /* optional */ }
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = TABS.findIndex((x) => x.id === tab);
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length]!;
    pick(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };
  const [busy, setBusy] = useState<"seed" | "clear" | null>(null);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const hasData = !!data && (!!data.resume || data.jobs.length > 0);

  const run = async (kind: "seed" | "clear") => {
    const warning = kind === "seed"
      ? "This replaces your current resume, jobs, comparisons and chats with the sample data. Continue?"
      : "This permanently deletes your resume, jobs, comparisons and chats. Continue?";
    if ((hasData || kind === "clear") && !window.confirm(warning)) return;
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === "seed") {
        const r = await api.seedDemoData();
        setMessage({ tone: "good", text: `Loaded ${r.resumes} resume and ${r.jobs} jobs. They are being processed now and will be ready in a minute or two.` });
      } else {
        await api.clearAllData();
        setMessage({ tone: "good", text: "All your data was deleted." });
      }
      onReset();
      setUsageKey((k) => k + 1);
    } catch (e) {
      setMessage({ tone: "bad", text: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHead title="Settings" lead="Manage the data in this demo account." />
      {message && <p role="status" className={`chip ${message.tone} notice`}>{message.text}</p>}
      <div className="tabs" role="tablist" aria-label="Settings sections" onKeyDown={onKey}>
        {TABS.map((t) => (
          <button key={t.id} id={`tab-${t.id}`} role="tab" type="button" aria-selected={tab === t.id} aria-controls="settings-panel" tabIndex={tab === t.id ? 0 : -1} className={`tab${tab === t.id ? " active" : ""}`} onClick={() => pick(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="stack" id="settings-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "sample" && <section className="card" aria-labelledby="seed-h">
          <h2 id="seed-h">Sample data</h2>
          <p className="muted">Load a sample resume (a backend engineer with five years of experience) and three job descriptions, so you can try every page without uploading anything. Your current data is replaced.</p>
          <div className="row">
            <AiButton busy={busy === "seed"} disabled={busy !== null} busyLabel="Loading…" onClick={() => void run("seed")}>Load sample data</AiButton>
            {message?.tone === "good" && busy === null && <button className="btn secondary" type="button" onClick={() => go("dashboard")}>Go to dashboard</button>}
          </div>
        </section>}
        {tab === "delete" && <section className="card" aria-labelledby="clear-h">
          <h2 id="clear-h">Delete my data</h2>
          <p className="muted">Removes your resume, jobs, comparisons and chat history. Use this before adding your own documents or to start over.</p>
          <div className="row">
            <button className="btn secondary" type="button" disabled={busy !== null} onClick={() => void run("clear")}>{busy === "clear" ? "Deleting…" : "Delete all my data"}</button>
          </div>
        </section>}
        {tab === "usage" && <UsageCard refreshKey={usageKey} />}
      </div>
    </>
  );
}
