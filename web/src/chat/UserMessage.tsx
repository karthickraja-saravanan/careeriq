import { Fragment } from "react";
import { motion } from "motion/react";

const MENTION = /(^|[^\w@])(@(?:CV|R|J|Job)\d+)\b/gi;

/** Shows "@CV1" as a small badge so it is clear which resume the question was about. */
function withMentions(text: string) {
  const parts: (string | { mention: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    const start = m.index! + m[1]!.length;
    parts.push(text.slice(last, start), { mention: m[2]!.toUpperCase() });
    last = start + m[2]!.length;
  }
  parts.push(text.slice(last));
  return parts.map((p, i) => (typeof p === "string" ? <Fragment key={i}>{p}</Fragment> : <span key={i} className="mention">{p.mention}</span>));
}

export function UserMessage({ text, animate }: { text: string; animate: boolean }) {
  return (
    <motion.div
      className="user-msg"
      initial={animate ? { opacity: 0, y: 14, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
    >
      <div className="user-bubble">{withMentions(text)}</div>
    </motion.div>
  );
}
