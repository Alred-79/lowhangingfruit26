"use client";

import { History } from "lucide-react";
import { useState } from "react";
import { cx } from "@/components/ui";
import { STATUS_LABEL, type EntryStatus, type RunView, type StatusBoard as Board } from "@/lib/journey/types";
import { EntryRow, STATUS_COLOR, STATUS_ORDER, StatusIcon, stageLabel, statusSoft, v } from "./shared";

export interface StatePoint {
  order: number;
  label: string;
  sub: string;
}

/** The board's six groups, in reading order, with the wording the status board has always used. */
export const BOARD: { key: string; status: EntryStatus; title: string; hint: string }[] = [
  { key: "est", status: "established", title: "Established", hint: "On the record, from an exam or test, or stated firmly by a clinician" },
  { key: "pr", status: "patient_reported", title: "Patient-reported", hint: "What the patient said; not independently verified" },
  { key: "unc", status: "uncertain", title: "Uncertain", hint: "Provisional judgements and unverified points" },
  { key: "dis", status: "disputed", title: "Disputed", hint: "Two accounts of the same thing that cannot both be right" },
  { key: "open", status: "open_question", title: "Still unanswered", hint: "Questions nobody on the team can answer yet; a plan to find out does not close one" },
  { key: "res", status: "resolved", title: "Resolved", hint: "Answered or settled by a later entry that supplies the information" },
];

/** One 100% bar of the status mix, 2 px gaps between segments, counts as text in the legend. */
export function StatusMix({ counts, total, className }: { counts: Record<EntryStatus, number>; total: number; className?: string }) {
  return (
    <div className={className}>
      <div className="flex h-3.5 gap-[2px] overflow-hidden rounded-full bg-surface-2" role="img" aria-label={STATUS_ORDER.filter((s) => counts[s]).map((s) => `${counts[s]} ${STATUS_LABEL[s].toLowerCase()}`).join(", ") || "No entries yet"}>
        {total > 0 &&
          STATUS_ORDER.filter((s) => counts[s]).map((s, i) => <span key={s} className="jr-seg h-full first:rounded-l-full last:rounded-r-full" style={v({ flexGrow: counts[s], flexBasis: 0, background: STATUS_COLOR[s], "--i": i })} title={`${counts[s]} ${STATUS_LABEL[s]}`} />)}
      </div>
    </div>
  );
}

/**
 * The status board as six tiles (icon + label + count + share bar) that double as filter chips, and a
 * scrubber that rewinds the whole board to how it stood after any point in the journey. "Now" is the
 * live board, computed exactly as before (statusBoard with no cut-off).
 */
