import { useEffect, useState } from "react";
import { MotionConfig, motion } from "motion/react";
import { ChatHeader } from "../chat/ChatHeader";
import { ChatInput } from "../chat/ChatInput";
import { ChatMessages } from "../chat/ChatMessages";
import { ChatSidebar } from "../chat/ChatSidebar";
import { SuggestedPrompts } from "../chat/SuggestedPrompts";
import { useChat } from "../chat/useChat";
import { useMediaQuery } from "../chat/useMediaQuery";
import { readyJobs, useCareerData } from "../useCareerData";
import "../chat/chat.css";

const COLLAPSED_KEY = "careeriq.sidebar-collapsed";
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { return false; } };

export function Assistant({ go }: { go: (v: string) => void }) {
  const chat = useChat();
  const { data } = useCareerData();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => { try { localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0"); } catch { /* storage unavailable */ } }, [collapsed]);
  useEffect(() => { if (!isMobile) setDrawer(false); }, [isMobile]);

  const resumeReady = !!data?.resume && data.resume.status === "ready";
  const ready = resumeReady && !!data && readyJobs(data).length > 0;
  const title = chat.conversations.find((c) => c.id === chat.activeId)?.title ?? null;
  const empty = chat.messages.length === 0 && !chat.busy;

  const newChat = () => { chat.select(null); setDrawer(false); };
  const select = (id: string) => { chat.select(id); setDrawer(false); };

  return (
    <MotionConfig reducedMotion="user">
      <div className="gpt">
        <ChatSidebar
          conversations={chat.conversations}
          activeId={chat.activeId}
          collapsed={collapsed}
          isMobile={isMobile}
          drawerOpen={drawer}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          onCloseDrawer={() => setDrawer(false)}
          onNewChat={newChat}
          onSelect={select}
          onRename={(id, t) => void chat.rename(id, t)}
          onDelete={(id) => void chat.remove(id)}
          onOpenSettings={() => go("settings")}
        />
        <section className="chat-main" aria-label="Assistant">
          <ChatHeader title={title} isMobile={isMobile} onOpenSidebar={() => setDrawer(true)} onNewChat={newChat} />
          {empty ? (
            <div className="empty">
              <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>Where should we take your career next?</motion.h2>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08, duration: 0.35 }}>
                Ask anything about your resume, job opportunities, skills, or interview preparation.
              </motion.p>
              <SuggestedPrompts disabled={!ready} onPick={(t) => void chat.send(t)} />
            </div>
          ) : (
            <ChatMessages messages={chat.messages} streaming={chat.streaming} fresh={chat.fresh} />
          )}
          <div className="dock">
            {data && !ready && (
              <p className="notice-row" role="status">
                {resumeReady ? "Add at least one job description" : "Add and process your resume"} to start chatting.{" "}
                <button type="button" className="link" onClick={() => go(resumeReady ? "jobs" : "resume")}>Go there</button> or{" "}
                <button type="button" className="link" onClick={() => go("settings")}>load sample data</button>.
              </p>
            )}
            {chat.error && (
              <p className="error-row" role="alert">
                {chat.error} <button type="button" className="link" onClick={chat.clearError}>Dismiss</button>
              </p>
            )}
            <ChatInput busy={chat.busy} disabled={!ready} onSend={chat.send} onStop={chat.stop} />
          </div>
        </section>
      </div>
    </MotionConfig>
  );
}
