import { motion } from "motion/react";
import { BarChart3, FileText, GitCompare, MessagesSquare, Target } from "lucide-react";

const PROMPTS = [
  { text: "What skills am I missing for this job?", icon: Target },
  { text: "Which job is the best match for my profile?", icon: BarChart3 },
  { text: "How can I improve my resume?", icon: FileText },
  { text: "Compare my profile against a job description.", icon: GitCompare },
  { text: "What should I prepare for my next interview?", icon: MessagesSquare },
];

export function SuggestedPrompts({ disabled, onPick }: { disabled: boolean; onPick: (text: string) => void }) {
  return (
    <div className="prompts">
      {PROMPTS.map(({ text, icon: Icon }, i) => (
        <motion.button
          key={text}
          type="button"
          className="prompt-card"
          disabled={disabled}
          onClick={() => onPick(text)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 * i + 0.1, duration: 0.3, ease: "easeOut" }}
          whileHover={disabled ? undefined : { y: -2 }}
          whileTap={disabled ? undefined : { scale: 0.98 }}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{text}</span>
        </motion.button>
      ))}
    </div>
  );
}
