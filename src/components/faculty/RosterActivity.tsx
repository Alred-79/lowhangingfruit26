"use client";
import { useState, type CSSProperties } from "react";
import { RemoveStudent } from "@/components/courses/CourseTools";
import When from "@/components/courses/When";
import { FilterChips } from "@/components/game/controls";
import { cx } from "@/components/ui";

export interface RosterRow {
  id: string;
  name: string;
  email: string;
  role: string;
  visits: number;
  lastAt: string | null;
  streak: number;
  /** Last 14 days, oldest first: finished a recorded visit that day. */
  days: boolean[];
  activeThisWeek: boolean;
}
type Filter = "all" | "active" | "quiet";
const v = (o: Record<string, string | number>) => o as CSSProperties;

/** Roster with each student's recorded-visit activity (no scores, no XP), filterable by this week's activity. */
export default function RosterActivity({ courseId, rows }: { courseId: string; rows: RosterRow[] }) {
  const active = rows.filter((r) => r.activeThisWeek);
  const quiet = rows.filter((r) => !r.activeThisWeek);
  const [f, setF] = useState<Filter>("all");
  const shown = f === "active" ? active : f === "quiet" ? quiet : rows;
  return (
    <div>
      <div className="px-4 pt-3.5">
        <FilterChips
          label="Filter the roster"
          value={f}
          onChange={setF}
          options={[
            { id: "all", label: "All", count: rows.length },
            { id: "active", label: "Active this week", count: active.length },
            { id: "quiet", label: "Quiet", count: quiet.length, tone: "bg-[var(--color-flame-2)] text-ink" },
          ]}
        />
      </div>
      {shown.length === 0 ? (
        <p className="px-4 py-5 text-[13.5px] text-ink-3">{f === "active" ? "Nobody has finished a recorded visit this week yet." : "Everyone has been active this week."}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line/70">
          {shown.map((u, i) => (
            <li key={u.id} className="rise px-4 py-3" style={v({ "--i": i })}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-[14px] font-black", u.activeThisWeek ? "bg-[var(--color-xp)] text-ink" : "bg-surface-2 text-ink-2")} aria-hidden>
                    {u.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-bold text-ink">{u.name}</div>
                    <div className="truncate text-[12px] text-ink-3">
                      {u.email} · {u.role}
                    </div>
                  </div>
                </div>
                <RemoveStudent courseId={courseId} userId={u.id} name={u.name} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-[46px]">
                <span className="flex gap-[3px]" role="img" aria-label={`Active on ${u.days.filter(Boolean).length} of the last 14 days`}>
                  {u.days.map((d, k) => (
                    <span key={k} className={cx("h-3 w-2 rounded-[3px]", d ? "bg-brand-600" : "bg-surface-2")} />
                  ))}
                </span>
                <span className="text-[12px] font-semibold text-ink-2">
                  <span className="font-mono font-bold text-ink">{u.visits}</span> visit{u.visits === 1 ? "" : "s"}
                </span>
                {u.streak > 0 && <span className="rounded-full bg-[var(--color-flame-soft)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--color-flame-ink)]">{u.streak}-day streak</span>}
                <span className="text-[12px] text-ink-3">{u.lastAt ? <>last <When at={u.lastAt} time={false} /></> : "no recorded visit yet"}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
