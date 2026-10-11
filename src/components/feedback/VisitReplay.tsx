"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface ReplayTurn {
  turn: number;
  /** Running score and its parts, 0-1 (lib/engine/timeline.ts). */
  score: number;
  coverage: number;
  communication: number;
  comfort: number;
  note: string;
  student: string;
  patient: string;
  unlocked: string[];
  deflected: string[];
  delta: number;
  outside: boolean;
}

const W = 760;
const L = 112;
const R = 30;
const MAIN_H = 170;
const ROW_H = 30;
const GAP = 8;
const pct = (v: number) => Math.round(v * 100);

type EventKind = "flag" | "deflect" | "found" | "quiet";
function eventOf(t: ReplayTurn): EventKind {
  if (t.outside || /judgmental|dismissive/.test(t.note)) return "flag";
  if (t.deflected.length) return "deflect";
  if (t.unlocked.length) return "found";
  return "quiet";
}
const EVENT = {
  found: { cls: "fill-brand-500", label: "New findings" },
  deflect: { cls: "fill-amber-500", label: "Patient deflected" },
  flag: { cls: "fill-rose-500", label: "Flag: judgment, dismissal or outside the case record" },
  quiet: { cls: "fill-slate-300", label: "No new findings" },
} as const;

/**
 * "The visit, turn by turn": the running score as a replayable timeline. Drag across the chart or use
 * the arrow keys to move through the visit; every row is the same arithmetic the instructor's live
 * console shows, with no model call. Small multiples share one cursor (one axis per chart).
 */
