import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";
import { motion } from "motion/react";

interface Props {
  busy: boolean;
  disabled: boolean;
  onSend: (text: string) => Promise<boolean> | boolean;
  onStop: () => void;
}

const MAX_HEIGHT = 200;

export function ChatInput({ busy, disabled, onSend, onStop }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && !busy && value.trim().length > 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const submit = async () => {
    if (!canSend) return;
    const text = value;
    setValue("");
    const ok = await onSend(text);
    if (!ok) setValue((v) => v || text); // give the question back so it can be retried
    ref.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="composer-wrap">
      <form className="composer-box" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={2000}
          disabled={disabled}
          aria-label="Your question"
          placeholder={disabled ? "Add your resume and a job to start chatting" : "Ask anything about your career..."}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {busy ? (
          <motion.button key="stop" type="button" className="send stop" aria-label="Stop generating" onClick={onStop} initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
            <Square size={14} fill="currentColor" />
          </motion.button>
        ) : (
          <motion.button key="send" type="submit" className="send" aria-label="Send message" disabled={!canSend} whileTap={canSend ? { scale: 0.92 } : undefined}>
            <ArrowUp size={18} />
          </motion.button>
        )}
      </form>
      <p className="composer-note">CareerIQ answers from your own documents and can make mistakes. Check the sources.</p>
    </div>
  );
}
