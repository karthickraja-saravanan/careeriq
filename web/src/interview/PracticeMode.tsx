import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, CircleCheck, Eye, Repeat, RotateCcw } from "lucide-react";
import { KindChip, type Report } from "./kinds";
import { QuestionDetail } from "./QuestionDetail";

type Rating = "confident" | "practice";

/** One question at a time, like flash cards: think about your answer, reveal the guidance, rate yourself. */
export function PracticeMode({ report }: { report: Report }) {
  const total = report.questions.length;
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [revealed, setRevealed] = useState(false);
  const [ratings, setRatings] = useState<Record<number, Rating>>({});
  const [done, setDone] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // A new set of questions (regenerated or another job) starts a fresh session.
  useEffect(() => { setIndex(0); setRevealed(false); setRatings({}); setDone(false); }, [report]);

  const go = (to: number) => {
    if (to < 0) return;
    setDir(to > index ? 1 : -1);
    setRevealed(false);
    if (to >= total) setDone(true); else { setDone(false); setIndex(to); }
  };
  const rate = (r: Rating) => { setRatings((x) => ({ ...x, [index]: r })); go(index + 1); };
  const restart = (only?: number[]) => { setRatings(only ? Object.fromEntries(Object.entries(ratings).filter(([k]) => !only.includes(+k))) : {}); setDir(-1); setDone(false); setRevealed(false); setIndex(only?.[0] ?? 0); };

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("button, a, select, input, textarea")) return;
    if (e.key === "ArrowRight") go(index + 1);
    if (e.key === "ArrowLeft") go(index - 1);
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); setRevealed((r) => !r); }
  };

  const confident = Object.values(ratings).filter((r) => r === "confident").length;
  const toPractice = report.questions.map((_, i) => i).filter((i) => ratings[i] !== "confident");
  const q = report.questions[index]!;

  return (
    <div className="practice" ref={root} tabIndex={0} onKeyDown={onKey} aria-label="Practice mode. Arrow keys move between questions, space reveals the guidance.">
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done ? total : index}>
        <motion.div className="progress-fill" animate={{ width: `${((done ? total : index) / total) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 30 }} />
      </div>
      <div className="dots-row" aria-hidden="true">
        {report.questions.map((_, i) => (
          <button key={i} tabIndex={-1} className={`step ${i === index && !done ? "now" : ""} ${ratings[i] ?? ""}`} onClick={() => go(i)} />
        ))}
      </div>

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        {done ? (
          <motion.div key="done" className="flash summary" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <motion.span className="done-icon" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}><CircleCheck size={36} /></motion.span>
            <h2>Round complete</h2>
            <p className="muted">{confident} of {total} answers you feel confident about{toPractice.length ? `, ${toPractice.length} to practice more` : ". Nicely done."}</p>
            <div className="row center">
              {toPractice.length > 0 && <button type="button" className="btn" onClick={() => restart(toPractice)}><Repeat size={16} /> Practice the {toPractice.length} to review</button>}
              <button type="button" className="btn secondary" onClick={() => restart()}><RotateCcw size={16} /> Start over</button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={index}
            className="flash"
            custom={dir}
            variants={{ enter: (d: number) => ({ opacity: 0, x: 40 * d }), center: { opacity: 1, x: 0 }, exit: (d: number) => ({ opacity: 0, x: -40 * d }) }}
            initial="enter" animate="center" exit="exit" transition={{ duration: 0.22 }}
          >
            <div className="row spread">
              <span className="label">Question {index + 1} of {total}</span>
              <KindChip kind={q.kind} />
            </div>
            <h2 className="flash-q">{q.question}</h2>
            <AnimatePresence initial={false} mode="wait">
              {revealed ? (
                <motion.div key="a" className="flash-a" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <QuestionDetail q={q} sources={report.sources} />
                  <div className="rate">
                    <span className="muted">How did your answer feel?</span>
                    <div className="row">
                      <motion.button type="button" className="btn secondary" whileTap={{ scale: 0.95 }} onClick={() => rate("practice")}>Needs practice</motion.button>
                      <motion.button type="button" className="btn" whileTap={{ scale: 0.95 }} onClick={() => rate("confident")}>Confident</motion.button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="q" className="flash-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="muted">Say your answer out loud first, then check the guidance.</p>
                  <motion.button type="button" className="btn" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} onClick={() => setRevealed(true)}><Eye size={16} /> Show how to answer</motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {!done && (
        <div className="nav-row">
          <button type="button" className="btn secondary" disabled={index === 0} onClick={() => go(index - 1)}><ChevronLeft size={16} /> Previous</button>
          <span className="caption">← → to move · space to reveal</span>
          <button type="button" className="btn secondary" onClick={() => go(index + 1)}>{index === total - 1 ? "Finish" : "Skip"} <ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
}
