import { AnimatePresence, motion } from "motion/react";
import { Briefcase, FileText, GitCompare, GraduationCap, LayoutDashboard, MessageSquare, PanelLeft, Settings, SquarePen, X, type LucideIcon } from "lucide-react";
import type { Conversation } from "../api";
import { ChatHistory } from "../chat/ChatHistory";

export const NAV: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "resume", label: "Resume", icon: FileText },
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "compare", label: "Compare", icon: GitCompare },
  { id: "assistant", label: "Assistant", icon: MessageSquare },
  { id: "interview", label: "Interview prep", icon: GraduationCap },
];

interface Props {
  view: string;
  go: (id: string) => void;
  collapsed: boolean;
  isMobile: boolean;
  drawerOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseDrawer: () => void;
  chat: {
    conversations: Conversation[];
    activeId: string | null;
    onNewChat: () => void;
    onSelect: (id: string) => void;
    onRename: (id: string, title: string) => void;
    onDelete: (id: string) => void;
  };
}

const WIDTH = 268;
const RAIL = 60;

/** App-wide navigation. When the Assistant page is open, the chat history appears below the menu. */
export function AppSidebar(p: Props) {
  const rail = !p.isMobile && p.collapsed;
  const inChat = p.view === "assistant";

  const content = (
    <>
      <div className="side-top">
        {!rail && <a className="wordmark" href="#dashboard">career<span>IQ</span></a>}
        {p.isMobile
          ? <button type="button" className="icon-btn" aria-label="Close menu" onClick={p.onCloseDrawer}><X size={20} /></button>
          : <button type="button" className="icon-btn" aria-label={rail ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!rail} onClick={p.onToggleCollapsed}><PanelLeft size={20} /></button>}
      </div>

      <nav className="side-nav" aria-label="Main">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = p.view === id;
          return (
            <button key={id} type="button" className={`side-link ${rail ? "rail" : ""}`} aria-current={active ? "page" : undefined} title={rail ? label : undefined} aria-label={label} onClick={() => p.go(id)}>
              {active && <motion.span layoutId="side-active" className="side-active" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <Icon size={18} aria-hidden="true" />
              {!rail && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      {inChat && (
        <>
          <button type="button" className={`new-chat ${rail ? "rail" : ""}`} onClick={p.chat.onNewChat} aria-label="New chat" title={rail ? "New chat" : undefined}>
            <SquarePen size={18} />{!rail && <span>New chat</span>}
          </button>
          {!rail && (
            <div className="side-scroll">
              <ChatHistory conversations={p.chat.conversations} activeId={p.chat.activeId} onSelect={p.chat.onSelect} onRename={p.chat.onRename} onDelete={p.chat.onDelete} />
            </div>
          )}
        </>
      )}
      <div className={inChat && !rail ? "" : "grow"} />

      <button type="button" className={`profile ${rail ? "rail" : ""} ${p.view === "settings" ? "on" : ""}`} onClick={() => p.go("settings")} aria-label="Account and settings" aria-current={p.view === "settings" ? "page" : undefined} title={rail ? "Settings" : undefined}>
        <span className="avatar" aria-hidden="true">D</span>
        {!rail && <><span className="profile-name">Demo User<small>Settings</small></span><Settings size={16} aria-hidden="true" /></>}
      </button>
    </>
  );

  if (p.isMobile) {
    return (
      <AnimatePresence>
        {p.drawerOpen && (
          <>
            <motion.div key="scrim" className="scrim" onClick={p.onCloseDrawer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.aside key="drawer" className="sidebar drawer" aria-label="Sidebar" initial={{ x: -WIDTH }} animate={{ x: 0 }} exit={{ x: -WIDTH }} transition={{ type: "spring", stiffness: 420, damping: 40 }}>
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    );
  }
  return (
    <motion.aside className="sidebar" aria-label="Sidebar" initial={false} animate={{ width: p.collapsed ? RAIL : WIDTH }} transition={{ type: "spring", stiffness: 420, damping: 42 }}>
      {content}
    </motion.aside>
  );
}
