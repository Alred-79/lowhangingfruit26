"use client";
import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import When from "@/components/courses/When";
import { FilterChips } from "@/components/game/controls";
import { Badge, cx } from "@/components/ui";

export interface DueItem {
  id: string;
  courseId: string;
  title: string;
  type: "homework" | "exam" | "practice";
  typeLabel: string;
  course: string;
  dueAt: string;
  past: boolean;
  roster: number;
  submitted: number;
  inProgress: number;
}

type Filter = "all" | "soon" | "past";
const v = (o: Record<string, string | number>) => o as CSSProperties;

/** Assignments due around now, filterable (chips with live counts), each with its class progress as a two-part bar. */
export default function DueBoard({ items, empty }: { items: DueItem[]; empty: string }) {
  const soon = items.filter((x) => !x.past);
  const past = items.filter((x) => x.past);
  const [f, setF] = useState<Filter>(soon.length ? "soon" : "all");
  const shown = f === "soon" ? soon : f === "past" ? past : items;
  if (!items.length) return <p className="px-5 py-6 text-[14px] text-ink-3">{empty}</p>;
  return (
    <div>
      <div className="px-5 pt-4">
        <FilterChips
          label="Show assignments"
          value={f}
          onChange={setF}
          options={[
            { id: "soon", label: "Coming up", count: soon.length },
            { id: "past", label: "Recently due", count: past.length, tone: "bg-[var(--color-flame-2)] text-ink" },
            { id: "all", label: "All", count: items.length },
          ]}
        />
      </div>
      {shown.length === 0 ? (
        <p className="px-5 py-6 text-[14px] text-ink-3">{f === "soon" ? "Nothing else is coming up in the next two weeks." : "Nothing was due in the past week."}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line/70">
          {shown.map((a, i) => {
            const done = a.roster ? (a.submitted / a.roster) * 100 : 0;
            const going = a.roster ? (a.inProgress / a.roster) * 100 : 0;
            return (
              <li key={a.id} className="rise px-5 py-3.5" style={v({ "--i": i })}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/faculty/courses/${a.courseId}/assignments/${a.id}`} className="block truncate font-display text-[16px] font-extrabold text-ink hover:text-brand-700">
                      {a.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
                      <Badge tone={a.type === "exam" ? "violet" : a.type === "practice" ? "slate" : "blue"}>{a.typeLabel}</Badge>
                      <span>{a.course}</span>
                      <span className={cx("inline-flex items-center gap-1", a.past && "font-semibold text-[var(--color-flame-ink)]")}>
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                        {a.past ? "Was due" : "Due"} <When at={a.dueAt} />
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[12.5px] text-ink-3">
                    <div className="text-[14px] font-bold text-ink">
                      <span className="font-display text-[20px] font-black">{a.submitted}</span> of {a.roster} submitted
                    </div>
                    {a.inProgress > 0 && <div>{a.inProgress} in progress</div>}
                  </div>
                </div>
                <div className="mt-2 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${a.submitted} of ${a.roster} submitted, ${a.inProgress} in progress`}>
                  {done > 0 && <span className="bar-grow h-full rounded-full bg-[var(--color-xp)]" style={v({ width: `${done}%`, "--delay": `${200 + i * 60}ms` })} />}
                  {going > 0 && <span className="bar-grow h-full rounded-full bg-[color-mix(in_oklch,var(--color-xp)_40%,var(--color-surface-2))]" style={v({ width: `${going}%`, "--delay": `${320 + i * 60}ms` })} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
