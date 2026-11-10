import { motion } from "motion/react";

export function UserMessage({ text, animate }: { text: string; animate: boolean }) {
  return (
    <motion.div
      className="user-msg"
      initial={animate ? { opacity: 0, y: 14, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
    >
      <div className="user-bubble">{text}</div>
    </motion.div>
  );
}
