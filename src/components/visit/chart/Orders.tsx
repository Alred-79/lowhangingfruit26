"use client";

import { useState } from "react";
import type { ChartView } from "@/lib/engine/encounter";
import { type Result } from "./derive";
import { Bar, Empty, LINK, NewBadge, TD, TH, Value } from "./ui";

export const KIND_LABEL: Record<string, string> = { exam: "Remote exam", vitals: "Vitals", lab: "Lab", imaging: "Imaging", test: "Test", record: "Record", assessment: "Assessment", procedure: "Procedure" };

const STATUS = {
  ordered: "bg-[#dbe9fb] text-[#0b3f8f]",
  resulted: "bg-[#d9f0dc] text-[#14612a]",
  none: "bg-[#e6eaef] text-[#44556b]",
};

function Status({ s, children }: { s: keyof typeof STATUS; children: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-sm px-1.5 text-xs font-semibold leading-5 ${STATUS[s]}`}>{children}</span>;
}

/** Order entry plus the list of orders placed this visit, status moving from Ordered to Resulted. */
export default function Orders({
  chart,
  ordering,
  locked,
  pendingText,
  onSubmit,
  newIds,
  fresh,
  requestOf,
  resultWhen,
  onOpenResult,
}: {
  chart: ChartView;
  ordering: boolean;
  locked: boolean;
  pendingText: string | null;
  onSubmit: (text: string) => void;
  newIds: Set<string>;
  fresh: Set<string>;
  requestOf: Record<string, string>;
  resultWhen: (r: Result) => string;
  onOpenResult: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const results = [...chart.results].reverse();
  const none = chart.results.length === 0 && chart.unmatched.length === 0 && !pendingText;

  return (
    <div className="space-y-2 p-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t || ordering || locked) return;
          setText("");
          onSubmit(t);
        }}
        className="border border-[#b9c4d1] bg-[#f2f5f8] p-2"
      >
        <label htmlFor="order-search" className="mb-1 block text-xs font-bold uppercase tracking-wide text-[#16365c]">
          New order: search for an exam, test or record
        </label>
        <div className="flex gap-2">
          <input
            id="order-search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={locked || ordering}
            placeholder="e.g. home blood pressure reading, lipid panel, guided abdominal exam, pharmacy refill history"
            className="min-w-0 flex-1 border border-[#7f90a5] bg-white px-2 py-1.5 text-sm focus:border-[#1a5eb0] focus:outline-none focus:ring-2 focus:ring-[#bcd5f2] disabled:bg-[#e6eaef]"
          />
          <button disabled={locked || ordering || !text.trim()} className="border border-[#14447f] bg-[#1d5fb8] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#164e99] disabled:border-[#b9c4d1] disabled:bg-[#c8d1dc]">
            {ordering ? "Sending" : "Sign order"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-[#5d6b7c]">Only results approved for this case can come back. Exams are guided over video.</p>
      </form>

      <Bar title="Active / signed orders" right={<span className="text-xs text-[#44556b]">{chart.results.length + chart.unmatched.length + (pendingText ? 1 : 0)} this visit</span>}>
        {none ? (
          <Empty>No orders yet. Orders you sign appear here and result into Results Review.</Empty>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={`${TH} w-28`}>Status</th>
                <th className={TH}>Order</th>
                <th className={`${TH} hidden @md:table-cell`}>Type</th>
                <th className={`${TH} w-28`}>When</th>
              </tr>
            </thead>
            <tbody>
              {pendingText && (
                <tr className="border-b border-[#e3e9ef] bg-[#eef5fe]">
                  <td className={TD}>
                    <Status s="ordered">Ordered</Status>
                  </td>
                  <td className={`${TD} font-medium text-[#10253f]`}>{pendingText}</td>
                  <td className={`${TD} hidden text-[#44556b] @md:table-cell`}>Pending</td>
                  <td className={`${TD} text-xs text-[#5d6b7c]`}>Just now</td>
                </tr>
              )}
              {results.map((r) => {
                const isNew = newIds.has(r.id);
                const expanded = override[r.id] ?? isNew;
                return (
                  <ResultRow key={r.id} r={r} isNew={isNew} fresh={fresh.has(r.id)} expanded={expanded} request={requestOf[r.id]} when={resultWhen(r)} onToggle={() => setOverride((o) => ({ ...o, [r.id]: !expanded }))} onOpenResult={() => onOpenResult(r.id)} />
                );
              })}
              {[...chart.unmatched].reverse().map((u, i) => (
                <tr key={"u" + i} className="border-b border-[#e3e9ef] odd:bg-white even:bg-[#f5f8fb]">
                  <td className={`${TD}`}>
                    <Status s="none">No result</Status>
                  </td>
                  <td colSpan={2} className={`${TD} text-[#44556b]`}>
                    <span className="font-medium text-[#10253f]">{u.request}</span>: no approved result is available for this in the case file.
                  </td>
                  <td className={`${TD} text-xs text-[#5d6b7c]`}>{u.turn > 0 ? `after T${u.turn}` : "start of visit"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Bar>
    </div>
  );
}

function ResultRow({ r, isNew, fresh, expanded, request, when, onToggle, onOpenResult }: { r: Result; isNew: boolean; fresh: boolean; expanded: boolean; request?: string; when: string; onToggle: () => void; onOpenResult: () => void }) {
  return (
    <>
      <tr onClick={onToggle} className={`cursor-pointer border-b border-[#e3e9ef] ${isNew ? "bg-[#fff4c2]" : "odd:bg-white even:bg-[#f5f8fb]"} hover:bg-[#e3eefb] ${fresh ? "flash-new" : ""}`}>
        <td className={TD}>
          <Status s="resulted">Resulted</Status>
        </td>
        <td className={`${TD} font-medium text-[#1a5eb0]`}>
          {r.name} {isNew && <NewBadge />} {r.abnormal && <Value v="Abnormal" flag="A" />}
          {request && request.toLowerCase() !== r.name.toLowerCase() && <div className="font-normal text-xs text-[#5d6b7c]">Requested as: {request}</div>}
        </td>
        <td className={`${TD} hidden text-[#44556b] @md:table-cell`}>{KIND_LABEL[r.kind] || r.kind}</td>
        <td className={`${TD} text-xs text-[#5d6b7c]`}>{when}</td>
      </tr>
      {expanded && (
        <tr className={`border-b border-[#c3ccd7] ${isNew ? "bg-[#fffbe6]" : "bg-white"}`}>
          <td />
          <td colSpan={3} className="px-2 pb-2 pt-1">
            <div className="border-l-4 border-[#1d5fb8] bg-white py-1 pl-3 text-sm leading-relaxed">
              <p className="whitespace-pre-wrap text-[#1a1a1a]">{r.result}</p>
              <button onClick={onOpenResult} className={`mt-1 text-xs ${LINK}`}>
                Open in Results Review
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
