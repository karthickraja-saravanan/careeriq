import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";
import type { Source } from "../api";
import { Markdown } from "./Markdown";
import { SourceCitation } from "./SourceCitation";

interface Props {
  text: string;
  sources: Source[];
  /** True while the answer is still arriving: citations are not yet clickable and the source list is hidden. */
  streaming?: boolean;
  animate?: boolean;
}

/** Short replies (greetings, "I could not find that") make no claims about the documents, so they need no sources. */
const SUBSTANTIVE = 200;

export function AssistantMessage({ text, sources, streaming = false, animate = false }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const known = useMemo(() => new Set(sources.map((s) => s.cite.toUpperCase())), [sources]);
  const openSource = sources.find((s) => s.cite.toUpperCase() === open);
  const toggle = (label: string) => setOpen((o) => (o === label ? null : label));

  return (
    <motion.div className="ai-msg" initial={animate ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
      <div className="ai-avatar" aria-hidden="true"><Sparkles size={16} /></div>
      <div className="ai-body">
        <Markdown text={text} knownCites={known} openCite={open} onCite={toggle} />
        {streaming && <span className="caret" aria-hidden="true" />}
        {!streaming && sources.length === 0 && text.length > SUBSTANTIVE && <p className="no-sources">No sources were cited for this answer.</p>}
        {!streaming && sources.length > 0 && (
          <div className="sources" aria-label="Sources">
            <span className="sources-label">Sources</span>
            {sources.map((s) => (
              <button key={s.cite} type="button" className={`source-chip ${open === s.cite.toUpperCase() ? "on" : ""}`} onClick={() => toggle(s.cite.toUpperCase())} aria-expanded={open === s.cite.toUpperCase()}>
                <SourceCitation label={s.cite.toUpperCase()} known={false} />
                <span>{s.title} · {s.section}</span>
              </button>
            ))}
          </div>
        )}
        <AnimatePresence initial={false}>
          {openSource && (
            <motion.blockquote
              key={openSource.cite}
              className="source-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <strong>{openSource.cite} · {openSource.title} · {openSource.section}</strong>
              <span>{openSource.content}</span>
            </motion.blockquote>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function Thinking() {
  return (
    <motion.div className="ai-msg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="status" aria-label="The assistant is thinking">
      <div className="ai-avatar" aria-hidden="true"><Sparkles size={16} /></div>
      <div className="ai-body">
        <div className="dots" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <motion.span key={i} animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
