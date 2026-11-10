import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, FileText, Square } from "lucide-react";
import { motion } from "motion/react";

export interface MentionableResume {
  label: string; // CV1
  name: string;
}

interface Trigger {
  /** Index of the "@" or "/" in the text. */
  start: number;
  /** Caret position, i.e. the end of what has been typed after the trigger. */
  end: number;
  query: string;
}

/** Is the caret right after "@..." or "/..." at the start of a word? */
function findTrigger(text: string, caret: number): Trigger | null {
  const m = /(^|\s)([@/])([A-Za-z0-9]*)$/.exec(text.slice(0, caret));
  if (!m) return null;
  return { start: caret - m[3]!.length - 1, end: caret, query: m[3]!, ...(m[2] === "/" ? { slash: true } : {}) } as Trigger & { slash?: boolean };
}

const norm = (q: string) => q.toLowerCase().replace(/^r(?=\d)/, "cv");

interface Props {
  busy: boolean;
  /** Resumes that can be named with @CV1. */
  resumes?: MentionableResume[];
  disabled: boolean;
  onSend: (text: string) => Promise<boolean> | boolean;
  onStop: () => void;
}

const MAX_HEIGHT = 200;

export function ChatInput({ busy, disabled, resumes = [], onSend, onStop }: Props) {
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState(0);
  const [pick, setPick] = useState(0);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && !busy && value.trim().length > 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const trigger = findTrigger(value, caret) as (Trigger & { slash?: boolean }) | null;
  const options = !trigger || dismissed === trigger.start
    ? []
    : trigger.slash
      ? "resume".startsWith(trigger.query.toLowerCase()) ? resumes : []
      : resumes.filter((r) => r.label.toLowerCase().startsWith(norm(trigger.query)) || r.name.toLowerCase().includes(trigger.query.toLowerCase()));
  const open = options.length > 0 && !disabled;
  useEffect(() => setPick(0), [trigger?.start, trigger?.query, trigger?.slash]);

  const insert = (r: MentionableResume) => {
    if (!trigger) return;
    const next = `${value.slice(0, trigger.start)}@${r.label} ${value.slice(trigger.end)}`;
    const pos = trigger.start + r.label.length + 2;
    setValue(next);
    setCaret(pos);
    requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(pos, pos); });
  };

  const submit = async () => {
    if (!canSend) return;
    const text = value;
    setValue("");
    setCaret(0);
    const ok = await onSend(text);
    if (!ok) setValue((v) => v || text); // give the question back so it can be retried
    ref.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setPick((p) => (p + (e.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && !e.nativeEvent.isComposing) {
        e.preventDefault();
        insert(options[pick] ?? options[0]!);
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); setDismissed(trigger!.start); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="composer-wrap">
      <div className="composer-anchor">
      {open && (
        <ul className="mention-list" role="listbox" aria-label="Include a resume">
          {options.map((r, i) => (
            <li key={r.label} role="option" aria-selected={i === pick}>
              <button type="button" className={i === pick ? "on" : ""} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setPick(i)} onClick={() => insert(r)}>
                <FileText size={15} aria-hidden="true" />
                <span className="mention">{r.label}</span>
                <span className="mention-name">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="composer-box" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={2000}
          disabled={disabled}
          aria-label="Your question"
          placeholder={disabled ? "Add your resume and a job to start chatting" : resumes.length > 0 ? "Ask anything. Type @ to include a resume, e.g. @CV1" : "Ask anything about your career..."}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          onChange={(e) => { setValue(e.target.value); setCaret(e.target.selectionStart); }}
          onKeyUp={(e) => { if (!["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) setCaret(e.currentTarget.selectionStart); }}
          onClick={(e) => setCaret(e.currentTarget.selectionStart)}
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
      </div>
      <p className="composer-note">CareerIQ answers from your own documents and can make mistakes. Check the sources.</p>
    </div>
  );
}
