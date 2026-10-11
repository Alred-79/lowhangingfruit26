"use client";

import { ArrowRight, Play } from "lucide-react";
import type { CSSProperties } from "react";
import { TiltCard } from "@/components/game/controls";
import TrustLabel from "@/components/TrustLabel";
import { cx } from "@/components/ui";
import { LEVEL_NAMES } from "@/lib/engine/difficulty";
import { AttemptPips, LevelSteps, Portrait, ScoreRing } from "./bits";
import { sentence, type PracticeCase } from "./types";

const v = (o: Record<string, string | number>) => o as CSSProperties;

/**
 * A portrait-forward patient card. It tilts toward the pointer on a spring (pointer-fine only), the
 * portrait drifts slowly at rest, and the record (best score ring, attempts, in progress) and the trust
 * labels are part of the card, not text under it. The whole card is one button that opens the start sheet.
 */
export default function PatientCard({ c, i, onOpen }: { c: PracticeCase; i: number; onOpen: () => void }) {
  const fresh = c.attempts === 0;
  return (
    <div
      className="rise h-full"
      style={v({
        "--i": Math.min(i, 10),
        viewTransitionName: `pc-${c.id.replace(/[^a-zA-Z0-9_-]/g, "")}`,
      })}
    >
      <TiltCard className="h-full rounded-[24px]" max={6}>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${c.patientFirstName}${c.age !== null ? `, ${c.age}` : ""}. ${sentence(c.encounterType) || "Visit"}. Level ${c.difficulty}. ${c.activeId ? "Visit in progress. " : ""}${fresh ? "Not attempted yet." : `${c.attempts} attempt${c.attempts === 1 ? "" : "s"}${c.best !== null ? `, best ${Math.round(c.best)}%` : ""}.`}${c.aiDraft ? " AI-drafted, not faculty-reviewed." : ""}${c.sample ? " Sample." : ""}`}
          className="press group flex h-full w-full flex-col overflow-hidden rounded-[24px] bg-surface text-left shadow-e1 ring-1 ring-line/80 transition-shadow duration-200 hover:shadow-e2 hover:ring-brand-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-400"
        >
          <div className="relative aspect-[4/4.1] w-full overflow-hidden bg-stage sm:aspect-[4/3.7]">
            <div className="float-idle absolute -inset-2" style={v({ "--i": i })}>
              <Portrait c={c} className="transition-transform duration-300 ease-[var(--ease-out-ui)] group-hover:scale-[1.04]" />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[var(--color-stage)]/95 via-[var(--color-stage)]/45 to-transparent" />
            <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/55 py-1 pl-2 pr-2.5 text-[11.5px] font-bold text-white ring-1 ring-white/20">
              <LevelSteps level={c.difficulty} light small />
              <span>
                L{c.difficulty}
                <span className="hidden sm:inline"> {LEVEL_NAMES[c.difficulty]}</span>
              </span>
            </span>
            {c.activeId ? (
              <span className="absolute left-2.5 top-11 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-flame-2)] sm:left-auto sm:right-2.5 sm:top-2.5 py-1 pl-2 pr-2.5 text-[11.5px] font-black text-ink shadow-e2">
                <span className="breathe h-2 w-2 rounded-full bg-[var(--color-live)]" aria-hidden />
                In progress
              </span>
            ) : fresh ? (
              <span className="absolute right-2.5 top-2.5 rotate-3 rounded-lg bg-[var(--color-xp)] px-2 py-0.5 font-display text-[12px] font-black text-ink shadow-e2">NEW</span>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 px-3.5 pb-3 text-white">
              <p className="font-display text-[22px] font-black leading-none tracking-[-0.025em] sm:text-[24px]">
                {c.patientFirstName}
                {c.age !== null && <span className="font-extrabold text-white/80">, {c.age}</span>}
              </p>
              <p className="mt-1 line-clamp-1 text-[12.5px] font-semibold text-white/85">{sentence(c.encounterType) || "Visit"}</p>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2.5 p-3 sm:p-3.5">
            <div className="flex items-center gap-2.5">
              <ScoreRing value={c.best} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-bold text-ink">
                  {fresh ? (
                    "Not attempted yet"
                  ) : (
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      {c.attempts} attempt{c.attempts === 1 ? "" : "s"}
                      <AttemptPips n={c.attempts} />
                    </span>
                  )}
                </p>
                {c.specialty && <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-3">{c.specialty}</p>}
              </div>
              <span
                className={cx(
                  "hidden h-9 w-9 shrink-0 place-items-center rounded-full transition-transform duration-200 ease-[var(--ease-out-ui)] group-hover:translate-x-0.5 sm:grid",
                  c.activeId ? "bg-[var(--color-flame)] text-ink" : "bg-brand-600 text-white",
                )}
                aria-hidden
              >
                {c.activeId ? <Play className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </span>
            </div>
            {(c.aiDraft || c.sample) && (
              <div className="mt-auto flex flex-wrap gap-1">
                {c.aiDraft && <TrustLabel kind="ai-draft" className="rounded-xl! py-1! leading-tight whitespace-normal!" />}
                {c.sample && <TrustLabel kind="sample" />}
              </div>
            )}
          </div>
        </button>
      </TiltCard>
    </div>
  );
}
