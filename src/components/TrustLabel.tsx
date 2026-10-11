import { BookOpen, CircleDot, FlaskConical, Lock, ShieldAlert, ShieldCheck } from "lucide-react";

// The honesty labels of the product. Wording is fixed: these words are part of the pitch and the
// docs refer to them verbatim. Always icon + text, never colour alone.
// Each label is a chip with its own icon tile, so it reads at a glance on busy, colorful screens.
const KINDS = {
  "ai-draft": { text: "AI-drafted, not faculty-reviewed", Icon: FlaskConical, cls: "bg-amber-100 text-amber-950 ring-amber-300", tile: "bg-amber-400 text-amber-950" },
  "ai-reviewed": { text: "AI-drafted, faculty-reviewed", Icon: ShieldCheck, cls: "bg-emerald-100 text-emerald-950 ring-emerald-300", tile: "bg-emerald-500 text-white" },
  sample: { text: "Sample", Icon: BookOpen, cls: "bg-sky-100 text-sky-950 ring-sky-300", tile: "bg-sky-500 text-white" },
  private: { text: "Private practice", Icon: Lock, cls: "bg-slate-100 text-slate-800 ring-slate-300", tile: "bg-slate-700 text-white" },
  recorded: { text: "Recorded for instructor", Icon: CircleDot, cls: "bg-violet-100 text-violet-950 ring-violet-300", tile: "bg-violet-600 text-white" },
  outside: { text: "Outside the case record", Icon: ShieldAlert, cls: "bg-rose-100 text-rose-950 ring-rose-300", tile: "bg-rose-600 text-white" },
} as const;

export type TrustKind = keyof typeof KINDS;

export default function TrustLabel({ kind, className = "", title, children }: { kind: TrustKind; className?: string; title?: string; children?: React.ReactNode }) {
  const k = KINDS[kind];
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-0.5 pl-0.5 pr-2.5 text-[11.5px] font-semibold ring-1 ring-inset ${k.cls} ${className}`}>
      <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full ${k.tile}`}>
        <k.Icon className="h-[11px] w-[11px]" strokeWidth={2.4} aria-hidden />
      </span>
      {children ?? k.text}
    </span>
  );
}
