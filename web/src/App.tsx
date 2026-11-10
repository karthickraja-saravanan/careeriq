import { useEffect, useState } from "react";
import "./styles.css";
import { Dashboard } from "./views/Dashboard";
import { Resumes } from "./views/Resumes";
import { Jobs } from "./views/Jobs";
import { Compare } from "./views/Compare";
import { Assistant } from "./views/Assistant";
import { MotionConfig } from "motion/react";
import "./chat/chat.css";
import { AppShell } from "./shell/AppShell";
import { useChat } from "./chat/useChat";
import { Settings } from "./views/Settings";
import { Interview } from "./views/Interview";

const VIEWS = ["dashboard", "resume", "jobs", "compare", "assistant", "interview", "settings"];

const fromHash = () => VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "dashboard";

export function App() {
  const [view, setView] = useState(fromHash);
  useEffect(() => {
    const onHash = () => setView(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (id: string) => { location.hash = id; };
  const chat = useChat(); // lives here so the sidebar history and the Assistant page share it, and a running answer survives navigation

  return (
    <MotionConfig reducedMotion="user">
      <AppShell view={view} go={go} chat={chat}>
        {view === "dashboard" && <Dashboard go={go} />}
        {view === "resume" && <Resumes />}
        {view === "jobs" && <Jobs />}
        {view === "compare" && <Compare go={go} />}
        {view === "assistant" && <Assistant go={go} chat={chat} />}
        {view === "interview" && <Interview go={go} />}
        {view === "settings" && <Settings go={go} onReset={chat.reset} />}
      </AppShell>
    </MotionConfig>
  );
}
