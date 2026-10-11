"use client";

import { Check, FileText, Link2, ListTree, Stethoscope, UserRound, Users } from "lucide-react";
import { cx } from "@/components/ui";

// The staged case generator (lib/casegen.ts generateStaged): an outline fixes the clinical story and
// every number, four writers fill in the parts in parallel from it, and a last call links objectives
// and mismatches to what now exists. The server answers once, when the draft is saved, so progress
// here is an estimate from typical timings and is labelled as such.
const OUTLINE_END = 16;
const WRITERS_END = 62;
const LINK_END = 78;

type State = "done" | "active" | "todo" | "failed";

function stateOf(start: number, end: number, t: number, saved: boolean, failed: boolean): State {
  if (saved) return "done";
  if (t >= end) return failed ? "done" : "done";
  if (t >= start) return failed ? "failed" : "active";
  return "todo";
}

function Node({ state, title, detail, Icon, className }: { state: State; title: string; detail?: string; Icon: typeof Check; className?: string }) {
  return (
    <div
      className={cx(
        "relative flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors duration-300",
        state === "done" && "border-brand-200 bg-brand-50",
        state === "active" && "border-brand-400 bg-surface shadow-e2",
        state === "todo" && "border-line bg-surface-2/60",
        state === "failed" && "border-rose-200 bg-rose-50",
        className,
      )}
    >
      <span className={cx("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full", state === "done" ? "bg-brand-600 text-white" : state === "active" ? "bg-brand-100 text-brand-700" : state === "failed" ? "bg-rose-100 text-rose-700" : "bg-slate-200/70 text-slate-500")}>
        {state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Icon className={cx("h-3.5 w-3.5", state === "active" && "animate-pulse")} aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className={cx("block text-[13.5px] font-semibold leading-snug", state === "todo" ? "text-ink-3" : "text-ink")}>{title}</span>
        {detail && <span className="mt-0.5 block text-[12px] leading-snug text-ink-3">{detail}</span>}
      </span>
    </div>
  );
}

export default function GeneratorPipeline({ elapsed, saved, failed, counts }: { elapsed: number; saved: boolean; failed: boolean; counts?: { facts: number; actions: number; artifacts: number; objectives: number } }) {
  const t = elapsed;
  // While the server is still working, nothing is shown as finished past the last stage.
  const cap = (s: State) => (!saved && s === "done" && t >= LINK_END ? "active" : s);
  const outline = stateOf(0, OUTLINE_END, t, saved, failed);
  const writers = stateOf(OUTLINE_END, WRITERS_END, t, saved, failed);
  const linking = cap(stateOf(WRITERS_END, LINK_END, t, saved, failed));
  const pct = saved ? 100 : Math.min(96, (t / 80) * 100);
  const writerList: [string, string, typeof Check][] = [
    ["Persona, scenario and answer key", "Who the patient is, what the learner is told", UserRound],
    ["Medical history", "Presenting complaint, history, medications, allergies", Stethoscope],
    ["Personal history", "Family, social, function, goals, adherence", Users],
    ["Chart, exams and documents", "Results fixed in advance, lab tables, trends", FileText],
  ];
  return (
    <div>
      <div className="grid items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1.45fr)_1.25rem_minmax(0,1fr)]">
        <Node state={outline} title="Outline" detail="Fixes the clinical story and every number once: timeline, doses, vitals, lab values" Icon={ListTree} className="md:self-center" />
        <div className="hidden items-center md:flex" aria-hidden>
          <span className={cx("h-0.5 w-full rounded-full", outline === "done" ? "bg-brand-400" : "bg-line")} />
        </div>
        <div className="space-y-2">
          <div className="text-[12px] font-semibold text-ink-3">Four writers in parallel, each copying from the outline</div>
          {writerList.map(([title, detail, Icon]) => (
            <Node key={title} state={writers} title={title} detail={detail} Icon={Icon} />
          ))}
        </div>
        <div className="hidden items-center md:flex" aria-hidden>
          <span className={cx("h-0.5 w-full rounded-full", writers === "done" ? "bg-brand-400" : "bg-line")} />
        </div>
        <div className="space-y-2 md:self-center">
          <Node state={linking} title="Linking" detail="Learning objectives and patient-versus-chart mismatches, tied to the facts and orders that now exist" Icon={Link2} />
          <Node state={saved ? "done" : "todo"} title="Saved as a draft" detail={saved && counts ? `${counts.facts} facts, ${counts.actions} exams and orders, ${counts.artifacts} documents, ${counts.objectives} objectives` : "Ids and links checked, then the editor opens"} Icon={Check} />
        </div>
      </div>
      <div className="mt-6">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Estimated drafting progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <div className={cx("h-full origin-left rounded-full transition-transform duration-1000 ease-linear", failed ? "bg-rose-500" : "bg-brand-500")} style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
        <p className="mt-2 flex flex-wrap justify-between gap-2 text-[12px] text-ink-3">
          <span>Stages are estimated from typical timings (about 80 seconds in all). The server reports back once, when the whole draft is saved.</span>
          <span className="font-mono tabular-nums">
            {Math.floor(t / 60)}:{String(t % 60).padStart(2, "0")}
          </span>
        </p>
      </div>
    </div>
  );
}
