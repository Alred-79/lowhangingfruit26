"use client";

import { Check, FileText, Link2, ListTree, Save, Stethoscope, UserRound, Users, X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/components/ui";
import "./studio.css";

// The staged case generator (lib/casegen.ts generateStaged): an outline fixes the clinical story and
// every number, four writers fill in the parts in parallel from it, and a last call links objectives
// and mismatches to what now exists. The server answers once, when the draft is saved, so progress
// here is an estimate from typical timings and is labelled as such. Nothing is ever shown as saved
// until the server has actually saved it.
const OUTLINE_END = 16;
const WRITERS_END = 62;
const LINK_END = 78;
const TYPICAL = 80;

type State = "done" | "active" | "todo" | "failed";
const v = (o: Record<string, string | number>) => o as CSSProperties;

function stateOf(start: number, end: number, t: number, saved: boolean, failed: boolean): State {
  if (saved) return "done";
  if (t >= end) return "done";
  if (t >= start) return failed ? "failed" : "active";
  return "todo";
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const STATE_TEXT: Record<State, string> = { done: "done (estimated)", active: "working", todo: "waiting", failed: "stopped here" };

function StageIcon({ state, Icon, ping }: { state: State; Icon: typeof Check; ping?: boolean }) {
  return (
    <span
      className={cx(
        "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-[background-color,color] duration-300",
        state === "done" && "bg-[var(--color-xp)] text-ink",
        state === "active" && cx("bg-brand-500 text-white", ping && "studio-ping"),
        state === "todo" && "bg-white/8 text-white/45 ring-1 ring-inset ring-white/15",
        state === "failed" && "bg-rose-500 text-white",
      )}
    >
      {state === "done" ? <Check className="h-4.5 w-4.5" strokeWidth={2.6} aria-hidden /> : state === "failed" ? <X className="h-4.5 w-4.5" strokeWidth={2.6} aria-hidden /> : <Icon className="h-4.5 w-4.5" aria-hidden />}
    </span>
  );
}

function Working() {
  return (
    <span className="studio-dots inline-flex items-center" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

function Stage({ state, title, detail, Icon, children, className }: { state: State; title: string; detail?: string; Icon: typeof Check; children?: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "relative rounded-[18px] p-3.5 ring-1 ring-inset transition-[background-color,box-shadow] duration-300",
        state === "done" && "bg-white/10 ring-[var(--color-xp)]/45",
        state === "active" && "studio-scan bg-brand-500/20 shadow-[0_0_0_1px_oklch(0.68_0.2_268/0.7),0_18px_40px_-18px_oklch(0.6_0.24_268/0.9)] ring-brand-300/60",
        state === "todo" && "bg-white/[0.04] ring-white/10",
        state === "failed" && "bg-rose-500/15 ring-rose-400/70",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <StageIcon state={state} Icon={Icon} ping />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className={cx("text-[14px] font-bold leading-snug", state === "todo" ? "text-white/60" : "text-white")}>{title}</span>
            <span className={cx("inline-flex items-center gap-1 text-[11.5px] font-bold", state === "done" ? "text-[var(--color-xp)]" : state === "active" ? "text-brand-200" : state === "failed" ? "text-rose-200" : "text-white/45")}>
              {STATE_TEXT[state]}
              {state === "active" && <Working />}
            </span>
          </div>
          {detail && <p className={cx("mt-0.5 text-[12.5px] leading-snug", state === "todo" ? "text-white/45" : "text-white/75")}>{detail}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

/** A connector that flows (moving dashes) while the stage it feeds is working. */
function Wire({ state, vertical = false }: { state: State; vertical?: boolean }) {
  const color = state === "done" ? "var(--color-xp)" : state === "active" ? "oklch(0.79 0.14 268)" : state === "failed" ? "oklch(0.7 0.19 18)" : "oklch(1 0 0 / 0.18)";
  return vertical ? (
    <svg className="mx-auto h-6 w-3 md:hidden" viewBox="0 0 12 24" aria-hidden>
      <line x1="6" y1="0" x2="6" y2="24" stroke={color} strokeWidth="3" strokeLinecap="round" className={state === "active" ? "studio-flow" : undefined} />
    </svg>
  ) : (
    <svg className="hidden h-full w-full md:block" viewBox="0 0 40 200" preserveAspectRatio="none" aria-hidden>
      {[30, 70, 130, 170].map((y) => (
        <path key={y} d={`M0 100 C 20 100, 20 ${y}, 40 ${y}`} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" className={state === "active" ? "studio-flow" : undefined} />
      ))}
    </svg>
  );
}

/** Elapsed time with a ring that fills toward the typical duration (an estimate, said so). */
function Clock({ t, saved, failed }: { t: number; saved: boolean; failed: boolean }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const p = saved ? 1 : Math.min(0.96, t / TYPICAL);
  const over = !saved && !failed && t > TYPICAL;
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-[76px] w-[76px] shrink-0">
        <svg viewBox="0 0 76 76" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="38" cy="38" r={r} fill="none" stroke="oklch(1 0 0 / 0.12)" strokeWidth="7" />
          <circle cx="38" cy="38" r={r} fill="none" stroke={failed ? "oklch(0.7 0.19 18)" : saved ? "var(--color-xp)" : "oklch(0.79 0.14 268)"} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ transition: "stroke-dashoffset 1s linear" }} />
          {!saved && !failed && <circle cx="38" cy="38" r="36.5" fill="none" stroke="oklch(1 0 0 / 0.35)" strokeWidth="1" className="orbit-dash" />}
        </svg>
        <span className="absolute inset-0 grid place-items-center font-mono text-[12px] font-bold text-white/85">{saved ? "100%" : `${Math.round(p * 100)}%`}</span>
      </div>
      <div>
        <div className="font-mono text-[40px] font-bold leading-none tracking-[-0.02em] text-white tabular-nums" aria-label={`${fmt(t)} elapsed`}>
          {fmt(t)}
        </div>
        <div className="mt-1 text-[12px] font-semibold text-white/70">{saved ? "saved" : failed ? "stopped" : over ? "longer than the usual 1:20" : "of about 1:20, estimated"}</div>
      </div>
    </div>
  );
}

export default function GeneratorPipeline({ elapsed, saved, failed, counts }: { elapsed: number; saved: boolean; failed: boolean; counts?: { facts: number; actions: number; artifacts: number; objectives: number } }) {
  const t = elapsed;
  // While the server is still working, nothing is shown as finished past the last stage.
  const cap = (s: State) => (!saved && s === "done" && t >= LINK_END ? (failed ? "failed" : "active") : s);
  const outline = stateOf(0, OUTLINE_END, t, saved, failed);
  const writers = stateOf(OUTLINE_END, WRITERS_END, t, saved, failed);
  const linking = cap(stateOf(WRITERS_END, LINK_END, t, saved, failed));
  const save: State = saved ? "done" : "todo";
  // Each writer's lane fills by the same estimate; they run in parallel, so they share one clock.
  const writerP = saved ? 1 : Math.max(0, Math.min(1, (t - OUTLINE_END) / (WRITERS_END - OUTLINE_END)));
  const writerList: [string, string, typeof Check][] = [
    ["Persona, scenario and answer key", "Who the patient is, what the learner is told", UserRound],
    ["Medical history", "Presenting complaint, history, medications, allergies", Stethoscope],
    ["Personal history", "Family, social, function, goals, adherence", Users],
    ["Chart, exams and documents", "Results fixed in advance, lab tables, trends", FileText],
  ];
  const headline = saved ? "Draft saved" : failed ? "The draft stopped" : outline === "active" ? "Writing the outline" : writers === "active" ? "Four writers at work" : "Linking it together";
  const pct = saved ? 100 : Math.min(96, (t / TYPICAL) * 100);
  return (
    <div className="relative isolate overflow-hidden rounded-[26px] bg-stage p-5 text-white clay sm:p-6">
      {/* Ambient: two slow glows behind the stage. */}
      <div className="studio-glow pointer-events-none absolute -left-24 -top-28 -z-10 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,oklch(0.52_0.26_268/0.7),transparent)]" aria-hidden />
      <div className="studio-glow pointer-events-none absolute -bottom-32 right-0 -z-10 h-96 w-96 rounded-full bg-[radial-gradient(closest-side,oklch(0.6_0.2_200/0.35),transparent)] [animation-delay:-6s]" aria-hidden />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className={cx("inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[12px] font-bold", saved ? "bg-[var(--color-xp)] text-ink" : failed ? "bg-rose-500/25 text-rose-100" : "bg-white/10 text-white")}>
            <span className={cx("h-2 w-2 rounded-full", saved ? "bg-ink" : failed ? "bg-rose-400" : "live-dot bg-[var(--color-xp)]")} aria-hidden />
            {saved ? "Saved to your library" : failed ? "No draft was saved" : "Drafting live"}
          </p>
          <p className="mt-2 font-display text-[clamp(1.6rem,3vw,2.2rem)] font-black leading-[1.02] tracking-[-0.03em]" aria-live="polite">
            {headline}
          </p>
        </div>
        <Clock t={t} saved={saved} failed={failed} />
      </div>

      <div className="mt-6 grid items-stretch gap-0 md:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1.5fr)_2.5rem_minmax(0,1fr)]">
        <div className="md:self-center">
          <Stage state={outline} title="1 · Outline" detail="Fixes the clinical story and every number once: timeline, doses, vitals, lab values" Icon={ListTree} />
        </div>
        <Wire state={writers} vertical />
        <Wire state={writers} />
        <div>
          <p className="mb-2 text-[12px] font-bold text-white/70">2 · Four writers in parallel, each copying from the outline</p>
          <div className="space-y-2">
            {writerList.map(([title, detail, Icon], i) => (
              <div key={title} style={v({ "--sd": `${i * 0.45}s` })} className="rounded-[18px]">
                <Stage state={writers} title={title} detail={detail} Icon={Icon}>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
                    <div className={cx("h-full origin-left rounded-full transition-transform duration-1000 ease-linear", writers === "failed" ? "bg-rose-400" : writers === "done" ? "bg-[var(--color-xp)]" : "bg-brand-300")} style={{ transform: `scaleX(${writerP})` }} />
                  </div>
                </Stage>
              </div>
            ))}
          </div>
        </div>
        <Wire state={linking} vertical />
        <div className="hidden md:block">
          <svg className="h-full w-full" viewBox="0 0 40 200" preserveAspectRatio="none" aria-hidden>
            {[30, 70, 130, 170].map((y) => (
              <path key={y} d={`M0 ${y} C 20 ${y}, 20 100, 40 100`} fill="none" stroke={linking === "done" ? "var(--color-xp)" : linking === "active" ? "oklch(0.79 0.14 268)" : linking === "failed" ? "oklch(0.7 0.19 18)" : "oklch(1 0 0 / 0.18)"} strokeWidth="2.5" vectorEffect="non-scaling-stroke" className={linking === "active" ? "studio-flow" : undefined} />
            ))}
          </svg>
        </div>
        <div className="space-y-2 md:self-center">
          <Stage state={linking} title="3 · Linking" detail="Learning objectives and patient-versus-chart mismatches, tied to the facts and orders that now exist" Icon={Link2} />
          <Wire state={save} vertical />
          <Stage state={save} title="Saved as a draft" detail={saved && counts ? undefined : "Ids and links checked, then the editor opens"} Icon={Save}>
            {saved && counts && (
              <dl className="mt-2 grid grid-cols-2 gap-1.5">
                {(
                  [
                    ["facts", counts.facts],
                    ["exams and orders", counts.actions],
                    ["documents", counts.artifacts],
                    ["objectives", counts.objectives],
                  ] as const
                ).map(([k, n], i) => (
                  <div key={k} className="pop-spring rounded-xl bg-white/10 px-2 py-1.5" style={v({ "--i": i })}>
                    <dd className="font-display text-[20px] font-black leading-none">{n}</dd>
                    <dt className="text-[11px] font-semibold text-white/75">{k}</dt>
                  </div>
                ))}
              </dl>
            )}
          </Stage>
        </div>
      </div>

      <div className="mt-6">
        <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Estimated drafting progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <div className={cx("shimmer h-full origin-left rounded-full transition-transform duration-1000 ease-linear", failed ? "bg-rose-400" : saved ? "bg-[var(--color-xp)]" : "bg-brand-300")} style={{ transform: `scaleX(${pct / 100})` }} />
          {/* Stage boundaries on the estimate. */}
          {[OUTLINE_END, WRITERS_END, LINK_END].map((b) => (
            <span key={b} className="absolute inset-y-0 w-[2px] bg-stage" style={{ left: `${(b / TYPICAL) * 100}%` }} aria-hidden />
          ))}
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-white/70">Stages are estimated from typical timings (about 80 seconds in all). The server reports back once, when the whole draft is saved.</p>
      </div>
    </div>
  );
}
