"use client";
import Link from "next/link";
import { useId, useState, type CSSProperties } from "react";
import { FilterChips } from "@/components/game/controls";
import { Badge, cx } from "@/components/ui";
import { feedbackUrl } from "@/lib/courses/settings";
import { HeatCell, ScoreBar, scoreTone } from "./viz";

/** The serialisable part of a gradebook row (lib/courses GradeRow). */
export interface GbRow {
  userId: string;
  student: string;
  enrolled: boolean;
  caseId: string;
  caseTitle: string;
  attempts: { id: string; final: number | null; score: number | null; facultyScore: number | null; level: number; variation: string | null; reviewReasons: string[]; hasNote: boolean }[];
  inProgress: number;
  best: number | null;
  latest: number | null;
  domains: Record<string, { score: number | null; max: number }>;
  needsReview: boolean;
}
type Filter = "all" | "review" | "scored" | "waiting";
const v = (o: Record<string, string | number>) => o as CSSProperties;
/** 4-point domains bottom out at 1, checklist items at 0 (same rule as lib/courses). */
const domainPct = (score: number, max: number) => (max === 4 ? ((score - 1) / 3) * 100 : max ? (score / max) * 100 : 0);

/**
 * The assignment gradebook, visualized: attempts as score chips, best as a bar, rubric domains as heat cells (the
 * value always as text). Two controls: filter chips with live counts, and a threshold slider that highlights every
 * row whose best score is below it and counts them live. Every link (feedback per attempt, latest feedback) is kept.
 */
