"use client";

import { AlertTriangle, ClipboardList, FileText, FlaskConical, History, ListChecks, Users } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import ArtifactView, { artifactTypeLabel } from "@/components/chart/ArtifactView";
import type { ChartView } from "@/lib/engine/encounter";

type Tab = "summary" | "visit" | "results" | "documents" | "activity" | "team";

const KIND_LABEL: Record<string, string> = { exam: "Remote exam", vitals: "Vitals", lab: "Lab", imaging: "Imaging", test: "Test", record: "Record", assessment: "Assessment", procedure: "Procedure" };

function Stamp({ turn, how }: { turn: number; how?: string }) {
  const rec = how === "record";
  return (
    <span className={`mt-0.5 inline-flex h-5 min-w-8 shrink-0 items-center justify-center rounded px-1 font-mono text-[11px] tabular-nums ${rec ? "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200" : "bg-slate-100 text-ink-3"}`} title={rec ? "Already on record from an earlier encounter" : `Turn ${turn}`}>
      {rec ? "REC" : `T${turn}`}
    </span>
  );
}

/** The electronic chart beside the visit. It only ever receives the student-safe ChartView. */
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
  /** Set by the transcript's "Filed to the chart" chip: open This visit at that turn. */
  focus?: { turn: number; key: number } | null;
}) {
  const [tab, setTab] = useState<Tab>("summary");
  const [seen, setSeen] = useState({ visit: 0, results: 0, documents: 0 });
  const [docId, setDocId] = useState<string | null>(null);
  const [order, setOrder] = useState("");
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);

  const counts = useMemo(
    () => ({
      visit: chart.sections.reduce((n, s) => n + s.items.length, 0),
      results: chart.results.length + chart.unmatched.length,
      documents: chart.artifacts.length,
    }),
    [chart],
  );

  // A chip in the transcript asked for a turn: switch to This visit (adjusting state to a new prop).
  if (focus && focus.key !== focusKey) {
    setFocusKey(focus.key);
    setTab("visit");
    setHighlight(focus.turn);
    setSeen((s) => ({ ...s, visit: counts.visit }));
  }
  useEffect(() => {
    if (highlight === null) return;
    document.querySelector(`[data-chart-turn="${highlight}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlight, focusKey]);

  function open(next: Tab) {
    // Mark both the tab being left and the tab being opened as read.
    setSeen((s) => {
      const out = { ...s };
      if (tab === "visit" || tab === "results" || tab === "documents") out[tab] = counts[tab];
      if (next === "visit" || next === "results" || next === "documents") out[next] = counts[next];
      return out;
    });
    setTab(next);
    if (next !== "visit") setHighlight(null);
  }

  const doc = chart.artifacts.find((d) => d.id === docId) || chart.artifacts[0];
  const allergies = chart.atStart.find((x) => /allerg/i.test(x.label));
  const allergyAlert = !!allergies && !/^(none|nkda|no known)/i.test(allergies.value.trim());
  const header = chart.atStart.filter((x) => !/allerg/i.test(x.label));
  const filedFacts = chart.sections.reduce((n, s) => n + s.items.filter((i) => i.how !== "record").length, 0);
  const onRecord = counts.visit - filedFacts;

  const unread = (id: Tab) => (id === tab || !(id === "visit" || id === "results" || id === "documents") ? 0 : Math.max(0, counts[id] - seen[id]));
  const tabs: { id: Tab; label: string; Icon: typeof FileText }[] = [
    { id: "summary", label: "Summary", Icon: ClipboardList },
    { id: "visit", label: "This visit", Icon: ListChecks },
    { id: "results", label: "Results & orders", Icon: FlaskConical },
    { id: "documents", label: "Chart review", Icon: FileText },
    { id: "activity", label: "Activity", Icon: History },
    ...(teamTab ? [{ id: "team" as Tab, label: "Care team", Icon: Users }] : []),
  ];

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault();
    const text = order.trim();
    if (!text || ordering) return;
    setOrder("");
    await onOrder(text);
  }

  return (
    <section aria-label="Patient chart" className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      {/* Patient banner */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-surface-2 px-4 py-3">
        <div>
          <div className="text-[15.5px] font-semibold leading-tight text-ink">{chart.patient.name}</div>
          <div className="mt-0.5 text-[12.5px] text-ink-3">
            {chart.patient.age} y · {chart.patient.sex} · {chart.patient.pronouns}
          </div>
        </div>
        <div className="min-w-0 flex-1 text-[12.5px]">
          <div className="text-ink-3">Reason for visit</div>
          <div className="truncate font-medium text-ink" title={chart.chiefComplaint}>
            {chart.chiefComplaint}
          </div>
        </div>
        <div className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] ${allergyAlert ? "bg-rose-600 font-medium text-white" : "bg-surface text-ink-2 ring-1 ring-inset ring-line"}`}>
          {allergyAlert && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
          <span className={allergyAlert ? "opacity-90" : "text-ink-3"}>Allergies:</span>
          {allergies ? allergies.value : "Not on file"}
        </div>
      </div>

      {/* The ledger strip: what this visit has put in the chart so far. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line/70 px-4 py-2 text-[12.5px] text-ink-3">
        <span className="font-medium text-ink-2">Filed this visit</span>
        <span>
          <span className="font-mono font-semibold tabular-nums text-ink">{filedFacts}</span> {filedFacts === 1 ? "finding" : "findings"}
        </span>
        <span>
          <span className="font-mono font-semibold tabular-nums text-ink">{chart.results.length}</span> {chart.results.length === 1 ? "result" : "results"}
        </span>
        <span>
          <span className="font-mono font-semibold tabular-nums text-ink">{chart.artifacts.length}</span> {chart.artifacts.length === 1 ? "document" : "documents"}
        </span>
        {onRecord > 0 && (
          <span>
            <span className="font-mono font-semibold tabular-nums text-ink">{onRecord}</span> already on record
          </span>
        )}
        <span className="ml-auto hidden text-[12px] sm:inline">Findings use the case&apos;s own wording, never the patient&apos;s</span>
      </div>

      <div role="tablist" aria-label="Chart sections" className="scroll-quiet flex gap-1 overflow-x-auto border-b border-line px-2 pt-1.5">
        {tabs.map((t) => {
          const n = unread(t.id);
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => open(t.id)}
              className={`relative -mb-px flex min-h-10 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-[13px] pointer-coarse:min-h-11 ${tab === t.id ? "border-brand-600 font-semibold text-ink" : "border-transparent text-ink-3 hover:bg-slate-50 hover:text-ink"}`}
            >
              <t.Icon className={`h-3.5 w-3.5 ${tab === t.id ? "text-brand-600" : ""}`} aria-hidden />
              {t.label}
              {n > 0 && (
                <span key={n} className="pop-in rounded-full bg-brand-600 px-1.5 font-mono text-[10.5px] font-semibold leading-4 text-white" aria-label={`${n} new`}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="scroll-quiet min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "summary" && (
          <div className="space-y-3">
            <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2">{chart.setting}</p>
            {header.length === 0 && <p className="text-[13.5px] text-ink-3">Nothing on file before this visit.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {header.map((x, i) => (
                <div key={i} className="rounded-xl border border-line p-3">
                  <div className="mb-1 text-[12px] font-semibold text-ink-3">{x.label}</div>
                  <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{x.value}</div>
                </div>
              ))}
            </div>
            <p className="text-[12.5px] text-ink-3">History you take during the call is filed under “This visit”. Results appear when you request an exam, test or record.</p>
          </div>
        )}

        {tab === "visit" && (
          <div className="space-y-5">
            {chart.sections.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center">
                <p className="text-[14px] font-medium text-ink">Nothing documented yet.</p>
                <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-3">What the patient tells you is filed here as you go, in the case&apos;s own clinical wording, stamped with the turn it came out.</p>
              </div>
            )}
            {chart.sections.map((s) => (
              <section key={s.category}>
                <h3 className="mb-1.5 flex items-center justify-between border-b border-line pb-1 text-[12.5px] font-semibold text-ink-2">
                  {s.label}
                  <span className="font-mono text-[11px] font-normal text-ink-3">{s.items.length}</span>
                </h3>
                <ul className="space-y-0.5">
                  {s.items.map((it, i) => (
                    <li
                      key={it.id}
                      data-chart-turn={it.turn}
                      style={{ "--i": i } as React.CSSProperties}
                      className={`flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px] leading-relaxed ${fresh.has(it.id) ? "flash-new" : ""} ${highlight !== null && it.turn === highlight && it.how !== "record" ? "bg-brand-50 ring-1 ring-inset ring-brand-300" : ""}`}
                    >
                      <Stamp turn={it.turn} how={it.how} />
                      <span className="text-ink">{it.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {tab === "results" && (
          <div className="space-y-4">
            <form onSubmit={submitOrder} className="rounded-xl border border-line bg-surface-2 p-3.5">
              <label htmlFor="order-input" className="mb-1.5 block text-[13px] font-semibold text-ink-2">
                Request an exam, test or record
              </label>
              <div className="flex gap-2">
                <input
                  id="order-input"
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                  disabled={locked || ordering}
                  placeholder="e.g. home blood pressure reading, lipid panel, guided abdominal exam, pharmacy refill history"
                  className="min-h-10 min-w-0 flex-1 rounded-lg border border-line-strong/60 bg-surface px-3 text-[13.5px] text-ink placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/20 disabled:bg-slate-50"
                />
                <button disabled={locked || ordering || !order.trim()} className="press inline-flex min-h-10 items-center rounded-lg bg-ink px-3.5 text-[13.5px] font-medium text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-500">
                  {ordering ? "Sending" : "Request"}
                </button>
              </div>
              <p className="mt-2 text-[12px] text-ink-3">Only results approved for this case can come back. Exams are guided over video.</p>
            </form>
            {chart.results.length === 0 && chart.unmatched.length === 0 && <p className="text-[13.5px] text-ink-3">No results yet.</p>}
            <ul className="space-y-2">
              {chart.results.map((r, i) => (
                <li key={r.id} style={{ "--i": i } as React.CSSProperties} className={`rounded-xl border p-3.5 ${r.abnormal ? "border-amber-300 bg-amber-50/60" : "border-line"} ${fresh.has(r.id) ? "flash-new" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold text-ink">{r.name}</span>
                    <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
                      {r.abnormal && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                          Abnormal
                        </span>
                      )}
                      {KIND_LABEL[r.kind] || r.kind}
                      <Stamp turn={r.turn} />
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{r.result}</p>
                </li>
              ))}
              {chart.unmatched.map((u, i) => (
                <li key={"u" + i} className="rounded-xl border border-dashed border-slate-300 p-3.5 text-[13.5px] text-ink-2">
                  <span className="font-medium text-ink">{u.request}</span>: no approved result is available for this in the case file.
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "documents" && (
          <div className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
            <ul className="space-y-1.5">
              {chart.artifacts.length === 0 && <li className="text-[13.5px] text-ink-3">No documents in the chart yet.</li>}
              {chart.artifacts.map((d) => (
                <li key={d.id}>
                  <button
                    onClick={() => setDocId(d.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${doc?.id === d.id ? "border-brand-500 bg-brand-50" : "border-line hover:bg-slate-50"} ${fresh.has(d.id) ? "flash-new" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11.5px] font-medium text-ink-3">
                      {artifactTypeLabel(d.type)}
                      {d.turn > 0 && <span className="rounded bg-brand-100 px-1 font-mono text-[11px] text-brand-800">new · T{d.turn}</span>}
                    </div>
                    <div className="text-[13.5px] font-medium leading-snug text-ink">{d.title}</div>
                    {d.date && <div className="text-[12px] text-ink-3">{d.date}</div>}
                  </button>
                </li>
              ))}
            </ul>
            <div className="min-w-0">{doc && <ArtifactView artifact={doc} />}</div>
          </div>
        )}

        {tab === "activity" && (
          <div>
            <p className="mb-3 text-[12.5px] text-ink-3">Everything released to you in this visit, in order. This is the disclosure ledger.</p>
            {chart.log.length === 0 && <p className="text-[13.5px] text-ink-3">Nothing yet.</p>}
            <ol className="relative space-y-1.5 border-l border-line pl-4">
              {chart.log.map((l, i) => (
                <li key={i} className="relative flex items-start gap-2.5 text-[13.5px]">
                  <span className={`absolute -left-[21px] top-2 h-2 w-2 rounded-full ring-2 ring-surface ${l.kind === "fact" ? "bg-brand-500" : l.kind === "result" ? "bg-amber-500" : "bg-violet-500"}`} aria-hidden />
                  <Stamp turn={l.turn} />
                  <span className={`mt-0.5 w-[4.5rem] shrink-0 text-[12px] font-semibold ${l.kind === "fact" ? "text-brand-700" : l.kind === "result" ? "text-amber-800" : "text-violet-700"}`}>{l.kind === "fact" ? "History" : l.kind === "result" ? "Result" : "Document"}</span>
                  <span className="text-ink">{l.text}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {tab === "team" && teamTab}
      </div>
    </section>
  );
}
