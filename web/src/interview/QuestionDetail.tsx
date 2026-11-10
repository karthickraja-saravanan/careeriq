import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Lightbulb, Target } from "lucide-react";
import type { InterviewQuestion } from "../api";
import type { Report } from "./kinds";

/** Why the question is asked, how to answer it, and the resume passages it is based on. Shared by the FAQ list and Practice mode. */
export function QuestionDetail({ q, sources }: { q: InterviewQuestion; sources: Report["sources"] }) {
  const [openCite, setOpenCite] = useState<string | null>(null);
  const source = openCite ? sources[openCite] : undefined;
  return (
    <div className="qd">
      {q.why && (
        <div className="qd-block">
          <span className="qd-label"><Target size={14} aria-hidden="true" /> Why they ask</span>
          <p>{q.why}</p>
        </div>
      )}
      {q.structure && (
        <div className="qd-block">
          <span className="qd-label"><Lightbulb size={14} aria-hidden="true" /> How to answer</span>
          <p>{q.structure}</p>
        </div>
      )}
      {q.basedOn.length > 0 && (
        <div className="qd-block">
          <span className="qd-label">Based on your resume</span>
          <div className="chips">
            {q.basedOn.map((c) => (
              <button key={c} type="button" className="chip cite" aria-expanded={openCite === c} aria-label={`Show source ${c}`} onClick={() => setOpenCite(openCite === c ? null : c)}>{c}{sources[c] ? ` · ${sources[c]!.section}` : ""}</button>
            ))}
          </div>
          <AnimatePresence initial={false}>
            {source && (
              <motion.blockquote key={openCite} className="source-quote" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                {source.content}
              </motion.blockquote>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
