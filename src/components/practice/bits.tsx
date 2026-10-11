import type { CSSProperties } from "react";
import { cx } from "@/components/ui";
import type { PracticeCase } from "./types";

const v = (o: Record<string, string | number>) => o as CSSProperties;

/** The patient's portrait, or their initials on the stage color when there is none. */
export function Portrait({ c, className }: { c: Pick<PracticeCase, "portrait" | "patientFirstName">; className?: string }) {
  return c.portrait ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={c.portrait} alt="" loading="lazy" className={cx("h-full w-full object-cover object-[50%_25%]", className)} />
  ) : (
    <div className={cx("grid h-full w-full place-items-center bg-[radial-gradient(circle_at_50%_35%,var(--color-brand-700),var(--color-stage))]", className)}>
      <span className="font-display text-5xl font-black text-white/85">{c.patientFirstName.slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

/** Difficulty as a rising staircase of five steps, the chosen ones lit. */
export function LevelSteps({ level, light = false, small = false }: { level: number; light?: boolean; small?: boolean }) {
  return (
    <span className="inline-flex items-end gap-[3px]" aria-hidden>
      {[1, 2, 3, 4, 5].map((l) => (
        <span
          key={l}
          className={cx("rounded-[3px] transition-colors duration-200", small ? "w-[5px]" : "w-2.5", l <= level ? (light ? "bg-[var(--color-xp)]" : "bg-brand-600") : light ? "bg-white/25" : "bg-brand-100")}
          style={{ height: (small ? 4 : 7) + l * (small ? 2.4 : 4.5) }}
        />
      ))}
    </span>
  );
}

/** Best score as a ring with the number inside (never color alone). `null` draws an empty dashed ring. */
export function ScoreRing({ value, size = 48, label = "best" }: { value: number | null; size?: number; label?: string }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  if (value === null) {
    return (
      <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label="No score yet">
        <svg viewBox="0 0 40 40" className="absolute inset-0">
          <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-line-strong)" strokeWidth="3.5" strokeDasharray="3 4" />
        </svg>
        <span className="font-display text-[11px] font-black text-ink-3">NEW</span>
      </span>
    );
  }
  const s = Math.round(value);
  const tone = s >= 75 ? "var(--color-tier-initial)" : s >= 50 ? "var(--color-tier-reluctant)" : "var(--color-tier-hidden)";
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label} score ${s}%`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="5" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={tone} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - s / 100)} className="ring-fill" style={v({ "--from": c })} />
      </svg>
      <span className="font-mono text-[13px] font-bold leading-none text-ink">
        {s}
        <span className="text-[9px]">%</span>
      </span>
    </span>
  );
}

/** Attempts as up to five pips, then "+n". */
export function AttemptPips({ n, light = false }: { n: number; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-[3px]" aria-hidden>
      {Array.from({ length: Math.min(5, Math.max(n, 0)) }, (_, i) => (
        <span key={i} className={cx("h-2 w-2 rounded-full", light ? "bg-[var(--color-xp)]" : "bg-brand-600")} />
      ))}
      {n > 5 && <span className={cx("ml-0.5 font-mono text-[10.5px] font-bold", light ? "text-white" : "text-ink-2")}>+{n - 5}</span>}
    </span>
  );
}
