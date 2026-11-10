import { AnimatePresence, motion } from "motion/react";
import { PanelLeft, Settings, SquarePen, X } from "lucide-react";
import type { Conversation } from "../api";
import { ChatHistory } from "./ChatHistory";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  collapsed: boolean;
  isMobile: boolean;
  drawerOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseDrawer: () => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
}

const WIDTH = 268;
const RAIL = 56;

export function ChatSidebar(p: Props) {
  const rail = !p.isMobile && p.collapsed;

  const content = (
    <>
      <div className="side-top">
        {!rail && <a className="wordmark" href="#dashboard">career<span>IQ</span></a>}
        {p.isMobile
          ? <button type="button" className="icon-btn" aria-label="Close chat history" onClick={p.onCloseDrawer}><X size={20} /></button>
          : <button type="button" className="icon-btn" aria-label={rail ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!rail} onClick={p.onToggleCollapsed}><PanelLeft size={20} /></button>}
      </div>
      <button type="button" className={`new-chat ${rail ? "rail" : ""}`} onClick={p.onNewChat} aria-label="New chat">
        <SquarePen size={18} />{!rail && <span>New chat</span>}
      </button>
      {!rail && (
        <div className="side-scroll">
          <ChatHistory conversations={p.conversations} activeId={p.activeId} onSelect={p.onSelect} onRename={p.onRename} onDelete={p.onDelete} />
        </div>
      )}
      {rail && <div className="side-scroll" />}
      <button type="button" className={`profile ${rail ? "rail" : ""}`} onClick={p.onOpenSettings} aria-label="Account and settings">
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
    <motion.aside className="sidebar" aria-label="Sidebar" initial={false} animate={{ width: rail ? RAIL : WIDTH }} transition={{ type: "spring", stiffness: 420, damping: 42 }}>
      {content}
    </motion.aside>
  );
}
