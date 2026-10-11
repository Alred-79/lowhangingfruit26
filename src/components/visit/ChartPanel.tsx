"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ChartView } from "@/lib/engine/encounter";
import ChartReview from "./chart/ChartReview";
import { type Result } from "./chart/derive";
import Orders from "./chart/Orders";
import ResultsReview from "./chart/ResultsReview";
import Snapshot from "./chart/Snapshot";
import Storyboard, { patientBits } from "./chart/Storyboard";
import { ActivityLog, VisitNote } from "./chart/VisitNote";
import { Count, LINK } from "./chart/ui";

type Tab = "snapshot" | "review" | "results" | "orders" | "visit" | "activity" | "team";

/** Below this panel width the patient panel starts collapsed to leave room for the chart. */
const WIDE = 740;

/**
 * The electronic chart beside the visit, laid out like a clinician's hospital chart: a patient panel on the left and
 * activity tabs (Snapshot, Chart Review, Results Review, Orders, This Visit) on top. It only ever receives the student-safe ChartView.
 */
export default function ChartPanel({
  chart,
  fresh,
  onOrder,
  ordering,
  locked,
  teamTab,
  focus,
}: {
  chart: ChartView;
  /** ids (facts, actions, documents) that arrived in the latest update, highlighted briefly */
  fresh: Set<string>;
  onOrder: (request: string) => Promise<void>;
  ordering: boolean;
  locked: boolean;
  teamTab?: ReactNode;
  /** Bump `key` to bring a tab to the front (for example, "View in chart" on a result in the conversation). */
  focus?: { tab: "results" | "orders"; key: number };
}) {
  const [tab, setTab] = useState<Tab>("snapshot");
  const [seen, setSeen] = useState({ visit: 0, results: 0, orders: 0, review: 0 });
  const [now] = useState(() => new Date());
  const [width, setWidth] = useState(0);
  const [sbOpen, setSbOpen] = useState<boolean | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Results that arrived after the chart opened, until the student has looked at them in Results Review.
  const [mountIds] = useState(() => new Set(chart.results.map((r) => r.id)));
  const known = useRef({ results: new Set(chart.results.map((r) => r.id)), unmatched: chart.unmatched.length });
  const lastReq = useRef("");
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [arrived, setArrived] = useState<Set<string>>(new Set());
  const [requestOf, setRequestOf] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ text: string; to: Tab } | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Notice orders that came back: highlight them, remember what was asked for, and offer a jump.
  useEffect(() => {
    const fresher = chart.results.filter((r) => !known.current.results.has(r.id));
    const newUnmatched = chart.unmatched.length > known.current.unmatched;
    if (fresher.length) {
      fresher.forEach((r) => known.current.results.add(r.id));
      setArrived((a) => new Set([...a, ...fresher.map((r) => r.id)]));
      if (lastReq.current) setRequestOf((m) => ({ ...m, ...Object.fromEntries(fresher.map((r) => [r.id, lastReq.current])) }));
      setBanner({ text: `New result: ${fresher[0].name}${fresher.length > 1 ? ` and ${fresher.length - 1} more` : ""}`, to: "results" });
    } else if (newUnmatched) setBanner({ text: `No approved result for "${chart.unmatched[chart.unmatched.length - 1].request}"`, to: "orders" });
    known.current.unmatched = chart.unmatched.length;
  }, [chart.results, chart.unmatched]);

  const counts = useMemo(
    () => ({
      visit: chart.sections.reduce((n, s) => n + s.items.length, 0),
      results: chart.results.length,
      orders: chart.results.length + chart.unmatched.length,
      review: chart.artifacts.length,
    }),
    [chart],
  );
  // The open tab counts as read; what it held is remembered when the student leaves it.
  function go(t: Tab) {
    if (tab === "visit" || tab === "results" || tab === "orders" || tab === "review") setSeen((s) => ({ ...s, [tab]: counts[tab] }));
    if (tab === "results" && t !== "results") setArrived(new Set());
    setTab(t);
    setBanner((b) => (b && b.to === t ? null : b));
  }

  // A turn-0 result is from an earlier visit only if it was already there when the chart opened on a follow-up visit.
  const followUp = /^Follow-up visit/i.test(chart.brief) || chart.sections.some((s) => s.items.some((i) => i.how === "record"));
  const resultWhen = useCallback((r: Result) => (r.turn > 0 ? `after T${r.turn}` : followUp && mountIds.has(r.id) ? "earlier visit" : "start of visit"), [followUp, mountIds]);
  const logWhen = (l: ChartView["log"][number]) => {
    if (l.turn > 0) return l.kind === "result" ? `after T${l.turn}` : `T${l.turn}`;
    if (l.kind === "result") {
      const r = chart.results.find((x) => `${x.name}: ${x.result}` === l.text);
      return r ? resultWhen(r) : "start of visit";
    }
    return followUp ? "on file" : "start of visit";
  };

  async function submitOrder(text: string) {
    lastReq.current = text;
    setPendingText(text);
    try {
      await onOrder(text);
    } finally {
      setPendingText(null);
    }
  }

  // Asked from outside (the conversation's result card) to show a tab.
  const [lastFocus, setLastFocus] = useState(focus?.key);
  if (focus && focus.key !== lastFocus) {
    setLastFocus(focus.key);
    go(focus.tab);
  }

  const bits = patientBits(chart, now);
  const open = sbOpen ?? width >= WIDE;
  const unread = (k: keyof typeof seen) => (tab === k ? 0 : Math.max(0, counts[k] - seen[k]));

  const tabs: { id: Tab; label: string; unread?: number }[] = [
    { id: "snapshot", label: "Snapshot" },
    { id: "review", label: "Chart Review", unread: unread("review") },
    { id: "results", label: "Results Review", unread: unread("results") },
    { id: "orders", label: "Orders", unread: unread("orders") },
    { id: "visit", label: "This Visit", unread: unread("visit") },
    { id: "activity", label: "Activity" },
    ...(teamTab ? [{ id: "team" as Tab, label: "Care Team" }] : []),
  ];

  return (
    <div ref={rootRef} className="flex h-full min-h-0 overflow-hidden rounded-lg border border-[#8d9bad] bg-white text-[14px] text-[#1a1a1a]">
      <Storyboard chart={chart} bits={bits} open={open} onToggle={() => setSbOpen(!open)} onGo={() => go("snapshot")} />
      <div className="@container flex min-w-0 flex-1 flex-col">
        {!open && (
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-[#8d9bad] bg-[#e4e9ef] px-2.5 py-1 text-sm">
            <span className="font-bold text-[#10253f]">{bits.display}</span>
            <span className="text-[#44556b]">
              {chart.patient.age} y.o. {bits.sexLabel} · DOB {bits.dob} · MRN {bits.mrn}
            </span>
            <span className={`rounded-sm px-1.5 text-xs font-semibold leading-5 ${bits.allergic ? "bg-[#c62828] text-white" : "bg-[#d5dde7] text-[#2b3a4c]"}`}>Allergies: {bits.allergyText || "not on file"}</span>
          </div>
        )}
        <div role="tablist" className="flex shrink-0 gap-0 overflow-x-auto border-b border-[#8d9bad] bg-[#ccd6e2] px-1.5 pt-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => go(t.id)}
              className={`relative -mb-px flex items-center gap-1 whitespace-nowrap rounded-t border border-b-0 px-1.5 py-1.5 text-sm ${tab === t.id ? "border-[#8d9bad] border-t-[3px] border-t-[#1d5fb8] bg-white pt-1 font-semibold text-[#10253f]" : "border-transparent text-[#1f3a5f] hover:bg-[#dde5ee]"}`}
            >
              {t.label}
              {/* Unread counts sit on the tab's corner so they never widen the strip. */}
              {!!t.unread && t.unread > 0 && (
                <span className="pointer-events-none absolute -right-1.5 -top-1 origin-top-right scale-90">
                  <Count n={t.unread} />
                </span>
              )}
            </button>
          ))}
        </div>
        {banner && tab !== banner.to && (
          <div className="flex shrink-0 items-center gap-2 border-b border-[#e6c200] bg-[#fff4c2] px-3 py-1.5 text-sm text-[#4a3800]">
            <span className="font-semibold">{banner.text}</span>
            <button onClick={() => go(banner.to)} className={LINK}>
              {banner.to === "results" ? "Open in Results Review" : "View in Orders"}
            </button>
            <button onClick={() => setBanner(null)} aria-label="Dismiss" className="ml-auto text-[#4a3800] hover:underline">
              Dismiss
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 bg-white">
          {tab === "review" ? (
            <ChartReview chart={chart} now={now} fresh={fresh} resultWhen={resultWhen} newIds={arrived} />
          ) : (
            <div className="h-full overflow-y-auto bg-[#f2f5f8]">
              {tab === "snapshot" && <Snapshot chart={chart} bits={bits} onGo={(t) => go(t)} />}
              {tab === "results" && <ResultsReview chart={chart} now={now} resultWhen={resultWhen} newIds={arrived} fresh={fresh} />}
              {tab === "orders" && (
                <Orders
                  chart={chart}
                  ordering={ordering}
                  locked={locked}
                  pendingText={ordering ? pendingText : null}
                  onSubmit={submitOrder}
                  newIds={arrived}
                  fresh={fresh}
                  requestOf={requestOf}
                  resultWhen={resultWhen}
                  onOpenResult={() => go("results")}
                />
              )}
              {tab === "visit" && <VisitNote chart={chart} fresh={fresh} newIds={arrived} resultWhen={resultWhen} />}
              {tab === "activity" && <ActivityLog chart={chart} logWhen={logWhen} />}
              {tab === "team" && <div className="bg-white p-3">{teamTab}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
