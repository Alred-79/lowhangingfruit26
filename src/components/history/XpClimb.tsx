"use client";

import { ArrowUpRight, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState, type CSSProperties } from "react";
import { cx } from "@/components/ui";
import { useWidth } from "./useWidth";
import "./history.css";

export interface ClimbPoint {
  id: string;
  /** Neutral patient label (never the faculty case title). */
  label: string;
  date: string;
  xp: number;
  cum: number;
  parts: [string, number][];
  rank: number;
  rankTitle: string;
  rankUp: boolean;
  held: boolean;
  privatePractice: boolean;
  href: string | null;
}

const v = (o: Record<string, string | number>) => o as CSSProperties;
const fmtDay = (s: string) => {
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? s.slice(0, 10) : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/**
 * The XP climb: cumulative XP after every finished visit, against the rank thresholds, with a
 * scrubber (range input + drag on the chart) that reads one visit at a time: its XP parts, the rank
 * it left you at, and whether it crossed a rank. XP never includes a score (derive.ts rules).
 */
export default function XpClimb({ points, ranks }: { points: ClimbPoint[]; ranks: { at: number; title: string }[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [sel, setSel] = useState(points.length - 1);
  const dragging = useRef(false);
  const id = useId();
  const n = points.length;
  const H = 210;
  const m = { top: 14, right: 18, bottom: 22, left: 10 };
  const W = Math.max(width, 260);
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const last = points[n - 1];
  const nextRank = ranks.find((r) => r.at > last.cum);
  const yMax = Math.max(100, nextRank ? nextRank.at : last.cum) * 1.04;
  const xAt = (i: number) => m.left + ((i + 1) / n) * iw; // index -1 is the start (0 XP)
  const yAt = (val: number) => m.top + ih - (val / yMax) * ih;
  const pts: [number, number][] = [[xAt(-1), yAt(0)], ...points.map((p, i) => [xAt(i), yAt(p.cum)] as [number, number])];
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${xAt(n - 1).toFixed(1)},${yAt(0).toFixed(1)} L${xAt(-1).toFixed(1)},${yAt(0).toFixed(1)} Z`;
  const p = points[sel];
  const prevCum = sel > 0 ? points[sel - 1].cum : 0;

  function pick(clientX: number, el: Element) {
    const r = el.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(xAt(i) - px) < Math.abs(xAt(best) - px)) best = i;
    setSel(best);
  }

  return (
    <div>
      <div ref={ref} className="relative">
        {width > 0 ? (
          <svg
            width={W}
            height={H}
            className="block touch-none select-none"
            aria-hidden
            onPointerDown={(e) => {
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              pick(e.clientX, e.currentTarget);
            }}
            onPointerMove={(e) => dragging.current && pick(e.clientX, e.currentTarget)}
            onPointerUp={() => (dragging.current = false)}
            onPointerCancel={() => (dragging.current = false)}
          >
            <defs>
              <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--color-xp)" stopOpacity="0.55" />
                <stop offset="1" stopColor="var(--color-xp)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {ranks
              .filter((r) => r.at > 0 && r.at <= yMax)
              .map((r) => {
                const passed = last.cum >= r.at;
                return (
                  <g key={r.at}>
                    <line x1={m.left} x2={W - m.right} y1={yAt(r.at)} y2={yAt(r.at)} stroke="white" strokeOpacity={passed ? 0.28 : 0.5} strokeDasharray={passed ? "0" : "4 5"} strokeWidth={1} />
                    <text x={m.left + 2} y={yAt(r.at) - 5} fontSize={11} fontWeight={700} fill="white" stroke="var(--color-brand-600)" strokeWidth={3.5} strokeLinejoin="round" paintOrder="stroke">
                      Rank {ranks.indexOf(r) + 1} · {r.title} · {r.at} XP
                    </text>
                  </g>
                );
              })}
            <line x1={m.left} x2={W - m.right} y1={yAt(0)} y2={yAt(0)} stroke="white" strokeOpacity={0.4} />
            <path d={area} fill={`url(#${id}-a)`} className="fade-in" />
            <path d={line} fill="none" stroke="var(--color-xp)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" className="draw-in" style={v({ "--len": 2400 })} pathLength={2400} />
            <path d={line} fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" className="hist-travel" pathLength={400} />
            <line x1={xAt(sel)} x2={xAt(sel)} y1={m.top} y2={yAt(0)} stroke="white" strokeOpacity={0.55} strokeWidth={1} />
            {points.map((q, i) => (
              <g key={q.id}>
                {q.rankUp && <circle cx={xAt(i)} cy={yAt(q.cum)} r={9} fill="none" stroke="var(--color-flame-2)" strokeWidth={2} />}
                <circle cx={xAt(i)} cy={yAt(q.cum)} r={i === sel ? 6.5 : 4.5} fill={i === sel ? "white" : "var(--color-xp)"} stroke="var(--color-ink)" strokeWidth={1.5} className="pop-spring" style={v({ "--i": Math.min(i, 10) })} />
              </g>
            ))}
            {sel === n - 1 && <circle cx={xAt(n - 1)} cy={yAt(last.cum)} r={6} fill="var(--color-xp)" className="hist-ping" />}
            <text x={W - m.right} y={H - 5} textAnchor="end" fontSize={11} fill="white" fillOpacity={0.85}>
              Visit {n}
            </text>
            <text x={m.left} y={H - 5} fontSize={11} fill="white" fillOpacity={0.85}>
              Start
            </text>
          </svg>
        ) : (
          <div style={{ height: H }} />
        )}
      </div>

      <label htmlFor={`${id}-r`} className="sr-only">
        Scrub through your finished visits
      </label>
      <input
        id={`${id}-r`}
        type="range"
        min={0}
        max={Math.max(0, n - 1)}
        step={1}
        value={sel}
        disabled={n < 2}
        onChange={(e) => setSel(Number(e.target.value))}
        aria-valuetext={`Visit ${sel + 1} of ${n}: ${p.label}, plus ${p.xp} XP, ${p.cum} XP in total, rank ${p.rank} ${p.rankTitle}`}
        className="mt-1 h-6 w-full cursor-grab accent-[var(--color-xp)] active:cursor-grabbing disabled:opacity-40 pointer-coarse:h-11"
      />

      <div key={p.id} className="pop-in mt-2 grid gap-3 rounded-2xl bg-white/12 p-3.5 ring-1 ring-inset ring-white/20 sm:grid-cols-[minmax(0,1fr)_auto]" aria-live="polite">
        <div className="min-w-0">
          <p className="text-[12.5px] font-bold text-white/85">
            Visit {sel + 1} of {n} · {fmtDay(p.date)}
          </p>
          <p className="truncate font-display text-[18px] font-extrabold leading-tight">{p.label}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {p.parts.map(([k, val]) => (
              <li key={k} className="inline-flex items-center gap-1.5 rounded-full bg-ink/45 px-2.5 py-1 text-[12px] font-semibold">
                {k}
                <span className="font-mono text-[var(--color-xp)]">+{val}</span>
              </li>
            ))}
            {p.privatePractice && (
              <li className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-bold text-ink">
                <Lock className="h-3 w-3" aria-hidden />
                Private practice: counts only for you
              </li>
            )}
            {p.held && <li className="rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-bold text-ink">Feedback held by your instructor</li>}
          </ul>
        </div>
        <div className="flex items-end justify-between gap-4 sm:flex-col sm:items-end">
          <div className="text-right">
            <p className="font-display text-[30px] font-black leading-none tracking-[-0.03em] text-[var(--color-xp)]">+{p.xp}</p>
            <p className="mt-1 font-mono text-[12px] text-white/85">
              {prevCum} → {p.cum} XP
            </p>
          </div>
          <div className="flex items-center gap-2">
            {p.rankUp && (
              <span className="pop-spring inline-flex items-center gap-1 rounded-full bg-[var(--color-flame-2)] px-2.5 py-1 text-[12px] font-black text-ink">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Rank up: {p.rankTitle}
              </span>
            )}
            {p.href && (
              <Link href={p.href} className="press inline-flex min-h-9 items-center gap-1 rounded-full bg-white px-3 text-[12.5px] font-bold text-brand-700 pointer-coarse:min-h-11">
                Feedback
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The rank ladder as a level path: passed ranks lit, the current one breathing, the rest ahead. */
export function RankPath({ ranks, xp }: { ranks: { at: number; title: string }[]; xp: number }) {
  const cur = ranks.reduce((k, r, i) => (xp >= r.at ? i : k), 0);
  return (
    <ol className="relative mt-4 grid grid-cols-10 items-center gap-0" aria-label={`Rank path: rank ${cur + 1} of ${ranks.length}`}>
      <span className="absolute inset-x-[5%] top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20" aria-hidden />
      <span className="bar-grow absolute left-[5%] top-1/2 h-1 -translate-y-1/2 rounded-full bg-[var(--color-xp)]" style={{ width: `${(cur / (ranks.length - 1)) * 90}%` }} aria-hidden />
      {ranks.map((r, i) => (
        <li key={r.at} className="relative grid place-items-center" title={`Rank ${i + 1}: ${r.title} at ${r.at} XP`}>
          <span
            className={cx(
              "pop-spring grid place-items-center rounded-full font-display font-black",
              i < cur && "h-6 w-6 bg-[var(--color-xp)] text-[11px] text-ink",
              i === cur && "breathe h-9 w-9 bg-white text-[15px] text-[var(--color-mastery)] ring-4 ring-[var(--color-xp)]",
              i > cur && "h-6 w-6 bg-brand-800 text-[11px] text-white/85 ring-1 ring-white/30",
            )}
            style={v({ "--i": i })}
          >
            {i + 1}
          </span>
          <span className="sr-only">
            {r.title}, {r.at} XP{i < cur ? ", passed" : i === cur ? ", current rank" : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
