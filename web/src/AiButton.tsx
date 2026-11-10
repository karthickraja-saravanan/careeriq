import type { ButtonHTMLAttributes } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Sparkles, type LucideIcon } from "lucide-react";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> {
  children: string;
  /** True while the AI action runs: shows a spinner, the busy label and a shimmer, and blocks clicks. */
  busy?: boolean;
  busyLabel?: string;
  icon?: LucideIcon;
  variant?: "primary" | "secondary";
}

/**
 * Button for every action that calls the AI (analyze, generate, reparse...).
 * The icon wiggles on hover, presses in on click, and swaps to a spinner with a label change while the request runs.
 * Animations are switched off for people who prefer reduced motion (MotionConfig in App).
 */
export function AiButton({ children, busy = false, busyLabel, icon: Icon = Sparkles, variant = "primary", disabled, className = "", type = "button", ...rest }: Props) {
  const off = disabled || busy;
  return (
    <motion.button
      {...rest}
      type={type}
      disabled={off}
      aria-busy={busy || undefined}
      className={`btn ai-btn ${variant === "secondary" ? "secondary" : ""} ${busy ? "busy" : ""} ${className}`}
      whileHover={off ? undefined : { scale: 1.03 }}
      whileTap={off ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
    >
      <span className="ai-icon" aria-hidden="true">
        <AnimatePresence mode="wait" initial={false}>
          {busy ? (
            <motion.span key="spin" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1, rotate: 360 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ rotate: { repeat: Infinity, duration: 0.9, ease: "linear" }, duration: 0.15 }}>
              <Loader2 size={16} />
            </motion.span>
          ) : (
            <motion.span key="icon" className="ai-icon-idle" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.15 }}>
              <Icon size={16} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={busy ? "busy" : "idle"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
          {busy ? busyLabel ?? "Working…" : children}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