export default function StatusBoardPanel({ view, onOpen, points, at, setAt, board }: { view: RunView; onOpen: (id: string) => void; points: StatePoint[]; at: number; setAt: (i: number) => void; board: Board }) {
  const [pick, setPick] = useState<string>(() => (board.unresolved ? (board.counts.disputed ? "dis" : board.counts.open_question ? "open" : "unc") : "est"));
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const now = at >= points.length - 1;
  const g = BOARD.find((b) => b.key === pick) || BOARD[0];
  const items = board.groups[g.status];
  const expanded = showAll[g.key];
  const max = Math.max(1, ...BOARD.map((b) => board.counts[b.status]));
  return (
    <div className="space-y-4">
      {points.length > 1 && (
        <div className="rounded-2xl bg-surface-2 p-3.5 ring-1 ring-inset ring-line">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="jr-rewind" className="inline-flex items-center gap-2 font-display text-[14px] font-extrabold text-ink">
              <History className="h-4 w-4 text-brand-600" aria-hidden />
              Rewind the shared state
            </label>
            <span className={cx("rounded-full px-2.5 py-0.5 text-[12px] font-bold", now ? "bg-[var(--color-xp)] text-ink" : "bg-brand-600 text-white")} aria-live="polite">
              {now ? "Now" : `${points[at].label} · ${points[at].sub}`}
            </span>
          </div>
          <input id="jr-rewind" type="range" min={0} max={points.length - 1} step={1} value={at} onChange={(e) => setAt(Number(e.target.value))} aria-valuetext={now ? "Now, the live board" : `${points[at].label}, ${points[at].sub}`} className="mt-3 w-full cursor-pointer accent-[var(--color-brand-600)] pointer-coarse:h-11" />
          <div className="relative mt-1 h-9 text-[11px] font-semibold text-ink-3">
            {points.map((p, i) => {
              const pct = (i / (points.length - 1)) * 100;
              return (
                <button key={p.order} type="button" onClick={() => setAt(i)} className={cx("absolute top-0 min-h-9 whitespace-nowrap rounded-md px-1 hover:text-ink", i === at && "text-brand-700")} style={{ left: `${pct}%`, transform: `translateX(${i === 0 ? "0" : i === points.length - 1 ? "-100%" : "-50%"})` }}>
                  {i === points.length - 1 ? "Now" : i === 0 ? "Record" : p.label.replace("After encounter ", "Enc. ").replace("After the team huddle", "Huddle")}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div role="group" aria-label="Status groups" className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        {BOARD.map((b, i) => {
          const n = board.counts[b.status];
          const on = b.key === pick;
          return (
            <button
              key={b.key}
              type="button"
              aria-pressed={on}
              onClick={() => setPick(b.key)}
              className={cx("press rise relative flex flex-col items-start overflow-hidden rounded-[18px] p-3 text-left transition-shadow", on ? "shadow-e2 ring-[3px] ring-ink" : "ring-1 ring-inset ring-black/5 hover:shadow-e1")}
              style={v({ background: statusSoft(b.status, on ? 24 : 14), "--i": i })}
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-surface clay">
                <StatusIcon status={b.status} className="h-4 w-4" />
              </span>
              <span key={`${b.key}-${n}`} className="pop-spring mt-2 font-display text-[34px] font-black leading-none tracking-[-0.04em] text-ink tabular">{n}</span>
              <span className="mt-1 text-[13px] font-extrabold leading-tight text-ink">{b.title}</span>
              <span className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/70" aria-hidden>
                <span className="block h-full origin-left rounded-full transition-transform duration-300 ease-[var(--ease-out-ui)]" style={{ transform: `scaleX(${n / max})`, background: STATUS_COLOR[b.status] }} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl ring-1 ring-inset ring-line">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line/70 px-4 py-3" style={{ background: statusSoft(g.status, 9) }}>
          <div>
            <h3 className="inline-flex items-center gap-2 font-display text-[15px] font-extrabold text-ink">
              <StatusIcon status={g.status} className="h-4 w-4" />
              {g.title}
              <span className="font-mono text-[13px] text-ink-2">{items.length}</span>
            </h3>
            <p className="mt-0.5 text-[12.5px] text-ink-3">{g.hint}</p>
          </div>
          {!now && <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-[11.5px] font-bold text-white">As it stood {points[at].label.toLowerCase()}</span>}
        </div>
        <div className="p-1.5">
          {items.slice(0, expanded ? 200 : 5).map((e) => (
            <div key={e.id}>
              <EntryRow entry={e} onOpen={onOpen} dense />
              <div className="-mt-0.5 pb-1 pl-[38px] text-[11.5px] text-ink-3">{stageLabel(view, e)}</div>
            </div>
          ))}
          {!items.length && <p className="px-3 py-3 text-[13px] text-ink-3">None.</p>}
          {items.length > 5 && (
            <button onClick={() => setShowAll((s) => ({ ...s, [g.key]: !expanded }))} className="press m-1 min-h-9 rounded-full bg-brand-50 px-3 text-xs font-bold text-brand-800 ring-1 ring-inset ring-brand-200 hover:bg-brand-100 pointer-coarse:min-h-11">
              {expanded ? "Show fewer" : `Show all ${items.length}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