export default function GradebookTable({ rows, domainCols, multiCase }: { rows: GbRow[]; domainCols: { key: string; name: string }[]; multiCase: boolean }) {
  const [f, setF] = useState<Filter>("all");
  const [bar, setBar] = useState(60);
  const sid = useId();
  const review = rows.filter((r) => r.needsReview);
  const scored = rows.filter((r) => r.best !== null);
  const waiting = rows.filter((r) => r.attempts.length === 0);
  const shown = f === "review" ? review : f === "scored" ? scored : f === "waiting" ? waiting : rows;
  const below = scored.filter((r) => (r.best ?? 0) < bar).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line/70 px-5 py-4">
        <FilterChips
          label="Show students"
          value={f}
          onChange={setF}
          options={[
            { id: "all", label: "All", count: rows.length },
            { id: "review", label: "Needs review", count: review.length, tone: "bg-[var(--color-tier-hidden-ink)] text-white" },
            { id: "scored", label: "Scored", count: scored.length },
            { id: "waiting", label: "Not started", count: waiting.length, tone: "bg-[var(--color-flame-2)] text-ink" },
          ]}
        />
        <div className="flex min-w-[15rem] flex-1 items-center gap-3 sm:max-w-sm">
          <label htmlFor={sid} className="shrink-0 text-[12.5px] font-bold text-ink-2">
            Highlight below
          </label>
          <input id={sid} type="range" min={0} max={100} step={5} value={bar} onChange={(e) => setBar(Number(e.target.value))} className="fac-range min-w-0 flex-1" style={v({ "--p": `${bar}%` })} aria-valuetext={`${bar}%, ${below} student${below === 1 ? "" : "s"} below`} />
          <span className="shrink-0 rounded-full bg-ink px-2.5 py-1 font-mono text-[12.5px] font-bold text-white tabular-nums">{bar}%</span>
          <span key={below} className="pop-spring shrink-0 rounded-full bg-[var(--color-tier-hidden-soft)] px-2.5 py-1 text-[12px] font-bold text-[var(--color-tier-hidden-ink)]" aria-live="polite">
            {below} below
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-line text-left align-bottom text-[12px] text-ink-3">
              <th className="px-5 py-2.5 font-bold">Student</th>
              {multiCase && <th className="px-3 py-2.5 font-bold">Patient</th>}
              <th className="px-3 py-2.5 font-bold">Attempts</th>
              <th className="px-3 py-2.5 font-bold">Best</th>
              <th className="px-3 py-2.5 text-right font-bold">Latest</th>
              {domainCols.map((d) => (
                <th key={d.key} className="min-w-[5.5rem] px-1.5 py-2.5 text-center font-bold leading-tight">
                  {d.name}
                </th>
              ))}
              <th className="px-3 py-2.5 font-bold">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {shown.length === 0 && (
              <tr>
                <td colSpan={5 + domainCols.length + (multiCase ? 1 : 0)} className="px-5 py-6 text-[14px] text-ink-3">
                  No students match this filter.
                </td>
              </tr>
            )}
            {shown.map((r, ri) => {
              const last = r.attempts[r.attempts.length - 1];
              const reasons = [...new Set(r.attempts.flatMap((x) => x.reviewReasons))];
              const low = r.best !== null && r.best < bar;
              return (
                <tr key={r.userId + r.caseId} className={cx("align-top transition-colors duration-200", low && "bg-[var(--color-tier-hidden-soft)]")}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-xl font-display text-[13px] font-black", r.best !== null ? "bg-[var(--color-xp)] text-ink" : "bg-surface-2 text-ink-2")} aria-hidden>
                        {r.student.slice(0, 1)}
                      </span>
                      <div>
                        <div className="whitespace-nowrap font-bold text-ink">{r.student}</div>
                        {!r.enrolled && <div className="text-[12px] text-ink-3">Not on the roster</div>}
                      </div>
                    </div>
                  </td>
                  {multiCase && <td className="min-w-[13rem] max-w-[16rem] px-3 py-3 text-[12.5px] leading-snug text-ink-2">{r.caseTitle}</td>}
                  <td className="px-3 py-3">
                    {r.attempts.length === 0 && r.inProgress === 0 && <span className="text-[12.5px] text-ink-3">Not started</span>}
                    <div className="flex flex-wrap gap-1">
                      {r.attempts.map((x, i) => (
                        <Link
                          key={x.id}
                          href={feedbackUrl(x.id)}
                          title={`Attempt ${i + 1}: level ${x.level}${x.variation ? `, patient variation: ${x.variation}` : ""}${x.facultyScore !== null ? `, adjusted from ${Math.round(x.score ?? 0)}%` : ""}. Open feedback.`}
                          className="press inline-flex min-h-8 items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 text-[12px] font-bold tabular-nums text-ink ring-1 ring-inset ring-line hover:ring-brand-500 pointer-coarse:min-h-11"
                        >
                          <span className="text-ink-3">{i + 1}</span>
                          {x.final !== null && <span className="h-2 w-2 rounded-full" style={{ background: scoreTone(x.final) }} aria-hidden />}
                          {x.final === null ? "scoring" : `${Math.round(x.final)}%`}
                          {x.facultyScore !== null && <span className="text-ink-3">adj.</span>}
                        </Link>
                      ))}
                      {r.inProgress > 0 && <Badge tone="blue">In progress</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <ScoreBar value={r.best} i={ri} />
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-[13px] font-semibold tabular-nums text-ink-2">{r.latest === null ? <span className="text-ink-3">–</span> : `${Math.round(r.latest)}%`}</td>
                  {domainCols.map((d, ci) => {
                    const s = r.domains[d.key];
                    return (
                      <td key={d.key} className="px-1.5 py-2.5 text-center">
                        {!s ? (
                          <span className="text-ink-3">–</span>
                        ) : s.score === null ? (
                          <span className="text-[12px] text-ink-3">N/A</span>
                        ) : (
                          <HeatCell pct={domainPct(s.score, s.max)} i={ri + ci} below={ri === 0} tip={`${r.student}: ${d.name} ${s.score} of ${s.max}`}>
                            {s.score}
                            <span className="opacity-70">/{s.max}</span>
                          </HeatCell>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3">
                    {reasons.length > 0 ? (
                      <div className="space-y-1">
                        {r.needsReview ? <Badge tone="red">Needs review</Badge> : <Badge tone="green">Reviewed</Badge>}
                        <div className="max-w-[12rem] text-[12px] leading-snug text-ink-3">{reasons.join("; ")}</div>
                      </div>
                    ) : last?.hasNote || last?.facultyScore != null ? (
                      <Badge tone="green">Reviewed</Badge>
                    ) : null}
                    {last && (
                      <Link href={feedbackUrl(last.id)} className="mt-1 block whitespace-nowrap text-[12.5px] font-bold text-brand-700 hover:underline">
                        Open feedback
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
