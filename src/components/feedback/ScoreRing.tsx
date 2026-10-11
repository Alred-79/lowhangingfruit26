"use client";

import { useCountUp } from "@/components/motion";

/** The rubric total as a ring that fills once, with the number counting up beside it. */
export default function ScoreRing({ total, max, percent, size = 148 }: { total: number; max: number; percent: number; size?: number }) {
  const shown = useCountUp(total, { duration: 1000 });
  const pct = useCountUp(percent, { duration: 1000 });
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`Rubric total ${total} of ${max}, ${percent} percent`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-slate-200)" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-brand-500)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, Math.max(0, pct)) / 100)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-[40px] font-semibold leading-none tabular text-ink">{Math.round(shown)}</div>
          <div className="mt-1 font-mono text-[12.5px] tabular-nums text-ink-3">of {max} · {Math.round(pct)}%</div>
        </div>
      </div>
    </div>
  );
}
