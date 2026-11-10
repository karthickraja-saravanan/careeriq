import type { ReactNode } from "react";

export const toLines = (items: string[]) => items.join("\n");
export const fromLines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);
export const fromCommas = (text: string) => text.split(/[,\n]/).map((l) => l.trim()).filter(Boolean);

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {hint && <span className="caption">{hint}</span>}
    </div>
  );
}

export function TextInput(props: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input id={props.id} className="input" value={props.value} placeholder={props.placeholder} onChange={(e) => props.onChange(e.target.value)} />;
}

export function TextArea(props: { id: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return <textarea id={props.id} className="input area" style={{ height: "auto" }} rows={props.rows ?? 3} value={props.value} onChange={(e) => props.onChange(e.target.value)} />;
}
