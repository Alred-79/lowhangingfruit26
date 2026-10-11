import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/components/ui";
import "./fac.css";

/*
 * Faculty data marks. Server-renderable (no hooks), CSS motion only.
 * dataviz rules applied: the number always appears as text next to the mark; text wears ink tokens,
 * never the series color; thin 2px lines, >= 8px end dots with a 2px surface ring; sequential color is
 * one hue light -> dark; tooltips are native <title> plus a focusable wrapper where the mark is interactive.
 */

const v = (o: Record<string, string | number>) => o as CSSProperties;

/** Sparkline over 0..max. `live` adds a pulsing ring on the latest point; `area` adds a 10% wash. */
export function Spark({
  values,
  max = 100,
  min = 0,
  w = 120,
  h = 36,
  color = "var(--color-brand-600)",
  ring = "var(--color-surface)",
  live = false,
  area = true,
  label,
  className,
  i = 0,
}: {
  values: number[];
  max?: number;
  min?: number;
  w?: number;
  h?: number;
  color?: string;
  ring?: string;
  live?: boolean;
  area?: boolean;
  label: string;
  className?: string;
  i?: number;
}) {
  const pad = 5;
  if (!values.length) return <svg viewBox={`0 0 ${w} ${h}`} className={className} role="img" aria-label={`${label}: no data yet`} />;
  const span = max - min || 1;
  const x = (k: number) => (values.length === 1 ? w - pad : pad + (k * (w - pad * 2)) / (values.length - 1));
  const y = (val: number) => h - pad - ((Math.max(min, Math.min(max, val)) - min) / span) * (h - pad * 2);
  const d = values.map((val, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(val).toFixed(1)}`).join(" ");
  const lx = x(values.length - 1);
  const ly = y(values[values.length - 1]);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cx("overflow-visible", className)} role="img" aria-label={label}>
      {area && values.length > 1 && <path d={`${d} L${lx},${h - pad} L${x(0)},${h - pad} Z`} fill={color} opacity={0.12} />}
      {values.length > 1 && <path d={d} pathLength={1} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className={cx("fac-draw", live && "fac-glow")} style={v({ "--i": i })} />}
      {live && <circle cx={lx} cy={ly} r={4} fill={color} className="fac-ping" />}
      <circle cx={lx} cy={ly} r={4} fill={color} stroke={ring} strokeWidth={2} />
    </svg>
  );
}

/** Score tone by band, from the tier hues (same mapping as the student home). */
export const scoreTone = (s: number) => (s >= 75 ? "var(--color-tier-initial)" : s >= 50 ? "var(--color-tier-reluctant)" : "var(--color-tier-hidden)");

/** A score as a ring with the number inside (never color alone). */
export function ScoreRing({ value, size = 44, label, className }: { value: number; size?: number; label?: string; className?: string }) {
  const s = Math.round(Math.max(0, Math.min(100, value)));
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <span className={cx("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }} role="img" aria-label={label || `${s}%`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="5" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={scoreTone(s)} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - s / 100)} className="ring-fill" style={v({ "--from": c })} />
      </svg>
      <span className="font-mono font-bold text-ink" style={{ fontSize: Math.max(10, size * 0.27) }}>
        {s}
      </span>
    </span>
  );
}

/** Sequential one-hue ramp (brand), light -> dark, with the text color chosen for contrast on each step. */
const HEAT = [
  { bg: "var(--color-brand-50)", fg: "var(--color-ink)" },
  { bg: "var(--color-brand-100)", fg: "var(--color-ink)" },
  { bg: "var(--color-brand-200)", fg: "var(--color-ink)" },
  { bg: "var(--color-brand-300)", fg: "var(--color-ink)" },
  { bg: "var(--color-brand-600)", fg: "#fff" },
  { bg: "var(--color-brand-800)", fg: "#fff" },
];
export const heatStep = (pct: number) => HEAT[Math.max(0, Math.min(HEAT.length - 1, Math.floor((pct / 100) * (HEAT.length - 0.001))))];

/** One heat cell: color by magnitude, the value as text, a tooltip on hover or focus. */
export function HeatCell({ pct, children, tip, i = 0, className, below = false }: { pct: number | null; children: ReactNode; tip: ReactNode; i?: number; className?: string; below?: boolean }) {
  const st = pct === null ? { bg: "var(--color-surface-2)", fg: "var(--color-ink-3)" } : heatStep(pct);
  return (
    <span tabIndex={0} className={cx("fac-cell group relative inline-grid min-h-9 min-w-12 place-items-center rounded-[10px] px-1.5 font-mono text-[12.5px] font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2", className)} style={v({ background: st.bg, color: st.fg, "--i": i })}>
      {children}
      <span role="tooltip" className={cx("pointer-events-none absolute left-1/2 z-20 hidden", below ? "top-full mt-1.5" : "bottom-full mb-1.5", " w-max max-w-[16rem] -translate-x-1/2 rounded-xl bg-ink px-2.5 py-1.5 text-left font-sans text-[12px] font-medium text-white shadow-e2 group-hover:block group-focus-visible:block")}>
        {tip}
      </span>
    </span>
  );
}

/** The heat legend: the five steps with their ranges. */
export function HeatLegend({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center gap-2 text-[12px] font-semibold text-ink-3", className)}>
      <span>0%</span>
      <span className="flex overflow-hidden rounded-full">
        {HEAT.map((h, k) => (
          <span key={k} className="h-3 w-6" style={{ background: h.bg }} />
        ))}
      </span>
      <span>100%</span>
    </div>
  );
}

/** A horizontal score bar with the number at its tip. */
export function ScoreBar({ value, className, i = 0 }: { value: number | null; className?: string; i?: number }) {
  if (value === null) return <span className={cx("text-[12.5px] text-ink-3", className)}>–</span>;
  const s = Math.round(value);
  return (
    <span className={cx("flex min-w-[7rem] items-center gap-2", className)}>
      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <span className="bar-grow block h-full rounded-full" style={v({ width: `${Math.max(3, s)}%`, background: scoreTone(s), "--delay": `${120 + i * 40}ms` })} />
      </span>
      <span className="w-10 text-right font-mono text-[13px] font-bold tabular-nums text-ink">{s}%</span>
    </span>
  );
}

/** Daily counts as columns (engagement over the last N days). */
export function DayBars({ days, color = "var(--color-brand-600)", track = "var(--color-surface-2)", h = 44, label, className, dark = false }: { days: { date: string; n: number }[]; color?: string; track?: string; h?: number; label: string; className?: string; dark?: boolean }) {
  const max = Math.max(1, ...days.map((d) => d.n));
  return (
    <div className={cx("flex items-end gap-[3px]", className)} style={{ height: h }} role="img" aria-label={label}>
      {days.map((d, k) => (
        <span key={d.date} className="relative flex h-full flex-1 items-end rounded-[4px]" style={{ background: track }} title={`${d.date}: ${d.n}`}>
          {d.n > 0 && <span className="fac-col block w-full rounded-[4px]" style={v({ height: `${Math.max(14, (d.n / max) * 100)}%`, background: color, "--i": k })} />}
          {k === days.length - 1 && <span className={cx("absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-full rounded-full", dark ? "bg-white" : "bg-ink")} aria-hidden />}
        </span>
      ))}
    </div>
  );
}

/** Students by patients seen: a stacked bar (0 seen ... all seen), with a 2px surface gap between segments. */
export function QuestStack({ buckets, total, className }: { buckets: number[]; total: number; className?: string }) {
  const n = buckets.length - 1; // patients in the assignment
  const color = (k: number) => (k === 0 ? "var(--color-surface-2)" : k === n ? "var(--color-xp)" : `color-mix(in oklch, var(--color-xp) ${Math.round(30 + (k / n) * 50)}%, var(--color-surface-2))`);
  return (
    <div className={className}>
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={buckets.map((b, k) => `${b} student${b === 1 ? "" : "s"} seen ${k} of ${n}`).join(", ")}>
        {buckets.map((b, k) =>
          b > 0 ? <span key={k} className="bar-grow h-full first:rounded-l-full last:rounded-r-full" style={v({ width: `${(b / Math.max(1, total)) * 100}%`, background: color(k), "--delay": `${150 + k * 80}ms` })} title={`${b} seen ${k} of ${n}`} /> : null,
        )}
      </div>
    </div>
  );
}
