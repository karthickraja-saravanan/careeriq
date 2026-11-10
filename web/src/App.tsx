import { useEffect, useState } from "react";
import "./styles.css";
import { Dashboard } from "./views/Dashboard";
import { Resumes } from "./views/Resumes";
import { Jobs } from "./views/Jobs";
import { Compare } from "./views/Compare";
import { Assistant } from "./views/Assistant";
import { Interview } from "./views/Interview";

const views = [
  { id: "dashboard", label: "Dashboard" },
  { id: "resume", label: "Resume" },
  { id: "jobs", label: "Jobs" },
  { id: "compare", label: "Compare" },
  { id: "assistant", label: "Assistant" },
  { id: "interview", label: "Interview prep" },
] as const;

const fromHash = () => (views.find((v) => v.id === location.hash.slice(1)) ?? views[0]).id as string;

export function App() {
  const [view, setView] = useState(fromHash);
  useEffect(() => {
    const onHash = () => setView(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (id: string) => { location.hash = id; };

  return (
    <>
      <nav className="nav" aria-label="Main">
        <div className="nav-inner">
          <a className="wordmark" href="#dashboard">career<span>IQ</span></a>
          <div className="tabs">
            {views.map((v) => (
              <button key={v.id} className="tab" aria-current={view === v.id ? "page" : undefined} onClick={() => go(v.id)}>{v.label}</button>
            ))}
          </div>
          <span className="sample-badge">Sample data</span>
        </div>
      </nav>
      <main>
        {view === "dashboard" && <Dashboard go={go} />}
        {view === "resume" && <Resumes />}
        {view === "jobs" && <Jobs />}
        {view === "compare" && <Compare />}
        {view === "assistant" && <Assistant />}
        {view === "interview" && <Interview />}
      </main>
    </>
  );
}
