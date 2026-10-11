// The rubric total as a ring that fills once, with the number counting up inside it. Both are CSS
// animations (globals.css: .count-up, .ring-fill): they start on first paint, need no JavaScript and
// stop under prefers-reduced-motion. The real values are in the markup for screen readers.
export default function ScoreRing({ total, max, percent, size = 148 }: { total: number; max: number; percent: number; size?: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, percent)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`Rubric total ${total} of ${max}, ${percent} percent`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-slate-200)" strokeWidth="7" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-brand-500)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} className="ring-fill" style={{ "--from": c } as React.CSSProperties} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center" aria-hidden>
        <div>
          <div className="count-up font-display text-[40px] font-semibold leading-none tabular text-ink" style={{ "--to": Math.round(total) } as React.CSSProperties} />
          <div className="mt-1 font-mono text-[12.5px] tabular-nums text-ink-3">
            of {max} · {percent}%
          </div>
        </div>
      </div>
    </div>
  );
}
