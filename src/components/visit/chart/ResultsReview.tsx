"use client";

import { Fragment, useMemo, useState } from "react";
import type { ChartView } from "@/lib/engine/encounter";
import { labGrids, parseComponents, sheetGrids, type Grid, type Result } from "./derive";
import { Bar, Empty, NewBadge, TD, TH, Value } from "./ui";

function GridTable({ g, onlyAbnormal }: { g: Grid; onlyAbnormal: boolean }) {
  const rows = onlyAbnormal ? g.rows.filter((r) => Object.values(r.cells).some((c) => c.flag)) : g.rows;
  const lab = g.kind === "lab";
  if (!rows.length) return <p className="px-3 py-2 text-sm italic text-[#5d6b7c]">No abnormal values.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={`${TH} sticky left-0 z-[1] min-w-32`}>{lab ? "Component" : "Measure"}</th>
            {lab && <th className={TH}>Ref range</th>}
            {g.cols.map((c) => (
              <th key={c.key} className={`${TH} whitespace-nowrap text-right`}>
                <div>{c.label}</div>
                {c.sub && <div className="font-normal normal-case tracking-normal text-[#5d6b7c]">{c.sub}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[#e3e9ef] odd:bg-white even:bg-[#f5f8fb]">
              <td className={`${TD} sticky left-0 z-[1] font-semibold text-[#10253f] ${i % 2 ? "bg-[#f5f8fb]" : "bg-white"}`}>{r.name}</td>
              {lab && (
                <td className={`${TD} whitespace-nowrap text-xs text-[#5d6b7c]`}>
                  {r.ref}
                  {r.unit ? ` ${r.unit}` : ""}
                </td>
              )}
              {g.cols.map((c) => {
                const cell = r.cells[c.key];
                return (
                  <td key={c.key} className={`${TD} whitespace-nowrap text-right tabular-nums`}>
                    {cell ? <Value v={cell.v} flag={cell.flag} /> : <span className="text-[#9aa8b8]">–</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Flowsheet-style results: tests as rows, collection dates as columns, abnormal values flagged. */
export default function ResultsReview({ chart, now, resultWhen, newIds, fresh }: { chart: ChartView; now: Date; resultWhen: (r: Result) => string; newIds: Set<string>; fresh: Set<string> }) {
  const [onlyAbn, setOnlyAbn] = useState(false);
  const labs = useMemo(() => labGrids(chart.artifacts, now), [chart.artifacts, now]);
  const sheets = useMemo(() => sheetGrids(chart.artifacts, now), [chart.artifacts, now]);
  const vitals = sheets.filter((s) => s.kind === "vitals");
  const other = sheets.filter((s) => s.kind !== "vitals");
  const results = [...chart.results].sort((a, b) => Number(newIds.has(b.id)) - Number(newIds.has(a.id)) || b.turn - a.turn);
  const empty = !labs.length && !sheets.length && !results.length;

  return (
    <div className="space-y-2 p-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5 text-[#2b3a4c]">
          <input type="checkbox" checked={onlyAbn} onChange={(e) => setOnlyAbn(e.target.checked)} />
          Abnormal only
        </label>
        <span className="text-xs text-[#5d6b7c]">
          <span className="font-bold text-[#b00000]">H</span> high · <span className="font-bold text-[#0b3f8f]">L</span> low · <span className="font-bold text-[#b00000]">!</span> abnormal
        </span>
      </div>
      {empty && (
        <div className="border border-[#b9c4d1] bg-white">
          <Empty>No results on file. Orders you place appear here as soon as they result.</Empty>
        </div>
      )}

      {results.length > 0 && (
        <Bar title="Ordered this visit" right={<span className="text-xs text-[#44556b]">{results.length} resulted</span>}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={TH}>Order / component</th>
                <th className={TH}>Result</th>
                <th className={`${TH} hidden @md:table-cell`}>Resulted</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const comps = parseComponents(r.result);
                const isNew = newIds.has(r.id);
                const hl = `${isNew ? "bg-[#fff4c2]" : ""} ${fresh.has(r.id) ? "flash-new" : ""}`;
                const head = (
                  <tr className={`border-b border-[#c3ccd7] bg-[#eef2f6] ${hl}`}>
                    <td colSpan={2} className={`${TD} font-bold text-[#10253f]`}>
                      {r.name} {isNew && <NewBadge />} {r.abnormal && !comps?.some((c) => c.flag) && <Value v="Abnormal" flag="A" />}
                    </td>
                    <td className={`${TD} hidden text-xs text-[#5d6b7c] @md:table-cell`}>{resultWhen(r)}</td>
                  </tr>
                );
                if (onlyAbn && !r.abnormal && !comps?.some((c) => c.flag)) return null;
                return (
                  <Fragment key={r.id}>
                    {head}
                    {!comps ? (
                      <tr className={`border-b border-[#e3e9ef] ${hl}`}>
                        <td colSpan={3} className={`${TD} whitespace-pre-wrap leading-relaxed text-[#1a1a1a]`}>
                          {r.result}
                        </td>
                      </tr>
                    ) : (
                      comps
                        .filter((c) => !onlyAbn || c.flag)
                        .map((c, i) => (
                          <tr key={i} className={`border-b border-[#e3e9ef] odd:bg-white even:bg-[#f5f8fb] ${isNew ? "!bg-[#fffbe6]" : ""}`}>
                            <td className={`${TD} pl-5 font-semibold text-[#10253f]`}>{c.name}</td>
                            <td className={`${TD} tabular-nums`}>
                              <Value v={c.value} flag={c.flag} /> <span className="text-xs text-[#5d6b7c]">{c.unit}</span>
                            </td>
                            <td className={`${TD} hidden @md:table-cell`} />
                          </tr>
                        ))
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Bar>
      )}

      {labs.map((g) => (
        <Bar key={g.id} title={g.title} right={g.isNew ? <NewBadge /> : <span className="text-xs text-[#44556b]">Lab</span>}>
          <GridTable g={g} onlyAbnormal={onlyAbn} />
        </Bar>
      ))}
      {vitals.map((g) => (
        <Bar key={g.id} title={g.title} right={g.isNew ? <NewBadge /> : <span className="text-xs text-[#44556b]">Vitals</span>}>
          <GridTable g={g} onlyAbnormal={onlyAbn} />
        </Bar>
      ))}
      {other.map((g) => (
        <Bar key={g.id} title={g.title} right={g.isNew ? <NewBadge /> : undefined}>
          <GridTable g={g} onlyAbnormal={onlyAbn} />
        </Bar>
      ))}
    </div>
  );
}
