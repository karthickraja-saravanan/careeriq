import { Code, FileText, TriangleAlert, Users, type LucideIcon } from "lucide-react";
import type { InterviewQuestion, InterviewPrep } from "../api";

export type Kind = InterviewQuestion["kind"];
export const KINDS: Record<Kind, { label: string; icon: LucideIcon; tone: string }> = {
  experience: { label: "From your resume", icon: FileText, tone: "primary" },
  gap: { label: "Gap", icon: TriangleAlert, tone: "warn" },
  technical: { label: "Technical", icon: Code, tone: "neutral" },
  behavioral: { label: "Behavioral", icon: Users, tone: "neutral" },
};

export function KindChip({ kind }: { kind: Kind }) {
  const { label, icon: Icon, tone } = KINDS[kind];
  return <span className={`kind-chip ${tone}`}><Icon size={13} aria-hidden="true" /> {label}</span>;
}

export type Report = InterviewPrep["report"];
