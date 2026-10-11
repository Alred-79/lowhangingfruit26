"use client";

import { DoorOpen, Lock, Sparkles } from "lucide-react";
import "./visit.css";
import { cx } from "@/components/ui";

// The visit's game HUD: the patient's comfort as a gauge that springs every turn, a combo for
// consecutive turns that raised it, comfort over the visit, the four disclosure tiers as doors that
// open when comfort crosses this patient's real gates, and the facts collected so far.
// Everything here is data the student already sees (comfort, its change, the chart ledger) plus the
// visit's two trust thresholds, passed by the page as display-only figures. Nothing hints at what is
// still locked: no counts of hidden facts, ever.

const word = (x: number) => (x >= 60 ? "at ease" : x >= 40 ? "guarded" : "uneasy");

function Gauge({ value }: { value: number }) {
  const angle = -90 + Math.max(0, Math.min(100, value)) * 1.8;
  const arc = (from: number, to: number) => {
    const p = (t: number) => {
      const a = Math.PI * (1 - t / 100);
      return `${(50 + Math.cos(a) * 40).toFixed(2)} ${(50 - Math.sin(a) * 40).toFixed(2)}`;
    };
    return `M ${p(from)} A 40 40 0 0 1 ${p(to)}`;
  };
  return (
    <svg viewBox="0 0 100 58" className="h-[46px] w-[80px] shrink-0" aria-hidden>
      <path d={arc(0, 39)} stroke="var(--color-tier-hidden)" strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d={arc(41, 59)} stroke="var(--color-flame-2)" strokeWidth="9" fill="none" />
      <path d={arc(61, 100)} stroke="var(--color-tier-initial)" strokeWidth="9" fill="none" strokeLinecap="round" />
      <g className="trust-needle" style={{ transform: `rotate(${angle}deg)` }}>
        <line x1="50" y1="50" x2="50" y2="17" stroke="white" strokeWidth="3.2" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="50" r="5.5" fill="white" />
      <circle cx="50" cy="50" r="2.4" fill="var(--color-stage)" />
    </svg>
  );
}

function Spark({ history, gates }: { history: number[]; gates: { reluctantAt: number; hiddenAt: number } | null }) {
  const pts = history.slice(-24);
  const w = 132;
  const h = 46;
  const x = (i: number) => (pts.length < 2 ? w : (i / (pts.length - 1)) * w);
  const y = (val: number) => h - 3 - (Math.max(0, Math.min(100, val)) / 100) * (h - 6);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1] ?? 0;
  return (
    <svg viewBox={`-4 0 ${w + 8} ${h}`} className="hidden h-[40px] w-[120px] shrink-0 overflow-visible sm:block" role="img" aria-label={`Comfort over the visit: ${pts.join(", ")}`}>
      {gates && (
        <>
          <line x1={0} x2={w} y1={y(gates.reluctantAt)} y2={y(gates.reluctantAt)} stroke="var(--color-tier-reluctant)" strokeOpacity="0.8" strokeWidth="1" />
          <line x1={0} x2={w} y1={y(gates.hiddenAt)} y2={y(gates.hiddenAt)} stroke="var(--color-tier-hidden)" strokeOpacity="0.8" strokeWidth="1" />
        </>
      )}
      {pts.length > 1 && <path d={d} fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
      <circle cx={x(pts.length - 1)} cy={y(last)} r="3.6" fill="var(--color-xp)" className="breathe" style={{ transformOrigin: `${x(pts.length - 1)}px ${y(last)}px` }} />
    </svg>
  );
}

