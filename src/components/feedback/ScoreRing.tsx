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
        <defs>
          <linearGradient id="score-ring-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--color-brand-500)" />
            <stop offset="1" stopColor="var(--color-mastery)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-brand-100)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="url(#score-ring-g)" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} className="ring-fill" style={{ "--from": c } as React.CSSProperties} />
        <circle cx="50" cy="50" r="49" fill="none" stroke="var(--color-mastery)" strokeOpacity="0.3" strokeWidth="1" className="orbit-dash" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center" aria-hidden>
        <div>
          <div className="count-up font-display text-[46px] font-black leading-none tracking-[-0.04em] tabular text-ink" style={{ "--to": Math.round(total) } as React.CSSProperties} />
          <span className="sr-only">{Math.round(total)}</span>
          <div className="mt-1 font-mono text-[12.5px] tabular-nums text-ink-3">
            of {max} · {percent}%
          </div>
        </div>
      </div>
    </div>
  );
}
