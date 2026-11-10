import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { api, streamAnswer, type ChatMessage, type Conversation, type Source } from "../api";
import { PageHead } from "../ui";
import { readyJobs, useCareerData } from "../useCareerData";

const CITE = /^(?:R\d+|J\d+-\d+|S)$/i;
const STORAGE_KEY = "careeriq.conversation";
const read = () => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } };
const write = (id: string | null) => { try { id ? localStorage.setItem(STORAGE_KEY, id) : localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ } };

/** Bold text and [R2] / [J1-3] citation markers; everything else stays plain text (never raw HTML). */
function Inline({ text, sources, onCite }: { text: string; sources: Source[]; onCite: (c: string) => void }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
        const labels = part.startsWith("[") ? part.slice(1, -1).split(/[,;\s]+/).filter(Boolean) : [];
        if (labels.length && labels.every((l) => CITE.test(l))) {
          return (
            <Fragment key={i}>
              {labels.map((l) => {
                const known = sources.some((s) => s.cite.toUpperCase() === l.toUpperCase());
                return known
                  ? <button key={l} type="button" className="chip cite" onClick={() => onCite(l.toUpperCase())} aria-label={`Show source ${l}`}>{l.toUpperCase()}</button>
                  : <span key={l} className="chip">{l.toUpperCase()}</span>;
              })}
            </Fragment>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

function Answer({ text, sources, onCite }: { text: string; sources: Source[]; onCite: (c: string) => void }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const isList = lines.length > 0 && lines.every((l) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(l));
        const strip = (l: string) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "");
        return isList ? (
          <ul key={i} className="plain-list">{lines.map((l, j) => <li key={j}><Inline text={strip(l)} sources={sources} onCite={onCite} /></li>)}</ul>
        ) : (
          <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}<Inline text={l} sources={sources} onCite={onCite} /></Fragment>)}</p>
        );
      })}
    </>
  );
}

export function Assistant({ go }: { go: (v: string) => void }) {
  const { data } = useCareerData();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(read);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ messageId: string; cite: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const justCreated = useRef<string | null>(null);
  const busy = streaming !== null;

  useEffect(() => { api.listConversations().then(setConversations).catch(() => undefined); }, []);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!conversationId) { setMessages([]); return; }
    if (justCreated.current === conversationId) { justCreated.current = null; return; } // we created it: nothing to load yet
    let live = true;
    api.conversationMessages(conversationId).then((m) => { if (live) setMessages(m); }).catch(() => { if (live) { setConversationId(null); write(null); } });
    return () => { live = false; };
  }, [conversationId]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [messages, streaming]);

  const jobs = data ? readyJobs(data) : [];
  const ready = !!data?.resume && data.resume.status === "ready" && jobs.length > 0;
  const suggestions = [
    jobs[0] ? `What skills am I missing for ${jobs[0].label}?` : "What skills am I missing?",
    jobs.length > 1 ? "Which job is the best match for my profile?" : "How well does my resume fit this job?",
    "Which projects should I highlight?",
  ];

  const newChat = () => { abortRef.current?.abort(); setStreaming(null); setConversationId(null); write(null); setMessages([]); setError(null); setOpen(null); };

  const ask = async (question: string) => {
    const content = question.trim();
    if (!content || busy) return;
    setError(null);
    setDraft("");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      let id = conversationId;
      if (!id) {
        const c = await api.createConversation();
        id = c.id;
        setConversations((l) => [c, ...l]);
        write(id);
        justCreated.current = id; // the history effect must not overwrite the messages we are about to show
        setConversationId(id);
      }
      setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content, citations: null }]);
      setStreaming("");
      let acc = "";
      await streamAnswer(id, content, {
        onToken: (t) => { acc += t; setStreaming(acc); },
        onDone: (d) => setMessages((m) => [...m, { id: d.messageId, role: "assistant", content: d.content, citations: d.citations, latencyMs: d.latencyMs }]),
      }, ac.signal);
      api.listConversations().then(setConversations).catch(() => undefined);
    } catch (e) {
      if (!ac.signal.aborted) { setError(e instanceof Error ? e.message : "Something went wrong"); setDraft(content); }
    } finally {
      setStreaming(null);
    }
  };

  const remove = async () => {
    if (!conversationId) return;
    await api.deleteConversation(conversationId).catch(() => undefined);
    setConversations((l) => l.filter((c) => c.id !== conversationId));
    newChat();
  };

  const sourceFor = (m: ChatMessage) => (open?.messageId === m.id ? m.citations?.find((s) => s.cite.toUpperCase() === open.cite) : undefined);

  return (
    <>
      <PageHead
        title="Ask about your fit"
        lead="Answers come from your resume and the job descriptions you added, with sources. If something is not in your documents, the assistant says so."
        action={
          <div className="row">
            {conversations.length > 0 && (
              <select className="select" aria-label="Past conversations" value={conversationId ?? ""} onChange={(e) => { abortRef.current?.abort(); setStreaming(null); setOpen(null); const v = e.target.value || null; setConversationId(v); write(v); }}>
                <option value="">New conversation</option>
                {conversations.map((c) => <option key={c.id} value={c.id}>{c.title ?? "Untitled"}</option>)}
              </select>
            )}
            {conversationId && <button className="btn secondary" type="button" onClick={() => void remove()}>Delete chat</button>}
            {messages.length > 0 && <button className="btn secondary" type="button" onClick={newChat}>New chat</button>}
          </div>
        }
      />
      {data && !ready && (
        <p className="chip warn notice" role="status">
          {!data.resume || data.resume.status !== "ready" ? "Add and process your resume" : "Add at least one job description"} before asking questions.{" "}
          <button type="button" className="link" onClick={() => go(!data.resume || data.resume.status !== "ready" ? "resume" : "jobs")}>Go there</button>
        </p>
      )}
      <div className="card">
        <div className="chat" aria-live="polite">
          {messages.length === 0 && !busy && <p className="muted">Try one of the questions below, or ask your own.</p>}
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="msg user">{m.content}</div>
            ) : (
              <div key={m.id} className="msg ai">
                <Answer text={m.content} sources={m.citations ?? []} onCite={(c) => setOpen((o) => (o?.messageId === m.id && o.cite === c ? null : { messageId: m.id, cite: c }))} />
                {!m.citations?.length && <span className="chip warn">No sources cited</span>}
                {sourceFor(m) && (
                  <blockquote className="source">
                    <strong>{sourceFor(m)!.cite} · {sourceFor(m)!.title} · {sourceFor(m)!.section}</strong>
                    <span>{sourceFor(m)!.content}</span>
                  </blockquote>
                )}
              </div>
            ),
          )}
          {busy && (
            <div className="msg ai" aria-busy="true">
              {streaming ? <Answer text={streaming} sources={[]} onCite={() => undefined} /> : <p className="muted">Thinking…</p>}
            </div>
          )}
          <div ref={endRef} />
        </div>
        {error && <p role="alert" className="chip bad notice">{error}</p>}
        <div className="chips">
          {suggestions.map((s) => (<button key={s} type="button" className="pill" disabled={!ready || busy} onClick={() => void ask(s)}>{s}</button>))}
        </div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); void ask(draft); }}>
          <input id="chat-input" className="input" value={draft} maxLength={2000} disabled={!ready} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about a role or your resume" aria-label="Your question" />
          {busy
            ? <button className="btn" type="button" onClick={() => abortRef.current?.abort()}>Stop</button>
            : <button className="btn" type="submit" disabled={!ready || !draft.trim()}>Send</button>}
        </form>
      </div>
    </>
  );
}
