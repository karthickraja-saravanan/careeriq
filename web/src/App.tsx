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

/** "#compare/<id>" is the Compare page with one comparison selected; the part after the slash is the page's parameter. */
const fromHash = () => {
  const [view = "", param = null] = location.hash.slice(1).split("/");
  return { view: VIEWS.includes(view) ? view : "dashboard", param };
};

export function App() {
  const [route, setRoute] = useState(fromHash);
  const { view, param } = route;
  useEffect(() => {
    const onHash = () => setRoute(fromHash());
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
        {view === "jobs" && <Jobs go={go} />}
        {view === "compare" && <Compare go={go} selectedId={param} />}
        {view === "assistant" && <Assistant go={go} chat={chat} />}
        {view === "interview" && <Interview go={go} />}
        {view === "settings" && <Settings go={go} onReset={chat.reset} />}
      </AppShell>
    </MotionConfig>
  );
}
