"use client";

import { useMemo, useState } from "react";
import ArtifactView, { artifactTypeLabel } from "@/components/chart/ArtifactView";
import type { ChartView } from "@/lib/engine/encounter";
import { dateParts, type ChartArtifact, type Result } from "./derive";
import { Empty, NewBadge, TD, TH, Value } from "./ui";

type Sub = "encounters" | "notes" | "labs" | "imaging" | "meds" | "other";
const SUBS: { id: Sub; label: string }[] = [
  { id: "encounters", label: "Encounters" },
  { id: "notes", label: "Notes" },
  { id: "labs", label: "Labs" },
  { id: "imaging", label: "Imaging" },
  { id: "meds", label: "Meds" },
  { id: "other", label: "Other" },
];

interface Item {
  key: string;
  subs: Sub[];
  days: number | null;
  date: string;
  dateSub: string;
  type: string;
  title: string;
  author: string;
  isNew: boolean;
  artifact?: ChartArtifact;
  result?: Result;
  current?: boolean;
}

function subOf(a: ChartArtifact): Sub {
  if (a.type === "lab_report") return "labs";
  if (a.type === "imaging" || a.type === "ecg") return "imaging";
  if (a.type === "medication_list") return "meds";
  if (a.type === "note") return "notes";
  return "other";
}

const RANGES = [
  { id: "all", label: "All dates", max: Infinity },
  { id: "30", label: "Last 30 days", max: 30 },
  { id: "365", label: "Last year", max: 365 },
  { id: "older", label: "Older than a year", max: -1 },
];

