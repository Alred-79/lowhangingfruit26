"use client";

import { KeyRound, Lock, MessageCircle, MessageCircleQuestion, ShieldHalf, UserRound } from "lucide-react";
import type { CSSProperties } from "react";
import { cx } from "@/components/ui";
import { knobsForLevel, LEVEL_NAMES } from "@/lib/engine/difficulty";
import { TIERS } from "@/lib/studio/profile";
import type { Tier } from "@/lib/types";
import "./studio.css";

// Disclosure tiers as data: the four tier hues (dataviz-validated tokens) wherever tiers appear,
// counts always printed as text, small text only on the -soft tints with -ink text.

const v = (o: Record<string, string | number>) => o as CSSProperties;

export const TIER_STYLE: Record<Tier, { fill: string; soft: string; ink: string; Icon: typeof Lock; short: string }> = {
  initial: { fill: "var(--color-tier-initial)", soft: "var(--color-tier-initial-soft)", ink: "var(--color-tier-initial-ink)", Icon: MessageCircle, short: "Volunteered" },
  discoverable: { fill: "var(--color-tier-discoverable)", soft: "var(--color-tier-discoverable-soft)", ink: "var(--color-tier-discoverable-ink)", Icon: MessageCircleQuestion, short: "When asked" },
  reluctant: { fill: "var(--color-tier-reluctant)", soft: "var(--color-tier-reluctant-soft)", ink: "var(--color-tier-reluctant-ink)", Icon: KeyRound, short: "Needs trust" },
  hidden: { fill: "var(--color-tier-hidden)", soft: "var(--color-tier-hidden-soft)", ink: "var(--color-tier-hidden-ink)", Icon: ShieldHalf, short: "Guarded" },
};
export const TIER_ORDER: Tier[] = ["initial", "discoverable", "reluctant", "hidden"];

export type TierCounts = Record<Tier, number>;
export const tierCounts = (facts: { tier: Tier }[]): TierCounts => ({
  initial: facts.filter((f) => f.tier === "initial").length,
  discoverable: facts.filter((f) => f.tier === "discoverable").length,
  reluctant: facts.filter((f) => f.tier === "reluctant").length,
  hidden: facts.filter((f) => f.tier === "hidden").length,
});

