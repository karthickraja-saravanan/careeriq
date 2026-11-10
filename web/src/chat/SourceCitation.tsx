export interface SourceCitationProps {
  label: string;
  /** Known once the answer is complete and the source text is available. */
  known: boolean;
  open?: boolean;
  onClick?: () => void;
}

/** Inline badge such as R2 or J1-3. Clickable when the passage behind it is available. */
export function SourceCitation({ label, known, open, onClick }: SourceCitationProps) {
  const kind = label.startsWith("J") ? "job" : label === "S" ? "analysis" : "resume";
  if (!known) return <span className={`cite ${kind}`}>{label}</span>;
  return (
    <button type="button" className={`cite ${kind} live`} aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} source ${label}`} onClick={onClick}>
      {label}
    </button>
  );
}
