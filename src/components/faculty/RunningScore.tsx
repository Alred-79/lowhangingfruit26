"use client";
import { Table2, LineChart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import "./fac.css";

export interface TimelinePoint {
  turn: number;
  score: number;
  coverage: number;
  communication: number;
  comfort: number;
  note?: string;
}

/*
 * The four running measures of a live visit over turns (restores INV-LV-11: Running score, Findings covered and
 * Communication as series, plus Comfort). dataviz rules: one shared 0-100 axis (no dual axis); categorical hues in a
 * fixed order, validated with validate_palette.js on white (--pairs all: all checks pass, worst CVD pair 7.0 is in the
 * floor band, so identity is also carried by a legend, direct end labels with leader lines and a dashed Comfort line);
 * 2px lines, 8px end dots with a 2px surface ring; crosshair + tooltip on hover and on arrow keys; table view.
 */
export const SERIES = [
  { key: "score", name: "Running score", color: "#3b4cf0", dash: undefined, width: 3 },
  { key: "coverage", name: "Findings covered", color: "#11a39b", dash: undefined, width: 2 },
  { key: "communication", name: "Communication", color: "#a33fc4", dash: undefined, width: 2 },
  { key: "comfort", name: "Comfort", color: "#eb6834", dash: "5 4", width: 2 },
] as const;
type Key = (typeof SERIES)[number]["key"];

const pct = (v: number) => Math.round(v * 100);

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export default function RunningScore({ tl, active, onActive }: { tl: TimelinePoint[]; active: number | null; onActive: (i: number | null) => void }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [table, setTable] = useState(false);
  const H = 220;
  const m = { top: 12, right: 132, bottom: 26, left: 34 };
  const W = Math.max(width, 300);
  const narrow = W < 520;
  if (narrow) m.right = 16;
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const last = tl.length - 1;
  const x = (i: number) => m.left + (last <= 0 ? iw / 2 : (i / last) * iw);
  const y = (v: number) => m.top + ih - Math.max(0, Math.min(1, v)) * ih;
  const path = (k: Key) => tl.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");

  // Direct end labels: sorted by height, pushed apart to a 15px minimum, joined to their line end by a leader.
  const ends = SERIES.map((s) => ({ s, y0: y(tl[last][s.key]) })).sort((a, b) => a.y0 - b.y0);
  const placed: { s: (typeof SERIES)[number]; y0: number; y1: number }[] = [];
  for (const e of ends) {
    const prev = placed[placed.length - 1];
    placed.push({ ...e, y1: prev ? Math.max(e.y0, prev.y1 + 15) : Math.max(e.y0, m.top + 4) });
  }
  const overflow = placed.length ? placed[placed.length - 1].y1 - (m.top + ih) : 0;
  if (overflow > 0) for (const p of placed) p.y1 -= overflow;

  const xStep = Math.max(1, Math.ceil(tl.length / Math.max(2, Math.floor(iw / 44))));

  function move(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    for (let i = 1; i < tl.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    onActive(best);
  }
  function key(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") onActive(Math.min(last, (active ?? -1) + 1));
    else if (e.key === "ArrowLeft") onActive(Math.max(0, (active ?? tl.length) - 1));
    else if (e.key === "Home") onActive(0);
    else if (e.key === "End") onActive(last);
    else if (e.key === "Escape") onActive(null);
    else return;
    e.preventDefault();
  }

  const a = active !== null && tl[active] ? active : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] font-semibold text-ink-2" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <svg width="18" height="8" aria-hidden>
                <line x1="1" x2="17" y1="4" y2="4" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinecap="round" />
              </svg>
              {s.name}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setTable((t) => !t)} aria-pressed={table} className="press inline-flex min-h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[12px] font-bold text-ink-2 ring-1 ring-inset ring-line hover:text-brand-800 pointer-coarse:min-h-11">
          {table ? <LineChart className="h-3.5 w-3.5" aria-hidden /> : <Table2 className="h-3.5 w-3.5" aria-hidden />}
          {table ? "Show chart" : "Show as table"}
        </button>
      </div>

      {table ? (
        <div className="scroll-quiet max-h-60 overflow-auto rounded-2xl ring-1 ring-inset ring-line">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface-2 text-left text-[12px] text-ink-3">
              <tr>
                <th className="px-3 py-2 font-semibold">Turn</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-right font-semibold">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70 font-mono tabular-nums text-ink">
              {tl.map((p) => (
                <tr key={p.turn}>
                  <td className="px-3 py-1.5">T{p.turn}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right">
                      {pct(p[s.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative">
          {width > 0 ? (
            <svg
              width={W}
              height={H}
              role="img"
              tabIndex={0}
              aria-label={`Running score, findings covered, communication and comfort by turn, 0 to 100. Latest at turn ${tl[last].turn}: ${SERIES.map((s) => `${s.name} ${pct(tl[last][s.key])}`).join(", ")}. Use the arrow keys to step through turns; the transcript follows.`}
              className="block touch-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              onPointerMove={move}
              onPointerDown={move}
              onPointerLeave={() => onActive(null)}
              onKeyDown={key}
            >
              {[0, 25, 50, 75, 100].map((t) => (
                <g key={t}>
                  <line x1={m.left} x2={m.left + iw} y1={y(t / 100)} y2={y(t / 100)} stroke="var(--color-slate-200)" strokeWidth={1} />
                  <text x={m.left - 7} y={y(t / 100)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--color-ink-3)" className="tabular">
                    {t}
                  </text>
                </g>
              ))}
              {tl.map((p, i) =>
                i % xStep === 0 || i === last ? (
                  i !== last && last - i < xStep * 0.6 ? null : (
                    <text key={p.turn} x={x(i)} y={H - 7} textAnchor="middle" fontSize={11} fill="var(--color-ink-3)">
                      T{p.turn}
                    </text>
                  )
                ) : null,
              )}
              {a !== null && <line x1={x(a)} x2={x(a)} y1={m.top} y2={m.top + ih} stroke="var(--color-ink-3)" strokeWidth={1} />}
              <path d={`${path("score")} L${x(last)},${m.top + ih} L${x(0)},${m.top + ih} Z`} fill={SERIES[0].color} opacity={0.08} />
              {[...SERIES].reverse().map((s, k) => (
                <path key={s.key} d={path(s.key)} pathLength={s.dash ? undefined : 1} fill="none" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" className={s.dash ? undefined : "fac-draw"} style={{ ["--i" as string]: k }} />
              ))}
              {SERIES.map((s) => (
                <circle key={s.key} cx={x(a ?? last)} cy={y(tl[a ?? last][s.key])} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
              ))}
              {a === null && <circle cx={x(last)} cy={y(tl[last].score)} r={4} fill={SERIES[0].color} className="fac-ping" />}
              {!narrow &&
                placed.map((p) => (
                  <g key={p.s.key}>
                    <line x1={x(last) + 6} x2={x(last) + 16} y1={p.y0} y2={p.y1} stroke="var(--color-slate-300)" strokeWidth={1} />
                    <text x={x(last) + 20} y={p.y1} dy="0.32em" fontSize={12} fontWeight={700} fill="var(--color-ink)">
                      <tspan className="tabular">{pct(tl[last][p.s.key])}</tspan>
                      <tspan fontWeight={500} fill="var(--color-ink-3)">
                        {" "}
                        {p.s.name === "Running score" ? "Score" : p.s.name === "Findings covered" ? "Findings" : p.s.name}
                      </tspan>
                    </text>
                  </g>
                ))}
            </svg>
          ) : (
            <div style={{ height: H }} />
          )}
          {a !== null && width > 0 && (
            <div className="pointer-events-none absolute z-10 w-max max-w-[15rem] rounded-2xl bg-ink px-3 py-2 text-[12px] text-white shadow-e3" style={{ top: 4, ...(x(a) > W / 2 ? { right: W - x(a) + 12 } : { left: x(a) + 12 }) }} role="status">
              <div className="font-display text-[14px] font-extrabold">Turn {tl[a].turn}</div>
              <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
                {SERIES.map((s) => (
                  <div key={s.key} className="contents">
                    <dt className="inline-flex items-center gap-1.5 text-white/80">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
                      {s.name}
                    </dt>
                    <dd className="text-right font-mono font-bold tabular-nums">{pct(tl[a][s.key])}</dd>
                  </div>
                ))}
              </dl>
              {tl[a].note && <p className={cx("mt-1.5 border-t border-white/15 pt-1.5 text-white/80")}>{tl[a].note}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
