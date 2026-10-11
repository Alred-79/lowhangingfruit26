"use client";

import { History, Layers, Lightbulb, MessageCircle, RotateCcw, Shuffle, Timer, UserRoundCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import StartVisit from "@/components/courses/StartVisit";
import { useCountUp } from "@/components/motion";
import TrustLabel from "@/components/TrustLabel";
import { cx } from "@/components/ui";
import { feedbackUrl, visitUrl } from "@/lib/courses/settings";
import { knobsForLevel, LEVEL_NAMES } from "@/lib/engine/difficulty";
import { AttemptPips, LevelSteps, Portrait, ScoreRing } from "./bits";
import MoodFace, { MOOD, MOOD_DOT, VAGUE } from "./MoodFace";
import { sentence, type PracticeCase } from "./types";
import "./practice.css";

const v = (o: Record<string, string | number>) => o as CSSProperties;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Every number the level changes, read from the same pure function the engine uses. */
function LevelEffects({ level, timeLimitMin }: { level: number; timeLimitMin?: number }) {
  const k = knobsForLevel(level, timeLimitMin);
  const rows: [string, string][] = [
    ["Starting comfort", `${k.rapportStart} of 100`],
    ["Comfort needed for “needs trust” facts", `${k.reluctantAt}`],
    ["Comfort needed for guarded facts", `${k.hiddenAt}`],
    ["New facts per reply, at most", `${k.factsPerTurn}`],
    ["Volunteers related facts", k.volunteers ? "Yes" : "No"],
    ["Coach hints", k.hints ? "Available" : "Off"],
    ["Time", k.timeLimitMin ? `${k.timeLimitMin} minutes` : "No time limit"],
  ];
  return (
    <dl className="mt-2 divide-y divide-white/10 rounded-2xl bg-white/[0.06] px-3.5 text-[13px]">
      {rows.map(([a, b]) => (
        <div key={a} className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="text-white/75">{a}</dt>
          <dd className={cx("text-right font-semibold text-white", /^\d/.test(b) && "font-mono tabular-nums")}>{b}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One changed knob as a small tile; the value re-mounts on change so it springs once. */
function Knob({ icon, label, value, on = true }: { icon: React.ReactNode; label: string; value: string; on?: boolean }) {
  return (
    <div className={cx("flex items-start gap-2.5 rounded-2xl p-2.5 ring-1 ring-inset transition-colors duration-200", on ? "bg-white/[0.07] ring-white/10" : "bg-transparent ring-white/10")}>
      <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors duration-200", on ? "bg-[var(--color-xp)] text-ink" : "bg-white/10 text-white/70")} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold text-white/70">{label}</p>
        <p key={value} className="practice-tick text-[13.5px] font-bold leading-snug text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

/**
 * The start sheet. Its lower half is one compound control: visit type (start over / follow-up), the
 * "vary the patient" switch, the difficulty slider with a live mood and comfort preview, the XP reward
 * preview, and the Start button. Every part changes what the Start button sends, and shows it.
 * Keyboard: Tab moves through the parts; arrows change the visit type and the level; Space toggles vary.
 */
export default function StartSheet({ c, professionNames, onClose }: { c: PracticeCase; professionNames: Record<string, string>; onClose: () => void }) {
  const [level, setLevel] = useState(c.difficulty);
  const [vary, setVary] = useState(c.attempts > 0);
  const [mode, setMode] = useState<"fresh" | "follow">("fresh");
  const panel = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLInputElement>(null);
  const k = knobsForLevel(level, c.timeLimitMin ?? undefined);
  const follow = c.attempts > 0 && mode === "follow";
  // XP rules from the game layer: 100 for finishing, 40 per level above 1, 25 for a follow-up; plus
  // 5 per fact uncovered (unknown until the visit ends, so it is stated, not added). Never a score.
  const xp = 100 + 40 * (level - 1) + (follow ? 25 : 0);
  const xpShown = Math.round(useCountUp(xp, { duration: 420 }));

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    slider.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const f = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      back?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  const frac = (level - 1) / 4;
  const pct = (n: number) => `${Math.max(0, Math.min(100, n))}%`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="scrim-in absolute inset-0 bg-ink/40" onClick={onClose} />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="sheet-title" className="sheet-in relative flex h-full w-full max-w-[30rem] flex-col overflow-hidden bg-surface shadow-e3">
        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto">
          {/* ---------- Who: the portrait, name and visit ---------- */}
          <div className="relative h-52 shrink-0 overflow-hidden bg-stage sm:h-60">
            <div className="float-idle absolute -inset-3">
              <Portrait c={c} />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-stage)] via-black/25 to-transparent" />
            <button onClick={onClose} className="press absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/25 hover:bg-black/65" aria-label="Close">
              <X className="h-5 w-5" aria-hidden />
            </button>
            <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/50 py-1 pl-2.5 pr-3 text-[12px] font-bold text-white ring-1 ring-white/20">
              <LevelSteps level={c.difficulty} light small />
              Written at level {c.difficulty}
            </span>
            <div className="absolute inset-x-0 bottom-0 px-5 pb-4 text-white">
              <h2 id="sheet-title" className="font-display text-[32px] font-black leading-none tracking-[-0.03em]">
                {c.patientFirstName}
                {c.age !== null && <span className="font-extrabold text-white/80">, {c.age}</span>}
              </h2>
              <p className="mt-1.5 text-[14px] font-medium text-white/85">{[sentence(c.encounterType), c.specialty].filter(Boolean).join(" · ")}</p>
            </div>
          </div>

          {/* ---------- Your record with this patient ---------- */}
          <div className="space-y-3 px-5 py-4">
            <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
              <span className="font-semibold text-ink-2">Written for {c.professions.map((p) => professionNames[p] || p).join(", ")}</span>
              {c.aiDraft && <TrustLabel kind="ai-draft" title="This patient was written by AI and has not been reviewed by faculty yet." />}
              {c.sample && <TrustLabel kind="sample" />}
            </div>
            <div className="flex items-center gap-3.5 rounded-[20px] bg-surface-2 p-3 ring-1 ring-inset ring-line/70">
              <ScoreRing value={c.best} size={52} />
              <div className="min-w-0 flex-1 text-[13.5px]">
                {c.attempts === 0 ? (
                  <>
                    <p className="font-display text-[16px] font-extrabold text-ink">Not attempted yet</p>
                    <p className="text-ink-3">Your first visit sets your best score.</p>
                  </>
                ) : (
                  <>
                    <p className="flex flex-wrap items-center gap-2 font-display text-[16px] font-extrabold text-ink">
                      {c.attempts} attempt{c.attempts === 1 ? "" : "s"}
                      <AttemptPips n={c.attempts} />
                    </p>
                    <p className="text-ink-3">
                      {c.best !== null ? (
                        <>
                          best <span className="font-bold text-ink">{Math.round(c.best)}%</span>
                        </>
                      ) : (
                        "no visible score yet"
                      )}
                      {c.lastId && (
                        <>
                          {" "}
                          ·{" "}
                          <Link href={feedbackUrl(c.lastId)} className="font-semibold text-brand-700 hover:underline">
                            Last feedback
                          </Link>
                        </>
                      )}
                    </p>
                  </>
                )}
              </div>
            </div>
            {c.activeId && (
              <p className="flex items-center gap-2.5 rounded-[18px] bg-[var(--color-flame-soft)] px-3.5 py-2.5 text-[13.5px] text-ink ring-1 ring-inset ring-[var(--color-flame-2)]">
                <span className="breathe grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--color-flame)] text-ink">
                  <History className="h-4 w-4" aria-hidden />
                </span>
                <span>
                  You have a visit with this patient in progress.{" "}
                  <Link href={visitUrl(c.activeId)} className="font-bold text-[var(--color-flame-ink)] underline">
                    Resume it
                  </Link>
                </span>
              </p>
            )}
          </div>

          {/* ---------- The compound start control ---------- */}
          <section aria-labelledby="start-console" className="rounded-t-[28px] bg-stage px-5 pb-5 pt-5 text-white">
            <h3 id="start-console" className="font-display text-[19px] font-extrabold tracking-[-0.02em]">
              Set up this visit
            </h3>

            {c.attempts > 0 && (
              <fieldset className="mt-3">
                <legend className="sr-only">Visit type</legend>
                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.07] p-1 ring-1 ring-inset ring-white/10">
                  {(
                    [
                      ["fresh", "Start over", RotateCcw],
                      ["follow", "Follow-up", UserRoundCheck],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <label
                      key={id}
                      className={cx(
                        "press relative flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-[14px] font-bold transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300",
                        mode === id ? "bg-white text-ink shadow-e2" : "text-white/85 hover:text-white",
                      )}
                    >
                      <input type="radio" name={`mode-${c.id}`} value={id} checked={mode === id} onChange={() => setMode(id)} className="sr-only" />
                      <Icon className="h-4 w-4" aria-hidden />
                      {label}
                    </label>
                  ))}
                </div>
                <p key={mode} className="pop-in mt-2 text-[12.5px] leading-relaxed text-white/80">
                  {follow ? (
                    <>
                      <span className="font-bold text-white">Follow-up visit:</span> {c.patientFirstName} remembers you, what they told you is already in the chart, and their trust is where you left it.
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-white">Start over</span> is a clean repetition.
                    </>
                  )}
                </p>
              </fieldset>
            )}

            {/* Difficulty: slider + live mood and comfort preview */}
            <div className="mt-4 rounded-[22px] bg-white/[0.05] p-4 ring-1 ring-inset ring-white/10">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <MoodFace knobs={k} size={92} />
                </div>
                <div className="min-w-0 flex-1">
                  <label htmlFor={`lvl-${c.id}`} className="text-[12.5px] font-bold text-[var(--color-xp)]">
                    Difficulty for this visit
                  </label>
                  <p className="font-display text-[26px] font-black leading-none tracking-[-0.02em]">
                    <span key={level} className="practice-tick inline-block">
                      Level {level}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[14px] font-semibold text-white/85">
                    {LEVEL_NAMES[level]}
                    {level === c.difficulty && <span className="font-normal text-white/70"> (written at)</span>}
                  </p>
                  <p className="mt-2 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-white/10 py-1 pl-2 pr-3 text-[12.5px] font-bold" aria-live="polite">
                    <span className="h-2.5 w-2.5 rounded-full transition-colors duration-200" style={{ background: MOOD_DOT[k.emotion] }} aria-hidden />
                    {MOOD[k.emotion]} · {VAGUE[k.vagueness]}
                  </p>
                </div>
              </div>

              <input
                ref={slider}
                id={`lvl-${c.id}`}
                type="range"
                min={1}
                max={5}
                step={1}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="practice-range mt-3"
                style={v({ "--p": `calc(17px + (100% - 34px) * ${frac})` })}
                aria-valuetext={`Level ${level}, ${LEVEL_NAMES[level]}. Patient ${MOOD[k.emotion].toLowerCase()}, ${VAGUE[k.vagueness].toLowerCase()}.`}
              />
              <div className="grid grid-cols-5 text-center text-[12px]" aria-hidden>
                {[1, 2, 3, 4, 5].map((l) => (
                  <span key={l} onClick={() => setLevel(l)} className={cx("cursor-pointer select-none py-1", l === level ? "font-black text-[var(--color-xp)]" : "font-semibold text-white/70")}>
                    {l}
                    {l === c.difficulty && <span className="block text-[10px] font-semibold text-white/70">written</span>}
                  </span>
                ))}
              </div>

              {/* Comfort: where the patient starts, and the two trust gates the level sets. */}
              <div className="mt-3">
                <div className="flex items-baseline justify-between text-[12px] font-semibold text-white/80">
                  <span>Comfort at the start</span>
                  <span className="font-mono text-[13px] font-bold text-white">{k.rapportStart}/100</span>
                </div>
                <div className="relative mt-1.5 h-3 rounded-full bg-white/12" role="img" aria-label={`Comfort starts at ${k.rapportStart} of 100. Needs-trust facts open at ${k.reluctantAt}, guarded facts at ${k.hiddenAt}.`}>
                  <div className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-brand-400 transition-transform duration-300 ease-[var(--ease-out-ui)]" style={{ transform: `scaleX(${k.rapportStart / 100})` }} />
                  <span className="absolute -top-1 h-5 w-1 rounded-full bg-[var(--color-tier-reluctant)] ring-2 ring-[var(--color-stage)] transition-[left] duration-300 ease-[var(--ease-out-ui)]" style={{ left: pct(k.reluctantAt) }} />
                  <span className="absolute -top-1 h-5 w-1 rounded-full bg-[var(--color-tier-hidden)] ring-2 ring-[var(--color-stage)] transition-[left] duration-300 ease-[var(--ease-out-ui)]" style={{ left: pct(k.hiddenAt) }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/80">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-1 rounded-full bg-[var(--color-tier-reluctant)]" aria-hidden />
                    Needs-trust facts at <b className="font-mono text-white">{k.reluctantAt}</b>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-1 rounded-full bg-[var(--color-tier-hidden)]" aria-hidden />
                    Guarded facts at <b className="font-mono text-white">{k.hiddenAt}</b>
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Knob icon={<MessageCircle className="h-4 w-4" />} label="Talks" value={k.volunteers ? "Volunteers related facts" : "Only answers what you ask"} on={k.volunteers} />
                <Knob icon={<Layers className="h-4 w-4" />} label="New facts per reply" value={`Up to ${k.factsPerTurn}`} />
                <Knob icon={<Lightbulb className="h-4 w-4" />} label="Coach hints" value={k.hints ? "Available" : "Off"} on={k.hints} />
                <Knob icon={<Timer className="h-4 w-4" />} label="Time" value={k.timeLimitMin ? `${k.timeLimitMin} minutes` : "No time limit"} on={!k.timeLimitMin} />
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-white/75">The facts stay the same at every level. What changes is how hard the patient is to interview.</p>
              <details className="group mt-1">
                <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 text-[12.5px] font-bold text-[var(--color-xp)] pointer-coarse:min-h-11">
                  <span className="transition-transform group-open:rotate-90" aria-hidden>
                    ›
                  </span>
                  Every number at level {level}
                </summary>
                <LevelEffects level={level} timeLimitMin={c.timeLimitMin ?? undefined} />
              </details>
            </div>

            {c.attempts > 0 && (
              <label
                className={cx(
                  "mt-3 flex cursor-pointer items-start gap-3 rounded-[20px] p-3.5 ring-1 ring-inset transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300",
                  follow ? "cursor-not-allowed opacity-60 ring-white/10" : vary ? "bg-white/[0.08] ring-[var(--color-xp)]/60" : "ring-white/15",
                )}
              >
                <input type="checkbox" className="peer sr-only" checked={vary && !follow} disabled={follow} onChange={(e) => setVary(e.target.checked)} />
                <span className={cx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200", vary && !follow ? "bg-[var(--color-xp)]" : "bg-white/20")} aria-hidden>
                  <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-out-ui)]", vary && !follow ? "translate-x-[22px]" : "translate-x-0.5")} />
                </span>
                <span className="text-[13.5px] text-white/80">
                  <span className="flex items-center gap-1.5 font-bold text-white">
                    <Shuffle className="h-4 w-4" aria-hidden />
                    Vary the patient this time
                  </span>
                  {follow ? "Applies to Start over. A follow-up keeps the patient as you left them." : "Their mood and delivery change; the clinical facts do not."}
                </span>
              </label>
            )}

            <div className="mt-3 flex items-start gap-2.5 text-[12.5px] leading-relaxed text-white/80">
              <TrustLabel kind="private" className="mt-px shrink-0" />
              <span>Only you see this visit and its feedback. It still updates your own progress.</span>
            </div>
          </section>
        </div>

        {/* ---------- The reward and the button: the end of the same control ---------- */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-stage px-5 py-4 text-white">
          <div className="game-layer min-w-0" aria-live="polite">
            <p className="font-display text-[30px] font-black leading-none tracking-[-0.03em] text-[var(--color-xp)]">
              +<span className="tabular">{xpShown}</span> XP
            </p>
            <p className="mt-1 text-[12px] font-semibold text-white/80">
              for finishing{level > 1 ? ` at level ${level}` : ""}
              {follow ? ", follow-up" : ""}, plus 5 per fact you uncover
            </p>
          </div>
          {follow ? (
            <StartVisit size="lg" body={{ caseId: c.id, mode: "practice", level, followUp: true }} label="Follow-up visit" />
          ) : (
            <StartVisit
              size="lg"
              body={{
                caseId: c.id,
                mode: "practice",
                level,
                perturb: c.attempts > 0 && vary,
              }}
              label={c.attempts > 0 ? "Start over" : "Start visit"}
            />
          )}
        </div>
      </div>
    </div>
  );
}
