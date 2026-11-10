import { AiButton } from "../AiButton";
import { useState } from "react";
import { api } from "../api";
import { PageHead } from "../ui";
import { useCareerData } from "../useCareerData";

export function Settings({ go, onReset }: { go: (v: string) => void; onReset: () => void }) {
  const { data } = useCareerData();
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
      <div className="stack">
        <section className="card" aria-labelledby="seed-h">
          <h2 id="seed-h">Sample data</h2>
          <p className="muted">Load a sample resume (a backend engineer with five years of experience) and three job descriptions, so you can try every page without uploading anything. Your current data is replaced.</p>
          <div className="row">
            <AiButton busy={busy === "seed"} disabled={busy !== null} busyLabel="Loading…" onClick={() => void run("seed")}>Load sample data</AiButton>
            {message?.tone === "good" && busy === null && <button className="btn secondary" type="button" onClick={() => go("dashboard")}>Go to dashboard</button>}
          </div>
        </section>
        <section className="card" aria-labelledby="clear-h">
          <h2 id="clear-h">Delete my data</h2>
          <p className="muted">Removes your resume, jobs, comparisons and chat history. Use this before adding your own documents or to start over.</p>
          <div className="row">
            <button className="btn secondary" type="button" disabled={busy !== null} onClick={() => void run("clear")}>{busy === "clear" ? "Deleting…" : "Delete all my data"}</button>
          </div>
        </section>
      </div>
    </>
  );
}
