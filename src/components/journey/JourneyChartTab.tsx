"use client";

import { useCallback, useState } from "react";
import ConsultPanel from "./ConsultPanel";
import { cx } from "@/components/ui";
import { EntryRow, ProvenancePanel, SbarCard, Spinner, StatusIcon, useRun } from "./shared";
import { STATUS_LABEL, statusBoard, type EntryStatus } from "@/lib/journey/types";

const OPEN: EntryStatus[] = ["disputed", "open_question", "uncertain"];

/**
 * The "Care team" tab of the visit chart: the handoff the learner received, the shared patient
 * state so far with provenance on every line, and a panel to page a colleague.
 */
export default function JourneyChartTab({ runId, encounterId }: { runId: string; encounterId: string }) {
  // This tab makes one request when it opens and one after each message the learner sends. It does not poll.
  const { view, error, refresh: reload } = useRun(runId, { opened: encounterId });
  const refresh = useCallback(() => reload(true), [reload]);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open">("all");
  if (error) return <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200">{error}</p>;
  if (!view) return <Spinner label="Loading the care team's record" />;

  const mine = view.stages.find((s) => s.encounterId === encounterId) || view.stages.find((s) => s.isStudent);
  const order = mine?.stage.order ?? 99;
  const received = mine ? view.handoffs.filter((h) => h.toStage === mine.stage.id).pop() : undefined;
  const prior = view.entries.filter((e) => e.stageOrder < order || (e.stageId === mine?.stage.id && (e.kind === "consult" || e.kind === "callout")));
  // Same status rules as the hub and the final view.
  const sb = statusBoard(prior, view.links);
  const openIds = new Set(OPEN.flatMap((k) => sb.groups[k]).map((e) => e.id));
  const shown = filter === "open" ? prior.filter((e) => openIds.has(e.id)) : prior;
  const groups = [
    { key: "record", title: "Existing record", sub: "Before this journey" },
    ...view.stages.filter((s) => s.stage.order <= order).map((s) => ({ key: s.stage.id, title: `Encounter ${s.stage.order}: ${s.stage.roleTitle}`, sub: `${s.clinicianName} · ${s.stage.simTime}` })),
  ];
  const openCount = sb.unresolved;

  return (
    <div className="space-y-5 text-sm">
      {mine && (
        <p className="rounded-xl bg-[var(--color-mastery-soft)] px-3 py-2 text-xs font-semibold text-ink-2">
          You are the {mine.stage.roleTitle.toLowerCase()} in encounter {mine.stage.order} of {view.stages.length}. Every encounter in this journey is a telehealth visit with the patient at home.
        </p>
      )}
      <section>
        <h3 className="mb-2 font-display text-[14px] font-extrabold tracking-[-0.01em] text-ink">Handoff you received</h3>
        {received ? <SbarCard handoff={received} /> : <p className="rounded-xl border-2 border-dashed border-brand-200 px-3 py-2 text-ink-3">You are the first professional to see this patient in this journey, so there is no handoff. Start from the existing record.</p>}
      </section>

      <section>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-[14px] font-extrabold tracking-[-0.01em] text-ink">Shared patient state so far</h3>
          <div className="flex gap-1 rounded-full bg-surface-2 p-1 text-xs ring-1 ring-inset ring-line" role="group" aria-label="Filter the shared state">
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={cx("press min-h-8 rounded-full px-2.5 font-bold pointer-coarse:min-h-11", filter === "all" ? "bg-ink text-white" : "text-ink-2 hover:text-ink")}>All ({prior.length})</button>
            <button type="button" aria-pressed={filter === "open"} onClick={() => setFilter("open")} className={cx("press min-h-8 rounded-full px-2.5 font-bold pointer-coarse:min-h-11", filter === "open" ? "bg-[var(--color-flame-2)] text-ink" : "text-ink-2 hover:text-ink")}>Uncertain or unresolved ({openCount})</button>
          </div>
        </div>
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">
          {(Object.keys(STATUS_LABEL) as EntryStatus[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1"><StatusIcon status={s} className="h-3 w-3" />{STATUS_LABEL[s]}</span>
          ))}
        </div>
        <div className="space-y-3">
          {groups.map((g) => {
            const items = shown.filter((e) => e.stageId === g.key);
            if (!items.length) return null;
            return (
              <div key={g.key} className="rounded-2xl bg-surface ring-1 ring-inset ring-line">
                <div className="rounded-t-2xl bg-surface-2/70 px-3 py-2">
                  <div className="text-[12.5px] font-extrabold text-ink">{g.title} <span className="font-mono text-ink-3">{items.length}</span></div>
                  <div className="text-[11px] text-ink-3">{g.sub}</div>
                </div>
                <div className="p-1">{items.map((e) => <EntryRow key={e.id} entry={e} onOpen={setOpen} showWho={false} dense />)}</div>
              </div>
            );
          })}
          {!shown.length && <p className="text-ink-3">Nothing here yet.</p>}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-3">Select any line to see who recorded it, when, and the words it rests on.</p>
      </section>

      <section>
        <h3 className="mb-2 font-display text-[14px] font-extrabold tracking-[-0.01em] text-ink">Page a colleague</h3>
        <ConsultPanel view={view} refresh={refresh} compact />
      </section>
      {open && <ProvenancePanel view={view} entryId={open} onOpen={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}
