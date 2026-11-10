import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import type { InterviewQuestion } from "../api";
import { KINDS, KindChip, type Kind, type Report } from "./kinds";
import { QuestionDetail } from "./QuestionDetail";

/** Questions as an accordion: scan the list, open the ones you want to prepare. Filter by kind. */
export function FaqList({ report }: { report: Report }) {
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [open, setOpen] = useState<Set<number>>(new Set([0]));
  const counts = useMemo(() => {
    const c: Partial<Record<Kind, number>> = {};
    for (const q of report.questions) c[q.kind] = (c[q.kind] ?? 0) + 1;
    return c;
  }, [report.questions]);
  const items = report.questions.map((q, i) => ({ q, i })).filter(({ q }) => filter === "all" || q.kind === filter);
  const allOpen = items.length > 0 && items.every(({ i }) => open.has(i));

  const toggle = (i: number) => setOpen((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <div className="faq">
      <div className="faq-bar">
        <div className="chips" role="group" aria-label="Filter by kind">
          <button type="button" className="pill sm" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All · {report.questions.length}</button>
          {(Object.keys(KINDS) as Kind[]).filter((k) => counts[k]).map((k) => (
            <button key={k} type="button" className="pill sm" aria-pressed={filter === k} onClick={() => setFilter(k)}>{KINDS[k].label} · {counts[k]}</button>
          ))}
        </div>
        <button type="button" className="link" onClick={() => setOpen(allOpen ? new Set() : new Set(items.map(({ i }) => i)))}>{allOpen ? "Collapse all" : "Expand all"}</button>
      </div>
      <ul className="faq-list">
        <AnimatePresence initial={false}>
          {items.map(({ q, i }) => (
            <FaqItem key={q.question} q={q} n={i + 1} isOpen={open.has(i)} onToggle={() => toggle(i)} sources={report.sources} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function FaqItem({ q, n, isOpen, onToggle, sources }: { q: InterviewQuestion; n: number; isOpen: boolean; onToggle: () => void; sources: Report["sources"] }) {
  return (
    <motion.li layout="position" className={`faq-item ${isOpen ? "open" : ""}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <button type="button" className="faq-q" aria-expanded={isOpen} onClick={onToggle}>
        <span className="faq-n">{n}</span>
        <span className="faq-text">
          <span className="faq-title">{q.question}</span>
          <KindChip kind={q.kind} />
        </span>
        <motion.span className="faq-chev" animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} aria-hidden="true"><ChevronDown size={18} /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div key="a" className="faq-a" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
            <QuestionDetail q={q} sources={sources} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
