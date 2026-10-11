"use client";

import { useState } from "react";
import ArtifactView from "@/components/chart/ArtifactView";
import { CircleCheck, Clock, FileText, Lock, Video } from "lucide-react";
import { Badge, cx } from "@/components/ui";
import type { CaseProfile } from "@/lib/types";
import { releaseLabel } from "@/lib/studio/profile";
import { Notice, Panel } from "./fields";
import { TierBar, tierCounts } from "./TierLadder";

/** Exactly what a student has in front of them before the first question: the brief and the chart at start. */
export default function StudentPreview({ p, roleTitle }: { p: CaseProfile; roleTitle: string }) {
  const start = p.artifacts.filter((d) => d.release.when === "start");
  const later = p.artifacts.filter((d) => d.release.when !== "start");
  const [open, setOpen] = useState<string | null>(start[0]?.id || null);
  const doc = start.find((d) => d.id === open);
  return (
    <div className="space-y-4">
      <Notice tone="teal">
        This is what a student sees when the visit opens, before asking anything. It updates as you edit. To experience the conversation itself, use <span className="font-medium">Test visit</span>.
      </Notice>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Before the visit" subtitle="The brief the student reads before joining the call." icon={<Video className="h-5 w-5" aria-hidden />}>
          <div className="relative overflow-hidden rounded-[22px] bg-stage p-5 text-white">
            <div className="studio-glow pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,oklch(0.52_0.26_268/0.7),transparent)]" aria-hidden />
            <p className="relative flex items-center gap-2 text-[12px] font-bold text-white/80">
              <span className="live-dot h-2 w-2 rounded-full bg-[var(--color-live)]" aria-hidden />
              Telehealth visit · you are the {roleTitle}
            </p>
            <div className="relative mt-3 flex items-center gap-3.5">
              {p.patient.portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.patient.portrait} alt="" className="h-16 w-16 rounded-[18px] object-cover object-[50%_25%] ring-[3px] ring-white/80" />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-[18px] bg-white/10 font-display text-xl font-black">{(p.patient.name || "?").slice(0, 2).toUpperCase()}</span>
              )}
              <div className="min-w-0">
                <p className="font-display text-[24px] font-black leading-tight tracking-[-0.025em]">
                  {p.patient.name || "Unnamed patient"}, {p.patient.age}
                </p>
                <p className="text-[13.5px] text-white/75">{[p.patient.sex, p.patient.pronouns].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <p className="relative mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-white/90">{p.scenario.studentBrief || <span className="font-semibold text-rose-300">The student brief is empty.</span>}</p>
            {p.scenario.tasks.filter((t) => t.trim()).length > 0 && (
              <>
                <p className="relative mt-4 text-[12.5px] font-bold text-[var(--color-xp)]">Your tasks</p>
                <ul className="relative mt-1.5 space-y-1.5 text-[13.5px] text-white/90">
                  {p.scenario.tasks.filter((t) => t.trim()).map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-xp)]" aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-semibold text-white/85">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              Time limit: {p.scenario.timeLimitMin} minutes
            </p>
          </div>
          <p className="mt-4 text-[12.5px] font-bold text-ink-2">On the video call</p>
          <p className="mt-1 text-[14px] italic leading-relaxed text-ink-2">{p.patient.appearance || "No appearance description."}</p>
        </Panel>

        <Panel title="Chart at the start" subtitle="The record as it stands before the first question." icon={<FileText className="h-5 w-5" aria-hidden />}>
          {p.chartAtStart.length ? (
            <dl className="divide-y divide-line overflow-hidden rounded-2xl ring-1 ring-line">
              {p.chartAtStart.map((it, i) => (
                <div key={i} className="grid grid-cols-[9rem_1fr] gap-2 px-3 py-1.5 text-sm">
                  <dt className="text-xs font-medium text-slate-500">{it.label}</dt>
                  <dd className="whitespace-pre-wrap text-slate-800">{it.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-slate-500">The chart header is empty.</p>
          )}
          <p className="mb-1.5 mt-4 text-xs font-semibold text-slate-600">Documents ({start.length})</p>
          {!start.length && <p className="text-sm text-slate-500">No documents are available at the start.</p>}
          <div className="flex flex-wrap gap-1.5">
            {start.map((d) => (
              <button key={d.id} type="button" aria-pressed={open === d.id} onClick={() => setOpen(open === d.id ? null : d.id)} className={cx("press inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold pointer-coarse:min-h-11", open === d.id ? "bg-ink text-white" : "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line hover:bg-brand-50")}>
                <FileText className="h-3.5 w-3.5" aria-hidden />
                {d.title || "Untitled"}
              </button>
            ))}
          </div>
          {doc && (
            <div className="pop-in mt-3 rounded-2xl p-3 ring-1 ring-line">
              <ArtifactView artifact={doc} />
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Not visible yet" subtitle="Faculty only. Students do not see this list; these appear as they earn them." icon={<Lock className="h-5 w-5" aria-hidden />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-slate-600">Documents released later ({later.length})</p>
            <ul className="mt-1 space-y-1 text-sm text-slate-700">
              {later.map((d) => (
                <li key={d.id}>
                  {d.title} <span className="text-xs text-amber-700">· {releaseLabel(p, d)}</span>
                </li>
              ))}
              {!later.length && <li className="text-slate-500">None</li>}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600">To be elicited or ordered</p>
            <TierBar counts={tierCounts(p.facts)} height={10} className="mt-2" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="green">{p.facts.filter((f) => f.tier === "initial").length} facts volunteered</Badge>
              <Badge tone="blue">{p.facts.filter((f) => f.tier === "discoverable").length} when asked</Badge>
              <Badge tone="amber">{p.facts.filter((f) => f.tier === "reluctant").length} need trust</Badge>
              <Badge tone="red">{p.facts.filter((f) => f.tier === "hidden").length} guarded</Badge>
              <Badge>{p.actions.length} exams and orders</Badge>
            </div>
            <p className="mt-2 text-xs text-slate-500">Patient&apos;s first words when asked what brings them in:</p>
            <p className="text-sm italic text-slate-700">&ldquo;{p.scenario.openingLine}&rdquo;</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
