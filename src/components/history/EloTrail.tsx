"use client";

import { useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { useWidth } from "./useWidth";
import "./history.css";

export interface TrailPoint {
  label: string;
  value: number;
  lines: string[];
}

/**
 * One rating series over visits, drawn against the five difficulty level lines. Violet (mastery)
 * line with a soft area, newest point breathing, crosshair + tooltip on hover, arrow keys to read
 * each visit. The number is always printed beside the line.
 */
export default function EloTrail({ points, ticks, lo, hi, name }: { points: TrailPoint[]; ticks: { level: number; rating: number }[]; lo: number; hi: number; name: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const H = 250;
  const m = { top: 16, right: 46, bottom: 26, left: 40 };
  const W = Math.max(width, 260);
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const vals = points.map((p) => p.value);
  const yLo = Math.min(lo, Math.floor((Math.min(...vals) - 20) / 50) * 50);
  const yHi = Math.max(hi, Math.ceil((Math.max(...vals) + 20) / 50) * 50);
  const last = points.length - 1;
  const xAt = (i: number) => m.left + (points.length <= 1 ? iw / 2 : (i / last) * iw);
  const yAt = (val: number) => m.top + ih - ((val - yLo) / (yHi - yLo)) * ih;
  const line = points.map((p, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${xAt(last).toFixed(1)},${(m.top + ih).toFixed(1)} L${xAt(0).toFixed(1)},${(m.top + ih).toFixed(1)} Z`;
  const step = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(iw / 64))));

  function move(e: PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(xAt(i) - px) < Math.abs(xAt(best) - px)) best = i;
    setHover(best);
  }
  function key(e: KeyboardEvent) {
    if (e.key === "ArrowRight") setHover((h) => Math.min(last, (h ?? -1) + 1));
    else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? points.length) - 1));
    else if (e.key === "Home") setHover(0);
    else if (e.key === "End") setHover(last);
    else if (e.key === "Escape") setHover(null);
    else return;
    e.preventDefault();
  }
  const a = hover;

  return (
    <div ref={ref} className="relative">
      {width > 0 ? (
        <svg
          width={W}
          height={H}
          role="img"
          tabIndex={0}
          aria-label={`${name}: rating after each scored visit, from ${Math.round(points[0].value)} to ${Math.round(points[last].value)}. Use the arrow keys to read each visit.`}
          className="block touch-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          onPointerMove={move}
          onPointerDown={move}
          onPointerLeave={() => setHover(null)}
          onKeyDown={key}
          onBlur={() => setHover(null)}
        >
          <defs>
            <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--color-mastery)" stopOpacity="0.26" />
              <stop offset="1" stopColor="var(--color-mastery)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks
            .filter((t) => t.rating >= yLo && t.rating <= yHi)
            .map((t) => (
              <g key={t.level}>
                <line x1={m.left} x2={W - m.right} y1={yAt(t.rating)} y2={yAt(t.rating)} stroke="var(--color-slate-200)" strokeWidth={1} />
                <rect x={4} y={yAt(t.rating) - 9} width={28} height={18} rx={6} fill="var(--color-mastery-soft)" />
                <text x={18} y={yAt(t.rating)} dy="0.34em" textAnchor="middle" fontSize={11} fontWeight={800} fill="var(--color-mastery-ink)">
                  L{t.level}
                </text>
              </g>
            ))}
          <line x1={m.left} x2={W - m.right} y1={m.top + ih} y2={m.top + ih} stroke="var(--color-slate-300)" />
          {points.map((p, i) =>
            (i % step === 0 || i === last) && !(i !== last && last - i < step * 0.6) ? (
              <text key={i} x={xAt(i)} y={H - 7} textAnchor="middle" fontSize={11} fill="var(--color-ink-3)">
                {p.label}
              </text>
            ) : null,
          )}
          <path d={area} fill={`url(#${id}-g)`} className="fade-in" />
          {a !== null && <line x1={xAt(a)} x2={xAt(a)} y1={m.top} y2={m.top + ih} stroke="var(--color-ink-3)" strokeOpacity={0.5} />}
          {points.length > 1 && <path d={line} fill="none" stroke="var(--color-mastery)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" pathLength={1000} className="draw-in" style={{ "--len": 1000 } as CSSProperties} />}
          {points.map((p, i) => (
            <circle key={i} cx={xAt(i)} cy={yAt(p.value)} r={i === a || i === last ? 5.5 : 4} fill={i === last ? "var(--color-xp)" : "var(--color-mastery)"} stroke={i === last ? "var(--color-ink)" : "white"} strokeWidth={i === last ? 1.5 : 2} className="pop-spring" style={{ "--i": Math.min(i, 10) } as CSSProperties} />
          ))}
          <circle cx={xAt(last)} cy={yAt(points[last].value)} r={6} fill="var(--color-mastery)" className="hist-ping" />
          <text x={xAt(last) + 10} y={yAt(points[last].value)} dy="0.34em" fontSize={13} fontWeight={800} fill="var(--color-ink)" fontFamily="var(--font-mono)">
            {Math.round(points[last].value)}
          </text>
        </svg>
      ) : (
        <div style={{ height: H }} />
      )}
      {a !== null && width > 0 && (
        <div
          className="pop-in pointer-events-none absolute z-10 w-max max-w-[15rem] rounded-xl bg-ink px-3 py-2 text-[12px] text-white shadow-e3"
          style={{ top: Math.max(0, yAt(points[a].value) - 16), ...(xAt(a) > W / 2 ? { right: W - xAt(a) + 14 } : { left: xAt(a) + 14 }) }}
        >
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[18px] font-black leading-none">{Math.round(points[a].value)}</span>
            {a > 0 && (
              <span className="font-mono text-[12px] font-bold text-[var(--color-xp)]">
                {points[a].value - points[a - 1].value >= 0 ? "+" : "−"}
                {Math.abs(Math.round(points[a].value - points[a - 1].value))}
              </span>
            )}
          </div>
          <div className="mt-0.5 font-semibold">{points[a].label}</div>
          {points[a].lines.map((l, i) => (
            <div key={i} className="text-white/80">
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
