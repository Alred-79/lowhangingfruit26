"use client";

import { Check, Flag, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { usePrefersReducedMotion } from "@/components/motion";
import type { RunView } from "@/lib/journey/types";
import { STATUS_COLOR, STATUS_ORDER, v } from "./shared";

export type StopState = "done" | "now" | "todo" | "error";
export interface Stop {
  key: string;
  kind: "stage" | "huddle" | "final";
  order: number;
  title: string;
  who: string;
  when: string;
  state: StopState;
  you: boolean;
  entryIds: string[];
  note: string;
}

/** The stops of a run, in order: every encounter, then the huddle, then the integrated view. Same states as the old step list. */
export function stopsOf(view: RunView): Stop[] {
  const n = view.next;
  const stages = [...view.stages].sort((a, b) => a.stage.order - b.stage.order);
  const out: Stop[] = stages.map((s) => ({
    key: s.stage.id,
    kind: "stage",
    order: s.stage.order,
    title: s.stage.roleTitle,
    who: s.isStudent ? (view.viewerIsOwner ? "You" : view.studentName) : `${s.clinicianName} (AI)`,
    when: s.stage.simTime,
    state: s.status === "complete" ? "done" : s.status === "error" ? "error" : s.status === "pending" ? "todo" : "now",
    you: s.isStudent,
    entryIds: view.entries.filter((e) => e.stageId === s.stage.id).map((e) => e.id),
    note: s.isStudent ? (view.viewerIsOwner ? "Your encounter" : "Learner") : "AI colleague",
  }));
  const h = view.huddle;
  out.push({
    key: "huddle",
    kind: "huddle",
    order: stages.length + 1,
    title: "Team huddle",
    who: "Reconcile what is still open",
    when: h ? `${h.items.length} on the agenda · ${h.items.filter((i) => i.outcome).length} discussed` : "Opens after the last encounter",
    state: view.huddle?.status === "closed" ? "done" : n.kind === "huddle" ? "now" : "todo",
    you: false,
    entryIds: view.entries.filter((e) => e.stageId === "huddle").map((e) => e.id),
    note: "Whole team",
  });
  out.push({
    key: "final",
    kind: "final",
    order: stages.length + 2,
    title: "Integrated patient view",
    who: "Care plan and provenance",
    when: view.synthesis ? `${view.synthesis.problems.reduce((k, p) => k + p.items.length, 0)} plan actions` : "Written when the huddle closes",
    state: view.status === "complete" ? "done" : "todo",
    you: false,
    entryIds: [],
    note: "Finish",
  });
  return out;
}

const NODE = 56;
const NODE_YOU = 68;
const ROW = 132;
const ys = [40, 92];

function MiniStack({ ids, view }: { ids: string[]; view: RunView }) {
  if (!ids.length) return null;
  const set = new Set(ids);
  const counts = STATUS_ORDER.map((s) => ({ s, n: 0 }));
  for (const e of view.entries) if (set.has(e.id)) counts[STATUS_ORDER.indexOf(e.effectiveStatus)].n++;
  return (
    <span className="mt-1.5 flex h-1.5 w-full max-w-[7.5rem] gap-[2px] overflow-hidden rounded-full" aria-hidden>
      {counts.filter((c) => c.n).map((c, i) => (
        <span key={c.s} className="jr-seg h-full rounded-[2px]" style={v({ flexGrow: c.n, flexBasis: 0, background: STATUS_COLOR[c.s], "--i": i })} />
      ))}
    </span>
  );
}

function NodeFace({ stop, size }: { stop: Stop; size: number }) {
  const Icon = stop.kind === "huddle" ? Users : stop.kind === "final" ? Flag : null;
  return (
    <span
      className={cx(
        "jr-node relative grid place-items-center rounded-full font-display font-black clay",
        stop.state === "done" && "bg-[var(--color-xp)] text-ink",
        stop.state === "now" && "bg-brand-600 text-white",
        stop.state === "todo" && "border-[3px] border-dashed border-brand-200 bg-surface text-ink-3",
        stop.state === "error" && "bg-rose-600 text-white",
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {stop.you && <span className="jr-halo" aria-hidden />}
      {stop.state === "now" && <span className="jr-pulse" aria-hidden />}
      {stop.state === "done" ? <Check className="h-[45%] w-[45%]" strokeWidth={3.2} aria-hidden /> : stop.state === "error" ? "!" : Icon ? <Icon className="h-[42%] w-[42%]" strokeWidth={2.4} aria-hidden /> : stop.order}
    </span>
  );
}

function YouFlag({ stop }: { stop: Stop }) {
  if (!stop.you) return null;
  return <span className="absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-[var(--color-mastery)] px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-white clay">{stop.note === "Your encounter" ? "You" : "Learner"}</span>;
}

function label(stop: Stop) {
  const st = { done: "done", now: "now", todo: "not yet", error: "stopped with an error" }[stop.state];
  return `${stop.kind === "stage" ? `Encounter ${stop.order}: ` : ""}${stop.title}, ${stop.who}, ${st}${stop.you ? ", the learner's own encounter" : ""}`;
}

/**
 * The care journey as a level path: each encounter is a node on a winding trail, then the huddle and
 * the integrated view as the last two stops. Done nodes are lime with a check, the current one pulses,
 * the learner's own node wears a violet halo and a flag. The trail draws itself up to the current
 * node and a spark travels along it; the rest of the trail is a slowly marching dashed line.
 * Every node is a button (Tab, or Left/Right arrows between nodes); selecting one opens that step.
 */
export default function LevelPath({ view, current, onPick, lit }: { view: RunView; current: string; onPick: (key: string) => void; lit?: string[] | null }) {
  const stops = stopsOf(view);
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(1000);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const litSet = lit ? new Set(lit) : null;
  const n = stops.length;
  const pts = stops.map((_, i) => ({ x: ((i + 0.5) / n) * w, y: ys[i % 2] }));
  const seg = (a: number, b: number) => {
    let d = `M${pts[a].x.toFixed(1)},${pts[a].y}`;
    for (let i = a + 1; i <= b; i++) {
      const p = pts[i - 1];
      const q = pts[i];
      const dx = (q.x - p.x) / 2;
      d += ` C${(p.x + dx).toFixed(1)},${p.y} ${(q.x - dx).toFixed(1)},${q.y} ${q.x.toFixed(1)},${q.y}`;
    }
    return d;
  };
  // The trail is solid up to the first stop that is not done.
  const firstOpen = stops.findIndex((s) => s.state !== "done");
  const frontier = firstOpen === -1 ? n - 1 : firstOpen;
  const doneD = frontier > 0 ? seg(0, frontier) : "";
  const todoD = frontier < n - 1 ? seg(frontier, n - 1) : "";
  const done = stops.filter((s) => s.state === "done").length;

  const keyNav = (ev: React.KeyboardEvent<HTMLElement>) => {
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft" && ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
    const list = [...(ev.currentTarget.closest("[data-path]")?.querySelectorAll<HTMLButtonElement>("button[data-stop]") || [])];
    const i = list.indexOf(ev.target as HTMLButtonElement);
    if (i < 0) return;
    ev.preventDefault();
    list[(i + (ev.key === "ArrowRight" || ev.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
  };

  return (
    <nav aria-label={`Encounters: ${done} of ${n} stops done`} data-path onKeyDown={keyNav}>
      {/* Wide: a winding trail with the stops along it. */}
      <div ref={wrap} className="relative mt-5 hidden sm:block" style={{ height: ROW + 70 }}>
        <svg className="pointer-events-none absolute inset-x-0 top-0" width={w} height={ROW} viewBox={`0 0 ${w} ${ROW}`} aria-hidden>
          <path d={seg(0, n - 1)} fill="none" stroke="var(--color-brand-100)" strokeWidth={14} strokeLinecap="round" />
          {todoD && <path d={todoD} fill="none" stroke="var(--color-brand-300)" strokeWidth={3} strokeLinecap="round" className="jr-trail-todo" />}
          {doneD && (
            <>
              <path d={doneD} fill="none" stroke="var(--color-xp)" strokeWidth={8} strokeLinecap="round" pathLength={1} className="jr-trail-done" />
              {!reduced && (
                <circle r={5} fill="var(--color-surface)" stroke="var(--color-brand-600)" strokeWidth={2.5} className="jr-spark-svg">
                  <animateMotion dur="3.4s" repeatCount="indefinite" path={doneD} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.77 0 0.175 1" />
                </circle>
              )}
            </>
          )}
        </svg>
        <ol className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {stops.map((s, i) => {
            const size = s.you ? NODE_YOU : NODE;
            const glow = !!litSet && s.entryIds.some((id) => litSet.has(id));
            return (
              <li key={s.key} className="relative flex justify-center">
                <button
                  type="button"
                  data-stop
                  onClick={() => onPick(s.key)}
                  aria-current={current === s.key ? "step" : undefined}
                  aria-label={label(s)}
                  className="jr-stop rise group absolute flex w-full flex-col items-center rounded-2xl px-1 text-center outline-offset-4"
                  style={v({ top: ys[i % 2] - size / 2, "--i": i })}
                >
                  <span className={cx("relative rounded-full jr-lit", glow && "jr-glow")}>
                    <YouFlag stop={s} />
                    <NodeFace stop={s} size={size} />
                  </span>
                  <span className={cx("mt-2 line-clamp-2 max-w-[11rem] font-display text-[13.5px] font-extrabold leading-tight tracking-[-0.01em]", s.state === "todo" ? "text-ink-2" : "text-ink")}>{s.title}</span>
                  <span className={cx("mt-0.5 max-w-[11rem] truncate text-[11.5px]", s.you ? "font-bold text-[var(--color-mastery-ink)]" : "text-ink-3")}>{s.who}</span>
                  {s.kind === "stage" && s.entryIds.length > 0 && <span className="mt-0.5 font-mono text-[11px] font-semibold text-ink-2">+{s.entryIds.length} entries</span>}
                  {s.kind !== "stage" && <span className="mt-0.5 max-w-[11rem] text-[11px] text-ink-3">{s.when}</span>}
                  <MiniStack ids={s.entryIds} view={view} />
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Phone: the same trail, vertical. */}
      <ol className="space-y-0 sm:hidden">
        {stops.map((s, i) => {
          const glow = !!litSet && s.entryIds.some((id) => litSet.has(id));
          const next = stops[i + 1];
          return (
            <li key={s.key} className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 pb-3">
              {next && <span className={cx("absolute left-[27px] top-12 bottom-0 w-[5px] rounded-full", s.state === "done" ? "bg-[var(--color-xp)]" : "bg-brand-100")} aria-hidden />}
              <button type="button" data-stop onClick={() => onPick(s.key)} aria-current={current === s.key ? "step" : undefined} aria-label={label(s)} className="jr-stop col-span-2 grid min-h-14 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-2xl text-left">
                <span className={cx("relative grid place-items-center rounded-full jr-lit", glow && "jr-glow")}>
                  <NodeFace stop={s} size={s.you ? 52 : 46} />
                </span>
                <span className={cx("min-w-0 rounded-2xl px-3 py-2", current === s.key ? "bg-surface shadow-e1 ring-2 ring-brand-500" : "")}>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-display text-[14.5px] font-extrabold leading-tight text-ink">{s.title}</span>
                    {s.you && <span className="rounded-full bg-[var(--color-mastery)] px-1.5 py-px text-[10px] font-extrabold uppercase tracking-[0.06em] text-white">{s.note === "Your encounter" ? "You" : "Learner"}</span>}
                  </span>
                  <span className="block truncate text-[12px] text-ink-3">{s.who} · {s.kind === "stage" ? `${s.when}${s.entryIds.length ? ` · +${s.entryIds.length} entries` : ""}` : s.when}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
