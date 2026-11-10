import { motion } from "motion/react";
import { ChatHeader } from "../chat/ChatHeader";
import { ChatInput } from "../chat/ChatInput";
import { ChatMessages } from "../chat/ChatMessages";
import { SuggestedPrompts } from "../chat/SuggestedPrompts";
import type { useChat } from "../chat/useChat";
import { readyJobs, useCareerData } from "../useCareerData";

export function Assistant({ go, chat }: { go: (v: string) => void; chat: ReturnType<typeof useChat> }) {
  const { data } = useCareerData();
  const resumeReady = !!data?.resume && data.resume.status === "ready";
  const ready = resumeReady && !!data && readyJobs(data).length > 0;
  const mentionable = (data?.resumes ?? []).filter((r) => r.status === "ready").slice().sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })).map((r) => ({ label: r.label, name: r.parsed?.name ?? r.filename ?? "Resume" }));
  const title = chat.conversations.find((c) => c.id === chat.activeId)?.title ?? null;
  const empty = chat.messages.length === 0 && !chat.busy;

  return (
    <div className="gpt">
      <section className="chat-main" aria-label="Assistant">
        <ChatHeader title={title} />
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
          <ChatInput busy={chat.busy} disabled={!ready} resumes={mentionable} onSend={chat.send} onStop={chat.stop} />
        </div>
      </section>
    </div>
  );
}