/** One stacked bar of facts by tier, 2px surface gaps between segments, with an optional text legend. */
export function TierBar({ counts, legend = false, height = 10, className, dark = false }: { counts: TierCounts; legend?: boolean; height?: number; className?: string; dark?: boolean }) {
  const total = TIER_ORDER.reduce((n, t) => n + counts[t], 0);
  const label = total ? TIER_ORDER.map((t) => `${counts[t]} ${TIER_STYLE[t].short.toLowerCase()}`).join(", ") : "No facts yet";
  return (
    <div className={className}>
      <div role="img" aria-label={`Facts by disclosure tier: ${label}`} className={cx("flex w-full gap-[2px] overflow-hidden rounded-full", dark ? "bg-white/10" : "bg-surface-2")} style={{ height }}>
        {total > 0 &&
          TIER_ORDER.filter((t) => counts[t] > 0).map((t, i) => (
            <span key={t} className="studio-seg h-full first:rounded-l-full last:rounded-r-full" style={v({ width: `${(counts[t] / total) * 100}%`, background: TIER_STYLE[t].fill, "--i": i })} title={`${TIER_STYLE[t].short}: ${counts[t]}`} />
          ))}
      </div>
      {legend && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-semibold" aria-hidden>
          {TIER_ORDER.map((t) => (
            <li key={t} className={cx("inline-flex items-center gap-1.5", dark ? "text-white/85" : "text-ink-2")}>
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: TIER_STYLE[t].fill }} />
              {TIER_STYLE[t].short}
              <span className={cx("font-mono", dark ? "text-white" : "text-ink")}>{counts[t]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The rapport track for one difficulty level: where the patient starts and the two gates that open the
 * "Needs trust" and "Guarded" tiers. Thresholds come from the engine (knobsForLevel), not from the case.
 */
export function RapportGates({ level, compact = false }: { level: number; compact?: boolean }) {
  const k = knobsForLevel(level);
  const zones: { tier: Tier; from: number; to: number }[] = [
    { tier: "discoverable", from: 0, to: k.reluctantAt },
    { tier: "reluctant", from: k.reluctantAt, to: k.hiddenAt },
    { tier: "hidden", from: k.hiddenAt, to: 100 },
  ];
  return (
    <figure>
      <div className="relative pt-9 pb-7">
        {/* Start marker */}
        <div className="studio-gate absolute top-0 -translate-x-1/2" style={{ left: `${k.rapportStart}%` }}>
          <span className="flex flex-col items-center">
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[11.5px] font-bold text-white">
              <UserRound className="h-3 w-3" aria-hidden />
              Starts at <span className="font-mono">{k.rapportStart}</span>
            </span>
            <span className="h-2.5 w-0.5 bg-ink" aria-hidden />
          </span>
        </div>
        <div className="relative flex h-4 gap-[2px] overflow-hidden rounded-full" aria-hidden>
          {zones.map((z) => (
            <span key={z.tier} className="studio-gate h-full" style={{ width: `${z.to - z.from}%`, background: TIER_STYLE[z.tier].fill, opacity: 0.9 }} />
          ))}
        </div>
        {/* Gate markers */}
        {[
          { at: k.reluctantAt, tier: "reluctant" as Tier },
          { at: k.hiddenAt, tier: "hidden" as Tier },
        ].map((g) => (
          <div key={g.tier} className="studio-gate absolute top-9 -translate-x-1/2" style={{ left: `${g.at}%` }}>
            <span className="flex flex-col items-center">
              <span className="h-6 w-[3px] rounded-full bg-ink" aria-hidden />
              <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-md px-1 font-mono text-[11.5px] font-bold" style={{ background: TIER_STYLE[g.tier].soft, color: TIER_STYLE[g.tier].ink }}>
                <Lock className="h-2.5 w-2.5" aria-hidden />
                {g.at}
              </span>
            </span>
          </div>
        ))}
        <div className="absolute inset-x-0 bottom-0 flex justify-between font-mono text-[10.5px] text-ink-3" aria-hidden>
          <span>0</span>
          <span>rapport</span>
          <span>100</span>
        </div>
      </div>
      <figcaption className={cx("text-ink-2", compact ? "text-[12.5px]" : "text-[13px] leading-relaxed")}>
        At level {k.level} ({LEVEL_NAMES[k.level]}) the patient starts at rapport <b className="font-mono text-ink">{k.rapportStart}</b>. <span style={{ color: TIER_STYLE.reluctant.ink }} className="font-semibold">Needs trust</span> opens at{" "}
        <b className="font-mono text-ink">{k.reluctantAt}</b>, <span style={{ color: TIER_STYLE.hidden.ink }} className="font-semibold">Guarded</span> at <b className="font-mono text-ink">{k.hiddenAt}</b>. {k.volunteers ? "The patient volunteers openly" : "The patient does not volunteer much"}, up to{" "}
        {k.factsPerTurn} facts per answer{k.distractors ? ", distractors in play" : ""}.
      </figcaption>
    </figure>
  );
}

/** Level slider 1-5 (or 0 = "let the guide decide" when `allowAuto`): a native range dressed as a game slider. */
export function LevelSlider({ value, onChange, allowAuto = false, label, id }: { value: number; onChange: (n: number) => void; allowAuto?: boolean; label: string; id?: string }) {
  const min = allowAuto ? 0 : 1;
  const fill = ((value - min) / (5 - min)) * 100;
  const text = value === 0 ? "Let the guide decide" : `${value} · ${LEVEL_NAMES[value]}`;
  return (
    <div>
      <input
        id={id}
        type="range"
        min={min}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={text}
        className="studio-range"
        style={v({ "--fill": `${fill}%` })}
      />
      <div className="mt-1 flex justify-between px-[3px] font-mono text-[11px] text-ink-3" aria-hidden>
        {Array.from({ length: 6 - min }, (_, i) => i + min).map((n) => (
          <span key={n} className={cx(n === value && "font-bold text-brand-700")}>
            {n === 0 ? "Auto" : n}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The four tiers as a rising ladder of toggle buttons: each step needs more trust than the one before. */
export function TierSteps({ counts, active, onPick }: { counts: TierCounts; active: string; onPick: (t: Tier) => void }) {
  return (
    <div className="grid items-end gap-2 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Disclosure tiers: select one to filter the facts">
      {TIERS.map((t, i) => {
        const s = TIER_STYLE[t.id];
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(t.id)}
            className={cx("press lift rise group relative flex flex-col overflow-hidden rounded-[18px] p-3.5 text-left ring-1 ring-inset transition-shadow", on ? "ring-2 ring-ink" : "ring-black/5")}
            style={v({ background: s.soft, "--i": i, minHeight: `${7.5 + i * 1.6}rem` })}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl text-white clay" style={{ background: s.fill }}>
                <s.Icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span className="font-display text-[34px] font-black leading-none tracking-[-0.04em] tabular-nums" style={{ color: s.ink }}>
                {counts[t.id]}
              </span>
            </div>
            <span className="mt-2 text-[14px] font-bold" style={{ color: s.ink }}>
              Step {i + 1} · {t.label}
            </span>
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">{t.rule}</p>
            <span className={cx("mt-auto pt-2 text-[11.5px] font-bold", on ? "text-ink" : "text-ink-3")}>{on ? "Filtering the table · click to clear" : "Show only these"}</span>
          </button>
        );
      })}
    </div>
  );
}