export default function TrustHud({
  rapport,
  delta,
  history,
  gates,
  facts,
  newFacts,
}: {
  rapport: number | null;
  delta: number;
  history: number[];
  gates: { reluctantAt: number; hiddenAt: number } | null;
  facts: number;
  newFacts: number;
}) {
  // Combo: consecutive turns (ending now) that raised comfort.
  let combo = 0;
  for (let i = history.length - 1; i > 0 && history[i] > history[i - 1]; i--) combo++;
  const doors =
    rapport === null || !gates
      ? null
      : [
          { id: "initial", label: "Volunteered", note: "shared freely", open: true, fill: 1 },
          { id: "discoverable", label: "When asked", note: "ask directly", open: true, fill: 1 },
          { id: "reluctant", label: "Needs trust", note: `opens near ${gates.reluctantAt}`, open: rapport >= gates.reluctantAt, fill: Math.min(1, rapport / gates.reluctantAt) },
          { id: "hidden", label: "Guarded", note: `opens near ${gates.hiddenAt}`, open: rapport >= gates.hiddenAt, fill: Math.min(1, rapport / gates.hiddenAt) },
        ];

  return (
    <section aria-label="Trust and disclosure" className="shrink-0 rounded-[22px] bg-white/[0.06] px-3.5 py-2.5 text-white ring-1 ring-white/12 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {rapport !== null ? (
          <div className="flex items-center gap-2.5" title="How comfortable the patient is with you. It rises with empathy, clear purpose and open questions, and falls with judgment, jargon or rushing. Reluctant facts need it. Shown in practice only.">
            <Gauge value={rapport} />
            <div>
              <div className="text-[11px] font-bold text-white/75">Comfort · {word(rapport)}</div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[26px] font-black leading-none tabular" role="meter" aria-label="Patient comfort" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rapport}>
                  {rapport}
                </span>
                {delta !== 0 && (
                  <span key={`${rapport}-${delta}`} className={cx("pop-spring rounded-full px-1.5 font-mono text-[12px] font-bold", delta > 0 ? "bg-[var(--color-xp)] text-ink" : "bg-[var(--color-tier-hidden)] text-white")}>
                    {delta > 0 ? "+" : ""}
                    {delta}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[12.5px] text-white/75">Comfort is hidden in exams.</p>
        )}
        {rapport !== null && history.length > 1 && <Spark history={history} gates={gates} />}
        {rapport !== null && combo >= 2 && (
          <span key={combo} className="pop-spring inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[var(--color-flame-2)] to-[var(--color-flame)] px-2.5 py-1 text-[12.5px] font-black text-ink" title="Consecutive turns that raised the patient's comfort">
            Combo x{combo}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 rounded-2xl bg-[var(--color-xp)] px-3 py-1 text-ink">
          <span className="font-display text-[22px] font-black leading-none tabular">{facts}</span>
          <span className="text-[11px] font-bold leading-tight">
            facts
            <br />
            collected
          </span>
          {newFacts > 0 && (
            <span key={`${facts}-${newFacts}`} className="pop-spring rounded-full bg-ink px-1.5 font-mono text-[11.5px] font-bold text-[var(--color-xp)]">
              +{newFacts}
            </span>
          )}
        </div>
      </div>
      {doors && (
        <ol className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4" aria-label="Disclosure tiers for this patient">
          {doors.map((d, i) => (
            <li key={d.id} className={cx("relative overflow-hidden rounded-xl px-2 py-1 ring-1", d.open ? "bg-white/12 ring-white/20" : "bg-black/25 ring-white/10")} title={d.open ? `${d.label}: open` : `${d.label}: ${d.note}. A respectful second ask or sensitive framing lowers the bar a little.`}>
              <span className="absolute inset-0 origin-left opacity-35" style={{ transform: `scaleX(${d.fill.toFixed(3)})`, background: `var(--color-tier-${d.id})`, transition: "transform 700ms var(--ease-spring)" }} aria-hidden />
              <span className="relative flex items-center gap-1.5 text-[11.5px] font-bold">
                <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md" style={{ background: `var(--color-tier-${d.id})` }}>
                  {d.open ? (i < 2 ? <DoorOpen className="h-3 w-3 text-white" aria-hidden /> : <Sparkles className="h-3 w-3 text-white" aria-hidden />) : <Lock className="h-3 w-3 text-white" aria-hidden />}
                </span>
                <span className="truncate">{d.label}</span>
                <span className="ml-auto shrink-0 font-mono text-[10.5px] font-semibold text-white/75">{d.open ? (i < 2 ? "open" : "open!") : d.note.replace("opens near ", "at ")}</span>
                <span className="sr-only">{d.open ? ", open" : `, locked, ${d.note}`}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