export default function VisitReplay({ turns }: { turns: ReplayTurn[] }) {
  const n = turns.length;
  const [i, setI] = useState(n - 1);
  const [playing, setPlaying] = useState(false);
  const [table, setTable] = useState(false);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setI((x) => {
        if (x >= n - 1) {
          setPlaying(false);
          return x;
        }
        return x + 1;
      });
    }, 650);
    return () => clearInterval(t);
  }, [playing, n]);

  if (n < 2) return null;
  const slot = (W - L - R) / n;
  const x = (k: number) => L + slot * (k + 0.5);
  const yMain = (v: number) => 10 + (1 - v) * (MAIN_H - 20);
  const line = (vals: number[], y: (v: number) => number) => vals.map((v, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const scorePath = line(turns.map((t) => t.score), yMain);
  const area = `${scorePath} L${x(n - 1)},${MAIN_H - 10} L${x(0)},${MAIN_H - 10} Z`;
  const rows = [
    { key: "coverage", label: "Findings covered", vals: turns.map((t) => t.coverage) },
    { key: "communication", label: "Communication", vals: turns.map((t) => t.communication) },
    { key: "comfort", label: "Patient comfort", vals: turns.map((t) => t.comfort) },
  ] as const;
  const top = MAIN_H + 10;
  const trackY = top + rows.length * (ROW_H + GAP) + 2;
  const H = trackY + 30;
  const cur = turns[i];

  function fromPointer(clientX: number) {
    const el = svg.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * W;
    const k = Math.floor((sx - L) / slot);
    setI(Math.max(0, Math.min(n - 1, k)));
  }
  function onKey(e: React.KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key as string];
    if (step) {
      e.preventDefault();
      setPlaying(false);
      setI((k) => Math.max(0, Math.min(n - 1, k + step)));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setPlaying(false);
      setI(e.key === "Home" ? 0 : n - 1);
    }
  }

  return (
    <div className="space-y-4">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-[12.5px] text-ink-3">
            <span>Drag across the chart, or focus it and use the arrow keys, to replay any turn.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (playing) return setPlaying(false);
                if (i >= n - 1) setI(0);
                setPlaying(true);
              }}
              className="press inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-brand-800 ring-1 ring-inset ring-brand-200 hover:bg-brand-50"
            >
              {playing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
              {playing ? "Pause" : "Replay the visit"}
            </button>
            <button type="button" onClick={() => setTable((v) => !v)} aria-expanded={table} className="min-h-9 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-slate-100">
              {table ? "Show as chart" : "Show as table"}
            </button>
          </div>
        </div>

        {table ? (
          <div className="scroll-quiet max-h-80 overflow-auto rounded-xl border border-line">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-surface-2 text-[12px] text-ink-3">
                <tr>
                  <th className="px-3 py-2 font-medium">Turn</th>
                  <th className="px-3 py-2 text-right font-medium">Score</th>
                  <th className="px-3 py-2 text-right font-medium">Findings</th>
                  <th className="px-3 py-2 text-right font-medium">Communication</th>
                  <th className="px-3 py-2 text-right font-medium">Comfort</th>
                  <th className="px-3 py-2 font-medium">What happened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {turns.map((t) => (
                  <tr key={t.turn}>
                    <td className="px-3 py-1.5">
                      <a href={`#t${t.turn}`} className="font-mono text-brand-700 hover:underline">
                        T{t.turn}
                      </a>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{pct(t.score)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{pct(t.coverage)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{pct(t.communication)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{pct(t.comfort)}</td>
                    <td className="px-3 py-1.5 text-ink-2">{t.note || "no notable signals"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <svg
            ref={svg}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full touch-none select-none outline-none [&:focus-visible]:rounded-lg [&:focus-visible]:ring-2 [&:focus-visible]:ring-brand-500"
            role="slider"
            tabIndex={0}
            aria-label="Visit replay: running score by turn"
            aria-valuemin={turns[0].turn}
            aria-valuemax={turns[n - 1].turn}
            aria-valuenow={cur.turn}
            aria-valuetext={`Turn ${cur.turn}: running score ${pct(cur.score)}, findings ${pct(cur.coverage)}, communication ${pct(cur.communication)}, comfort ${pct(cur.comfort)}`}
            onPointerDown={(e) => {
              setPlaying(false);
              (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
              fromPointer(e.clientX);
            }}
            onPointerMove={(e) => (e.buttons || e.pointerType === "mouse") && fromPointer(e.clientX)}
            onKeyDown={onKey}
          >
            <defs>
              <linearGradient id="replay-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--color-brand-500)" stopOpacity="0.18" />
                <stop offset="1" stopColor="var(--color-brand-500)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((g) => (
              <g key={g}>
                <line x1={L} x2={W - R} y1={yMain(g)} y2={yMain(g)} stroke="var(--color-slate-200)" strokeWidth={1} />
                <text x={L - 10} y={yMain(g) + 4} textAnchor="end" fontSize={11} fill="var(--color-ink-3)">
                  {pct(g)}
                </text>
              </g>
            ))}
            <text x={L - 34} y={yMain(0.75) + 4} textAnchor="end" fontSize={12} fontWeight={600} fill="var(--color-ink)">
              Running
            </text>
            <text x={L - 34} y={yMain(0.75) + 19} textAnchor="end" fontSize={12} fontWeight={600} fill="var(--color-ink)">
              score
            </text>
            <path d={area} fill="url(#replay-area)" />
            <path d={scorePath} fill="none" stroke="var(--color-brand-600)" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="draw-in" style={{ "--len": 1 } as React.CSSProperties} />
            {turns.map((t, k) => (
              <circle key={t.turn} cx={x(k)} cy={yMain(t.score)} r={k === i ? 5 : 2.5} fill={k === i ? "var(--color-brand-600)" : "var(--color-surface)"} stroke="var(--color-brand-600)" strokeWidth={k === i ? 2.5 : 1.5} />
            ))}
            <text x={x(n - 1) + 8} y={yMain(turns[n - 1].score) + 4} fontSize={12} fontWeight={700} fill="var(--color-ink)">
              {pct(turns[n - 1].score)}
            </text>

            {rows.map((r, ri) => {
              const y0 = top + ri * (ROW_H + GAP);
              const y = (v: number) => y0 + 4 + (1 - v) * (ROW_H - 8);
              return (
                <g key={r.key}>
                  <rect x={L} y={y0} width={W - L - R} height={ROW_H} rx={6} fill="var(--color-surface-2)" />
                  <text x={L - 10} y={y0 + ROW_H / 2 + 4} textAnchor="end" fontSize={11.5} fill="var(--color-ink-2)">
                    {r.label}
                  </text>
                  <path d={line([...r.vals], y)} fill="none" stroke="var(--color-slate-500)" strokeWidth={1.75} strokeLinejoin="round" />
                  <circle cx={x(i)} cy={y(r.vals[i])} r={3.5} fill="var(--color-ink)" />
                  <text x={W - R + 6} y={y0 + ROW_H / 2 + 4} fontSize={11.5} fontWeight={700} fill="var(--color-ink)">
                    {pct(r.vals[i])}
                  </text>
                </g>
              );
            })}

            <text x={L - 10} y={trackY + 9} textAnchor="end" fontSize={11.5} fill="var(--color-ink-2)">
              Events
            </text>
            {turns.map((t, k) => (
              <rect key={t.turn} x={L + slot * k + 1.5} y={trackY} width={Math.max(3, slot - 3)} height={12} rx={3} className={EVENT[eventOf(t)].cls} opacity={k === i ? 1 : 0.7} />
            ))}

            {/* The shared cursor */}
            <line x1={x(i)} x2={x(i)} y1={6} y2={trackY + 14} stroke="var(--color-ink)" strokeOpacity={0.35} strokeWidth={1} />
            {turns.map((t, k) => (
              <text key={"x" + t.turn} x={x(k)} y={H - 4} textAnchor="middle" fontSize={11} fontWeight={k === i ? 700 : 400} fill={k === i ? "var(--color-ink)" : "var(--color-ink-3)"}>
                {n <= 16 || k % Math.ceil(n / 16) === 0 || k === i ? `T${t.turn}` : ""}
              </text>
            ))}
          </svg>
        )}
        {!table && (
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-3">
            {(Object.keys(EVENT) as EventKind[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <svg width="10" height="10" aria-hidden>
                  <rect width="10" height="10" rx="2.5" className={EVENT[k].cls} />
                </svg>
                {EVENT[k].label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* The selected turn */}
      <div className="grid gap-4 rounded-xl border border-line bg-surface-2 p-4 md:grid-cols-[minmax(0,1fr)_15rem]" aria-live="polite">
        <div className="min-w-0">
        <div className="flex items-baseline justify-between">
          <a href={`#t${cur.turn}`} className="font-mono text-[13px] font-semibold text-brand-700 hover:underline">
            Turn {cur.turn}
          </a>
          <span className="text-[12.5px] text-ink-3">
            score <span className="font-display text-[22px] font-semibold tabular text-ink">{pct(cur.score)}</span>
          </span>
        </div>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink">
          <span className="font-semibold text-brand-700">You: </span>
          {cur.student || <span className="text-ink-3">(no message)</span>}
        </p>
        {cur.patient && (
          <p className="mt-1.5 line-clamp-4 text-[13.5px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink-2">Patient: </span>
            {cur.patient}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5 text-[12px]">
          {cur.unlocked.map((u) => (
            <span key={"u" + u} className="rounded-md bg-brand-50 px-1.5 py-0.5 text-brand-800 ring-1 ring-inset ring-brand-200">
              unlocked: {u}
            </span>
          ))}
          {cur.deflected.map((u) => (
            <span key={"d" + u} className="rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-900 ring-1 ring-inset ring-amber-200">
              deflected: {u}
            </span>
          ))}
          {cur.delta !== 0 && (
            <span className={`rounded-md px-1.5 py-0.5 font-mono ring-1 ring-inset ${cur.delta > 0 ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-rose-50 text-rose-800 ring-rose-200"}`}>
              comfort {cur.delta > 0 ? "+" : ""}
              {cur.delta}
            </span>
          )}
          {cur.outside && <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-rose-800 ring-1 ring-inset ring-rose-200">Outside the case record</span>}
        </div>
        </div>
        <div className="md:border-l md:border-line md:pl-4">
          <dl className="grid grid-cols-3 gap-2 text-center md:grid-cols-1 md:text-left">
            {[
              ["Findings covered", cur.coverage],
              ["Communication", cur.communication],
              ["Patient comfort", cur.comfort],
            ].map(([k, v]) => (
              <div key={k as string} className="md:flex md:items-baseline md:justify-between">
                <dt className="text-[12px] text-ink-3">{k as string}</dt>
                <dd className="font-mono text-[15px] font-semibold tabular-nums text-ink">{pct(v as number)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 border-t border-line pt-2.5 text-[12.5px] text-ink-3">{cur.note ? `Signals: ${cur.note}.` : "No notable signals this turn."}</p>
        </div>
      </div>
    </div>
  );
}
