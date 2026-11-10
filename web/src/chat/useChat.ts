import { useCallback, useEffect, useRef, useState } from "react";
import { api, streamAnswer, type ChatMessage, type Conversation } from "../api";

const STORAGE_KEY = "careeriq.conversation";
const read = () => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } };
const write = (id: string | null) => { try { if (id) localStorage.setItem(STORAGE_KEY, id); else localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ } };

/** All chat state and actions: conversation list, active conversation, streaming answer. The UI components only render this. */
export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(read);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Messages added during this visit; only these animate in, loaded history appears at once. */
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const justCreated = useRef<string | null>(null);
  const busy = streaming !== null;

  const refreshList = useCallback(() => api.listConversations().then(setConversations).catch(() => undefined), []);
  useEffect(() => { void refreshList(); }, [refreshList]);
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    if (justCreated.current === activeId) { justCreated.current = null; return; } // we created it: nothing to load yet
    let live = true;
    api.conversationMessages(activeId).then((m) => { if (live) setMessages(m); }).catch(() => { if (live) { setActiveId(null); write(null); } });
    return () => { live = false; };
  }, [activeId]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const select = useCallback((id: string | null) => {
    abortRef.current?.abort();
    setStreaming(null);
    setError(null);
    setActiveId(id);
    write(id);
  }, []);

  const send = useCallback(async (question: string): Promise<boolean> => {
    const content = question.trim();
    if (!content || busy) return false;
    setError(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      let id = activeId;
      if (!id) {
        const c = await api.createConversation();
        id = c.id;
        setConversations((l) => [c, ...l]);
        write(id);
        justCreated.current = id; // the history effect must not overwrite the messages we are about to show
        setActiveId(id);
      }
      setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content, citations: null }]);
      setStreaming("");
      let acc = "";
      await streamAnswer(id, content, {
        onToken: (t) => { acc += t; setStreaming(acc); },
        onDone: (d) => {
          setFresh((f) => new Set(f).add(d.messageId));
          setMessages((m) => [...m, { id: d.messageId, role: "assistant", content: d.content, citations: d.citations, latencyMs: d.latencyMs }]);
        },
      }, ac.signal);
      void refreshList();
      return true;
    } catch (e) {
      if (!ac.signal.aborted) setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setStreaming(null);
    }
  }, [activeId, busy, refreshList]);

  const remove = useCallback(async (id: string) => {
    await api.deleteConversation(id).catch(() => undefined);
    setConversations((l) => l.filter((c) => c.id !== id));
    if (id === activeId) select(null);
  }, [activeId, select]);

  const rename = useCallback(async (id: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    try {
      const updated = await api.renameConversation(id, clean);
      setConversations((l) => l.map((c) => (c.id === id ? { ...c, title: updated.title } : c)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename the chat");
    }
  }, []);

  /** After data was cleared or replaced elsewhere: forget the open conversation and reload the list. */
  const reset = useCallback(() => { select(null); void refreshList(); }, [select, refreshList]);

  return { reset, conversations, activeId, messages, streaming, busy, error, fresh, send, stop, select, remove, rename, clearError: () => setError(null) };
}
