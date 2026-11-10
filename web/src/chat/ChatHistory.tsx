import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import type { Conversation } from "../api";
import { groupConversations } from "./groupConversations";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

function Item({ c, active, onSelect, onRename, onDelete }: { c: Conversation; active: boolean } & Pick<Props, "onSelect" | "onRename" | "onDelete">) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const root = useRef<HTMLLIElement>(null);
  const title = c.title ?? "New chat";

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [menu]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== title) onRename(c.id, draft);
  };

  return (
    <li ref={root} className={`history-item ${active ? "active" : ""} ${menu ? "menu-open" : ""}`}>
      {editing ? (
        <input
          className="rename-input"
          autoFocus
          value={draft}
          maxLength={120}
          aria-label="Chat name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        />
      ) : (
        <>
          <button type="button" className="history-title" aria-current={active ? "true" : undefined} onClick={() => onSelect(c.id)} title={title}>{title}</button>
          <button type="button" className="history-more" aria-label={`Options for ${title}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <Ellipsis size={16} />
          </button>
        </>
      )}
      <AnimatePresence>
        {menu && (
          <motion.div className="popover" role="menu" initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.12 }}>
            <button type="button" role="menuitem" onClick={() => { setMenu(false); setDraft(title); setEditing(true); }}><Pencil size={15} /> Rename</button>
            <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(false); if (window.confirm(`Delete "${title}"? This cannot be undone.`)) onDelete(c.id); }}><Trash2 size={15} /> Delete</button>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** Conversations grouped by age. Scrolls on its own, independent of the message area. */
export function ChatHistory({ conversations, activeId, onSelect, onRename, onDelete }: Props) {
  const groups = groupConversations(conversations);
  if (groups.length === 0) return <p className="history-empty">Your conversations will appear here.</p>;
  return (
    <nav className="history" aria-label="Chat history">
      {groups.map((g) => (
        <section key={g.label}>
          <h2 className="history-group">{g.label}</h2>
          <ul>
            {g.items.map((c) => <Item key={c.id} c={c} active={c.id === activeId} onSelect={onSelect} onRename={onRename} onDelete={onDelete} />)}
          </ul>
        </section>
      ))}
    </nav>
  );
}
