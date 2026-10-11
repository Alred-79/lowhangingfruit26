import { BookOpen, CircleDot, FlaskConical, Lock, ShieldAlert, ShieldCheck } from "lucide-react";

// The honesty labels of the product. Wording is fixed: these words are part of the pitch and the
// docs refer to them verbatim. Always icon + text, never colour alone.
const KINDS = {
  "ai-draft": { text: "AI-drafted, not faculty-reviewed", Icon: FlaskConical, cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  "ai-reviewed": { text: "AI-drafted, faculty-reviewed", Icon: ShieldCheck, cls: "bg-brand-50 text-brand-800 ring-brand-200" },
  sample: { text: "Sample", Icon: BookOpen, cls: "bg-sky-50 text-sky-800 ring-sky-200" },
  private: { text: "Private practice", Icon: Lock, cls: "bg-slate-100 text-slate-700 ring-slate-200" },
  recorded: { text: "Recorded for instructor", Icon: CircleDot, cls: "bg-violet-50 text-violet-800 ring-violet-200" },
  outside: { text: "Outside the case record", Icon: ShieldAlert, cls: "bg-rose-50 text-rose-800 ring-rose-200" },
} as const;

export type TrustKind = keyof typeof KINDS;

export default function TrustLabel({ kind, className = "", title, children }: { kind: TrustKind; className?: string; title?: string; children?: React.ReactNode }) {
  const k = KINDS[kind];
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-inset ${k.cls} ${className}`}>
      <k.Icon className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
      {children ?? k.text}
    </span>
  );
}
