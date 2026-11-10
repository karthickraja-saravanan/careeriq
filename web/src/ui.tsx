import type { CSSProperties, ReactNode } from "react";

export function scoreTone(score: number): { color: string; label: string } {
  if (score >= 75) return { color: "var(--good)", label: "Strong match" };
  if (score >= 55) return { color: "var(--warn)", label: "Partial match" };
  return { color: "var(--bad)", label: "Stretch" };
}

export function Ring({ score, big = false }: { score: number; big?: boolean }) {
  const style = { "--v": score, "--ring-color": scoreTone(score).color } as CSSProperties;
  return (
    <div className={`ring${big ? " big" : ""}`} style={style} role="img" aria-label={`Match score ${score} out of 100`}>
      <span className="num">{score}</span>
    </div>
  );
}

export function Bar({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div className="bar">
      <div className="row spread">
        <span>{label}</span>
        <span className="caption num">{detail ?? `${value}%`}</span>
      </div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${value}%`, background: scoreTone(value).color }} /></div>
    </div>
  );
}

export function PageHead({ title, lead, action }: { title: string; lead: string; action?: ReactNode }) {
  return (
    <header className="head">
      <div className="row spread">
        <h1>{title}</h1>
        {action}
      </div>
      <p className="lead">{lead}</p>
    </header>
  );
}

export function Bullets({ items, tone }: { items: string[]; tone: "good" | "bad" | "warn" }) {
  return (
    <ul className="list">
      {items.map((t) => (<li key={t}><span className={`dot ${tone}`} /><span>{t}</span></li>))}
    </ul>
  );
}
