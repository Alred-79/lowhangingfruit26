"use client";

import { Armchair, Bot, ChevronDown, Eye, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, cx } from "@/components/ui";
import { post, v } from "./shared";
import "./journey.css";

export interface JoinStage {
  id: string;
  order: number;
  roleTitle: string;
  clinicianName: string;
  clinicianRole: string;
  focus: string;
  simTime: string;
  visitLabel?: string;
  suggested: boolean;
}

/**
 * "Join as ..." for each encounter of a journey, as a pick-a-seat timeline. The AI plays every role the
 * student does not take. Pointing at (or focusing) a seat lights the stretch of the timeline you would
 * watch before your own visit, with how many colleagues that is.
 */
export default function JoinButtons({ journeyId, stages, assignmentId }: { journeyId: string; stages: JoinStage[]; assignmentId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState("");
  const suggested = stages.findIndex((s) => s.suggested);
  const [hot, setHot] = useState<number>(suggested >= 0 ? suggested : -1);
  async function join(stageId: string) {
    setBusy(stageId);
    setErr("");
    const r = await post<{ id: string }>("/api/journeys/runs", { journeyId, stageId, assignmentId });
    if (r.error || !r.id) {
      setBusy("");
      return setErr(r.error || "Could not start the journey.");
    }
    router.push(`/journey/${r.id}`);
  }
  return (
    <div>
      <ol className="relative space-y-3">
        {stages.map((s, i) => {
          const isHot = hot === i;
          const watched = hot > i; // a colleague you would watch before your own visit
          return (
            <li
              key={s.id}
              className="rise relative grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3"
              style={v({ "--i": i })}
              onMouseEnter={() => setHot(i)}
              onFocus={() => setHot(i)}
            >
              {i < stages.length - 1 && (
                <span className="absolute bottom-[-0.75rem] left-[21px] top-12 w-[5px] overflow-hidden rounded-full bg-brand-100" aria-hidden>
                  <span className={cx("jr-seat-line block h-full w-full rounded-full bg-[var(--color-xp)]", hot > i ? "scale-y-100" : "scale-y-0")} />
                </span>
              )}
              <span
                className={cx(
                  "relative z-10 mt-4 grid h-11 w-11 place-items-center rounded-full font-display text-[17px] font-black clay transition-[background-color,color,transform] duration-200",
                  isHot ? "scale-110 bg-[var(--color-mastery)] text-white" : watched ? "bg-[var(--color-xp)] text-ink" : s.suggested ? "bg-brand-600 text-white" : "bg-surface text-ink-2 ring-2 ring-inset ring-brand-100",
                )}
                aria-hidden
              >
                {isHot ? <Armchair className="h-5 w-5" /> : watched ? <Eye className="h-5 w-5" /> : s.order}
              </span>
              <div className={cx("rounded-[22px] border bg-surface p-4 transition-[box-shadow,border-color,transform] duration-200", isHot ? "-translate-y-0.5 border-[var(--color-mastery)]/50 shadow-e2" : s.suggested ? "border-brand-300 shadow-e1" : "border-line shadow-e1")}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-ink px-2 py-0.5 font-mono text-[11px] font-bold text-white">Encounter {s.order}</span>
                    <span className="text-xs font-semibold text-ink-3">{s.simTime}{s.visitLabel ? ` · ${s.visitLabel}` : ""}</span>
                    {s.suggested && <Badge tone="teal"><Sparkles className="h-3 w-3" aria-hidden />Matches your profession</Badge>}
                  </div>
                  <h3 className="mt-1.5 font-display text-[20px] font-black leading-tight tracking-[-0.025em] text-ink">{s.roleTitle}</h3>
                  <div className="mt-2 rounded-2xl bg-surface-2 px-3.5 py-2.5">
                    <p className={cx("max-w-[70ch] text-[14px] leading-relaxed text-ink-2", !open[s.id] && "line-clamp-3")}>{s.focus}</p>
                    {s.focus.length > 220 && (
                      <button type="button" aria-expanded={!!open[s.id]} onClick={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))} className="mt-1 inline-flex min-h-7 items-center gap-1 rounded-full text-[12.5px] font-bold text-brand-700 hover:underline pointer-coarse:min-h-11">
                        <ChevronDown className={cx("h-3.5 w-3.5 transition-transform", open[s.id] && "rotate-180")} aria-hidden />
                        {open[s.id] ? "Show less" : "Read the whole brief"}
                      </button>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 font-semibold text-ink-2"><Bot className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />If you do not take this role, the AI plays {s.clinicianName} ({s.clinicianRole}).</span>
                    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-bold transition-colors", isHot ? "bg-[var(--color-mastery-soft)] text-[var(--color-mastery-ink)]" : "bg-surface-2 text-ink-3")}>
                      <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {i === 0 ? "You see the patient first" : `You watch ${i} colleague${i === 1 ? "" : "s"} first`}
                    </span>
                  </div>
                </div>
                <Button onClick={() => join(s.id)} disabled={!!busy} variant={s.suggested || isHot ? "primary" : "secondary"} size="lg" className="mt-3 w-full sm:w-auto">
                  <Armchair className="h-4 w-4 shrink-0" aria-hidden />
                  {busy === s.id ? "Starting" : `Join as ${s.roleTitle.toLowerCase()}`}
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      {err && <p role="alert" className="mt-3 rounded-2xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200">{err}</p>}
    </div>
  );
}