export default function ChartReview({ chart, now, fresh, resultWhen, newIds }: { chart: ChartView; now: Date; fresh: Set<string>; resultWhen: (r: Result) => string; newIds: Set<string> }) {
  const [sub, setSub] = useState<Sub>("encounters");
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [range, setRange] = useState("all");
  const [asc, setAsc] = useState(false);

  const items = useMemo(() => {
    const out: Item[] = [];
    out.push({ key: "current", subs: ["encounters"], days: 0, date: dateParts("Today", now).label, dateSub: "In progress", type: "Video visit", title: chart.chiefComplaint, author: "You", isNew: false, current: true });
    for (const a of chart.artifacts) {
      const d = dateParts(a.date, now);
      const s = subOf(a);
      const subs: Sub[] = [s];
      // Authored clinic documents also show as encounters, the way a visit list would.
      if (s === "notes" && a.author) subs.push("encounters");
      out.push({ key: "a:" + a.id, subs, days: d.days, date: d.label, dateSub: d.sub, type: artifactTypeLabel(a.type), title: a.title, author: a.author || "", isNew: a.turn > 0, artifact: a });
    }
    for (const r of chart.results) {
      const s: Sub = r.kind === "lab" ? "labs" : r.kind === "imaging" ? "imaging" : "other";
      out.push({ key: "r:" + r.id, subs: [s], days: 0, date: dateParts("Today", now).label, dateSub: resultWhen(r), type: "Order result", title: r.name, author: "This visit", isNew: newIds.has(r.id), result: r });
    }
    return out;
  }, [chart, now, resultWhen, newIds]);

  const counts = Object.fromEntries(SUBS.map((s) => [s.id, items.filter((i) => i.subs.includes(s.id) && !i.current).length])) as Record<Sub, number>;
  const rg = RANGES.find((r) => r.id === range)!;
  const list = items
    .filter((i) => i.subs.includes(sub))
    .filter((i) => !q.trim() || `${i.title} ${i.author} ${i.type}`.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((i) => range === "all" || i.current || (i.days !== null && (rg.max < 0 ? i.days > 365 : i.days <= rg.max)))
    .sort((a, b) => ((a.days ?? 99999) - (b.days ?? 99999)) * (asc ? -1 : 1) || (a.current ? -1 : 0));
  const cur = list.find((i) => i.key === sel) || list[0];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 gap-0 overflow-x-auto border-b border-[#9aa8b8] bg-[#e9eef4] px-2 pt-1">
        {SUBS.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              setSub(s.id);
              setSel(null);
            }}
            className={`-mb-px whitespace-nowrap border border-b-0 px-3 py-1 text-sm ${sub === s.id ? "border-[#9aa8b8] bg-white font-semibold text-[#10253f]" : "border-transparent text-[#2b4468] hover:bg-[#dbe3ec]"}`}
          >
            {s.label}
            {s.id !== "encounters" && <span className="ml-1 text-xs text-[#5d6b7c]">{counts[s.id]}</span>}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#c3ccd7] bg-[#f2f5f8] px-2 py-1.5 text-sm">
        <label className="flex items-center gap-1 text-xs font-semibold text-[#44556b]">
          Filter
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this list" className="w-40 border border-[#9aa8b8] bg-white px-2 py-0.5 text-sm font-normal focus:border-[#1a5eb0] focus:outline-none" />
        </label>
        <label className="flex items-center gap-1 text-xs font-semibold text-[#44556b]">
          Date
          <select value={range} onChange={(e) => setRange(e.target.value)} className="border border-[#9aa8b8] bg-white px-1 py-0.5 text-sm font-normal">
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => setAsc((v) => !v)} className="border border-[#9aa8b8] bg-white px-2 py-0.5 text-xs hover:bg-[#eef2f6]">
          {asc ? "Oldest first" : "Newest first"}
        </button>
        <span className="ml-auto text-xs text-[#5d6b7c]">{list.length} shown</span>
      </div>

      <div className="max-h-[42%] min-h-[6.5rem] shrink-0 overflow-auto border-b border-[#9aa8b8]">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${TH} w-28`}>Date</th>
              <th className={`${TH} w-24`}>Type</th>
              <th className={TH}>Description</th>
              <th className={`${TH} hidden @md:table-cell`}>Author</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <Empty>{items.some((i) => i.subs.includes(sub) && !i.current) ? "Nothing matches these filters." : `No ${SUBS.find((s) => s.id === sub)!.label.toLowerCase()} in the chart${chart.turn > 0 ? " yet" : ""}.`}</Empty>
                </td>
              </tr>
            )}
            {list.map((i) => {
              const on = cur?.key === i.key;
              return (
                <tr
                  key={i.key}
                  onClick={() => setSel(i.key)}
                  className={`cursor-pointer border-b border-[#e3e9ef] ${on ? "bg-[#c7dcf5]" : "odd:bg-white even:bg-[#f5f8fb] hover:bg-[#e3eefb]"} ${i.artifact && fresh.has(i.artifact.id) ? "flash-new" : ""}`}
                >
                  <td className={TD}>
                    <div className="whitespace-nowrap text-[#1a1a1a]">{i.date}</div>
                    {i.dateSub && <div className="text-xs text-[#5d6b7c]">{i.dateSub}</div>}
                  </td>
                  <td className={`${TD} text-[#44556b]`}>{i.type}</td>
                  <td className={`${TD} font-medium text-[#1a5eb0]`}>
                    {i.title} {i.isNew && <NewBadge />}
                    <div className="font-normal text-xs text-[#5d6b7c] @md:hidden">{i.author}</div>
                  </td>
                  <td className={`${TD} hidden text-[#44556b] @md:table-cell`}>{i.author}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white p-3">
        {!cur ? (
          <Empty>Select a row to preview it here.</Empty>
        ) : cur.artifact ? (
          <ArtifactView artifact={cur.artifact} />
        ) : cur.result ? (
          <article>
            <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#c3ccd7] pb-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-[#5d6b7c]">Order result</div>
                <h3 className="font-semibold text-[#10253f]">{cur.result.name}</h3>
              </div>
              <div className="text-xs text-[#5d6b7c]">{resultWhen(cur.result)}</div>
            </header>
            <p className="whitespace-pre-wrap leading-relaxed text-[#1a1a1a]">{cur.result.abnormal ? <Value v={cur.result.result} flag="A" /> : cur.result.result}</p>
          </article>
        ) : (
          <article>
            <h3 className="font-semibold text-[#10253f]">Video visit (in progress)</h3>
            <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
              <dt className="text-[#5d6b7c]">Reason</dt>
              <dd>{chart.chiefComplaint}</dd>
              <dt className="text-[#5d6b7c]">Setting</dt>
              <dd>{chart.setting}</dd>
              <dt className="text-[#5d6b7c]">Provider</dt>
              <dd>You</dd>
            </dl>
            <p className="mt-3 text-sm text-[#44556b]">What you document during the call is in This Visit. Outside documents appear in the other tabs of this list.</p>
          </article>
        )}
      </div>
    </div>
  );
}
