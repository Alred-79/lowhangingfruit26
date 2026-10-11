"use client";
import { ChartLine, Table2 } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { cx } from "@/components/ui";
import EloTrail from "@/components/history/EloTrail";
import type { HistoryPoint, LevelTick } from "./charts";

export interface HistorySeries {
  key: string;
  name: string;
  points: HistoryPoint[];
}

export interface MasteryAxis {
  key: string;
  label: string;
  value: number;
  n: number;
}

const v = (o: Record<string, string | number>) => o as CSSProperties;

/** A radar of mastery whose axes double as the series picker: click a spoke to read that domain's history. */
function PickRadar({ data, selected, onPick }: { data: MasteryAxis[]; selected: string; onPick: (k: string) => void }) {
  const R = 33;
  const pt = (i: number, f: number) => {
    const a = -Math.PI / 2 + (i / data.length) * Math.PI * 2;
    return [50 + Math.cos(a) * R * f, 50 + Math.sin(a) * R * f] as const;
  };
  const poly = data.map((d, i) => pt(i, Math.max(0.05, d.value / 100)).map((n) => n.toFixed(2)).join(",")).join(" ");
  return (
    <svg viewBox="-4 -2 108 104" className="mx-auto w-full max-w-[330px] overflow-visible" role="img" aria-label={`Mastery by skill on a 0 to 100 scale: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={data.map((_, i) => pt(i, f).map((n) => n.toFixed(2)).join(",")).join(" ")} fill={f === 1 ? "var(--color-mastery-soft)" : "none"} stroke="var(--color-mastery)" strokeOpacity={0.2} strokeWidth={0.5} />
      ))}
      {data.map((d, i) => {
        const [x, y] = pt(i, 1);
        const on = d.key === selected;
        return <line key={d.key} x1={50} y1={50} x2={x} y2={y} stroke="var(--color-mastery)" strokeOpacity={on ? 0.9 : 0.16} strokeWidth={on ? 1.4 : 0.5} style={{ transition: "stroke-opacity 200ms, stroke-width 200ms" }} />;
      })}
      <g className="pop-spring" style={{ transformOrigin: "50px 50px" }}>
        <polygon points={poly} fill="var(--color-mastery)" fillOpacity={0.24} stroke="var(--color-mastery)" strokeWidth={1.3} strokeLinejoin="round" />
      </g>
      {data.map((d, i) => {
        const [x, y] = pt(i, Math.max(0.05, d.value / 100));
        const [lx, ly] = pt(i, 1.36);
        const on = d.key === selected;
        return (
          <g key={d.key} className="cursor-pointer" onClick={() => onPick(d.key)}>
            <circle cx={x} cy={y} r={on ? 3.2 : 2} fill={on ? "var(--color-xp)" : "var(--color-mastery)"} stroke="var(--color-ink)" strokeWidth={on ? 0.8 : 0.4} style={{ transition: "r 200ms var(--ease-out-ui)" }} />
            <circle cx={lx} cy={ly} r={9} fill="transparent" />
            <text x={lx} y={ly - 1.5} textAnchor="middle" fontSize={4.6} fontWeight={on ? 800 : 600} fill={on ? "var(--color-mastery-ink)" : "var(--color-ink-2)"}>
              {d.label}
            </text>
            <text x={lx} y={ly + 4} textAnchor="middle" fontSize={4.6} fontWeight={800} fontFamily="var(--font-mono)" fill="var(--color-ink)">
              {d.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Rating after each scored visit, for all domains together or one at a time, with a table of the
 * same numbers. With `mastery`, a radar sits beside it and its spokes pick the series too (the chips
 * below are the keyboard path: a radio group with the arrow keys).
 */
export default function RatingHistory({ series, ticks, lo, hi, mastery }: { series: HistorySeries[]; ticks: LevelTick[]; lo: number; hi: number; mastery?: MasteryAxis[] }) {
  const [key, setKey] = useState(series[0].key);
  const [table, setTable] = useState(false);
  const s = series.find((x) => x.key === key) || series[0];
  const first = s.points[0]?.value ?? 0;
  const now = s.points[s.points.length - 1]?.value ?? 0;
  const delta = Math.round(now - first);
  const masteryOf = new Map((mastery || []).map((m) => [m.key, m]));
  const pick = (k: string) => (series.some((x) => x.key === k) ? setKey(k) : undefined);
  const radar = mastery && mastery.length >= 3;

  function arrows(e: React.KeyboardEvent<HTMLDivElement>) {
    const i = series.findIndex((x) => x.key === key);
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = series[(i + d + series.length) % series.length];
    setKey(next.key);
    (e.currentTarget.querySelector(`[data-k="${next.key}"]`) as HTMLElement | null)?.focus();
  }

  return (
    <div className={cx(radar && "grid gap-6 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)] lg:items-start")}>
      {radar && (
        <div>
          <PickRadar data={mastery!} selected={key} onPick={pick} />
          <p className="mt-1 text-center text-[12px] text-ink-3">Mastery on a 0-100 scale from your rubric ratings. Tap a skill to read its history.</p>
        </div>
      )}
      <div className="min-w-0">
        <p id="hist-show" className="mb-1.5 text-[12.5px] font-bold text-ink-2">
          Show
        </p>
        <div role="radiogroup" aria-labelledby="hist-show" className="flex flex-wrap gap-1.5" onKeyDown={arrows}>
          {series.map((x, i) => {
            const on = x.key === key;
            const mm = masteryOf.get(x.key);
            return (
              <button
                key={x.key}
                data-k={x.key}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => setKey(x.key)}
                className={cx(
                  "press pop-spring inline-flex min-h-9 items-center gap-1.5 rounded-full pl-3 pr-1.5 text-[12.5px] font-bold transition-[background-color,color,box-shadow] duration-200 pointer-coarse:min-h-11",
                  on ? "bg-[var(--color-mastery)] text-white shadow-e2" : "bg-surface text-ink-2 ring-1 ring-inset ring-line hover:ring-[var(--color-mastery)]",
                  !mm && "pr-3",
                )}
                style={v({ "--i": i })}
              >
                {x.key === "__all" ? "All domains" : mm?.label || x.name}
                {mm && <span className={cx("grid h-6 min-w-6 place-items-center rounded-full px-1 font-mono text-[11.5px]", on ? "bg-white text-[var(--color-mastery-ink)]" : "bg-[var(--color-mastery-soft)] text-[var(--color-mastery-ink)]")}>{mm.value}</span>}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink-3">{s.name}</p>
            <p className="flex items-baseline gap-2">
              <span key={s.key} className="pop-spring font-display text-[34px] font-black leading-none tracking-[-0.03em] text-ink">
                {Math.round(now)}
              </span>
              <span className={cx("rounded-full px-2 py-0.5 font-mono text-[12.5px] font-bold", delta >= 0 ? "bg-[var(--color-xp-soft)] text-[var(--color-xp-ink)]" : "bg-[var(--color-tier-hidden-soft)] text-[var(--color-tier-hidden-ink)]")}>
                {delta >= 0 ? "+" : "−"}
                {Math.abs(delta)} since start
              </span>
            </p>
          </div>
          <button type="button" className="press inline-flex min-h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[12.5px] font-bold text-brand-700 ring-1 ring-inset ring-line hover:bg-brand-50 pointer-coarse:min-h-11" aria-expanded={table} onClick={() => setTable(!table)}>
            {table ? <ChartLine className="h-4 w-4" aria-hidden /> : <Table2 className="h-4 w-4" aria-hidden />}
            {table ? "Show as chart" : "Show as table"}
          </button>
        </div>

        <div className="mt-2">
          {table ? (
            <div className="scroll-quiet max-h-72 overflow-y-auto rounded-2xl ring-1 ring-line">
              <table className="w-full text-[13.5px]">
                <thead className="sticky top-0 bg-surface-2">
                  <tr className="text-left text-[12px] text-ink-3">
                    <th className="px-3 py-2 font-semibold">Visit</th>
                    <th className="px-3 py-2 font-semibold">Details</th>
                    <th className="px-3 py-2 text-right font-semibold">Rating after</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {s.points.map((p, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap px-3 py-1.5 font-semibold text-ink">{p.label}</td>
                      <td className="px-3 py-1.5 text-[12.5px] text-ink-2">{p.lines.join(" · ")}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold tabular-nums text-ink">{Math.round(p.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EloTrail key={s.key} points={s.points} ticks={ticks} lo={lo} hi={hi} name={s.name} />
          )}
        </div>
      </div>
    </div>
  );
}
