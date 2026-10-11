"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { cx } from "@/components/ui";
import { useWidth } from "./useWidth";
import "./history.css";

export interface ScorePoint {
  id: string;
  label: string;
  date: string;
  score: number;
  level: number;
  mode: string;
  href: string;
}

const day = (s: string) => {
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? s.slice(0, 10) : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/**
 * Score per visit for released results only (held feedback never reaches this component), oldest
 * to newest. One series, one color; the average is a dashed rule; each bar opens its feedback.
 * Hover or focus a bar for its details; arrow keys move between bars, Enter opens.
 */
export default function ScoreTrend({ points }: { points: ScorePoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const router = useRouter();
  const H = 200;
  const m = { top: 18, right: 8, bottom: 22, left: 30 };
  const W = Math.max(width, 260);
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const n = points.length;
  const slot = iw / Math.max(n, 1);
  const bw = Math.max(6, Math.min(30, slot - 4));
  const xAt = (i: number) => m.left + slot * i + slot / 2;
  const yAt = (s: number) => m.top + ih - (Math.max(0, Math.min(100, s)) / 100) * ih;
  const avg = points.reduce((a, p) => a + p.score, 0) / Math.max(1, n);
  const a = hover;

  return (
    <div ref={ref} className="relative">
      {width > 0 ? (
        <svg
          width={W}
          height={H}
          className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          role="img"
          tabIndex={0}
          aria-label={`Score by visit, released results only: ${points.map((p) => `${Math.round(p.score)}%`).join(", ")}. Average ${Math.round(avg)}%. Arrow keys read each visit, Enter opens its feedback.`}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
            else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
            else if (e.key === "Enter" && a !== null) router.push(points[a].href);
            else return;
            e.preventDefault();
          }}
        >
          {[0, 50, 100].map((g) => (
            <g key={g}>
              <line x1={m.left} x2={W - m.right} y1={yAt(g)} y2={yAt(g)} stroke={g ? "var(--color-slate-200)" : "var(--color-slate-300)"} />
              <text x={m.left - 6} y={yAt(g)} dy="0.34em" textAnchor="end" fontSize={11} fill="var(--color-ink-3)">
                {g}
              </text>
            </g>
          ))}
          {points.map((p, i) => (
            <g key={p.id} className="cursor-pointer" onPointerEnter={() => setHover(i)} onClick={() => router.push(p.href)}>
              <rect x={xAt(i) - slot / 2} y={m.top} width={slot} height={ih} fill="transparent" />
              <rect
                x={xAt(i) - bw / 2}
                y={yAt(p.score)}
                width={bw}
                height={Math.max(2, yAt(0) - yAt(p.score))}
                rx={Math.min(6, bw / 2)}
                fill={i === n - 1 ? "var(--color-brand-600)" : "var(--color-brand-400)"}
                fillOpacity={a === null || a === i ? 1 : 0.45}
                className="hist-grow-y"
                style={{ "--i": i, transition: "fill-opacity 160ms" } as CSSProperties}
              />
            </g>
          ))}
          <line x1={m.left} x2={W - m.right} y1={yAt(avg)} y2={yAt(avg)} stroke="var(--color-ink)" strokeWidth={1.5} strokeDasharray="5 4" />
          <rect x={m.left + 2} y={yAt(avg) - 10} width={86} height={20} rx={10} fill="var(--color-ink)" pointerEvents="none" />
          <text x={m.left + 45} y={yAt(avg)} dy="0.34em" textAnchor="middle" fontSize={11.5} fontWeight={800} fill="white" pointerEvents="none">
            average {Math.round(avg)}%
          </text>
          {n > 0 && (
            <text x={xAt(n - 1)} y={yAt(points[n - 1].score) - 6} textAnchor="middle" fontSize={12} fontWeight={800} fontFamily="var(--font-mono)" fill="var(--color-ink)">
              {Math.round(points[n - 1].score)}
            </text>
          )}
        </svg>
      ) : (
        <div style={{ height: H }} />
      )}
      {a !== null && width > 0 && (
        <div className={cx("pop-in pointer-events-none absolute z-10 w-max max-w-[15rem] rounded-xl bg-ink px-3 py-2 text-[12px] text-white shadow-e3")} style={{ top: Math.max(0, yAt(points[a].score) - 64), ...(xAt(a) > W / 2 ? { right: W - xAt(a) + 10 } : { left: xAt(a) + 10 }) }}>
          <div className="font-display text-[18px] font-black leading-none">{Math.round(points[a].score)}%</div>
          <div className="mt-0.5 font-semibold">{points[a].label}</div>
          <div className="text-white/80">
            {day(points[a].date)} · level {points[a].level} · {points[a].mode}
          </div>
        </div>
      )}
    </div>
  );
}
