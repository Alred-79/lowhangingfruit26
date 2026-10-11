import "server-only";
import { streakFrom, type Streak } from "@/components/game/derive";
import { RECORDED_VISIT } from "@/lib/courses";
import { all } from "@/lib/db";

/*
 * Class analytics for faculty views, derived read-only from stored visits. Honesty rules:
 * - Only recorded visits count (assignment or care-journey visits). A student's private practice is
 *   private and never appears in any class-facing number here.
 * - No XP, no ranks, no leaderboards: engagement (visits, active days, streaks) and progress only.
 * - Scores are never changed; nothing here reads or alters a grade.
 */

// Same product day as derive.ts (US Eastern), so a streak here matches the student's own streak rules.
const TZ = "America/New_York";
const fmtDay = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
export const dayOf = (s: string) => {
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? s.slice(0, 10) : fmtDay.format(d);
};
const addDays = (d: string, n: number) => {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

/** Counts per product day for the last `n` days, oldest first, today last. */
export function dayCounts(dates: (string | null | undefined)[], n = 14): { date: string; n: number }[] {
  const today = fmtDay.format(new Date());
  const counts = new Map<string, number>();
  for (const d of dates) if (d) counts.set(dayOf(d), (counts.get(dayOf(d)) || 0) + 1);
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - (n - 1));
    return { date, n: counts.get(date) || 0 };
  });
}

export interface StudentActivity {
  userId: string;
  visits: number;
  lastAt: string | null;
  streak: Streak;
  /** Active (visit finished) on each of the last 14 days, oldest first. */
  days: boolean[];
}

/** Finished recorded visits by students of the given courses (assignment visits in those courses, or their journey runs). */
export function courseVisits(courseIds: string[]) {
  if (!courseIds.length) return [];
  const q = courseIds.map(() => "?").join(",");
  return all<{ user_id: string; ended_at: string; assignment_id: string | null }>(
    `SELECT e.user_id, e.ended_at, COALESCE(e.assignment_id, jr.assignment_id) AS assignment_id
     FROM encounters e LEFT JOIN journey_runs jr ON jr.id = e.journey_run_id
     WHERE e.status IN ('scored','submitted') AND e.ended_at IS NOT NULL AND ${RECORDED_VISIT}
       AND COALESCE(e.assignment_id, jr.assignment_id) IN (SELECT id FROM assignments WHERE course_id IN (${q}))
       AND e.user_id IN (SELECT user_id FROM enrollments WHERE course_id IN (${q}))`,
    ...courseIds,
    ...courseIds,
  );
}

/** Per-student engagement and the class's own streak (consecutive days on which any student finished a recorded visit). */
export function classActivity(courseIds: string[]) {
  const rows = courseVisits(courseIds);
  const by = new Map<string, string[]>();
  for (const r of rows) by.set(r.user_id, [...(by.get(r.user_id) || []), r.ended_at]);
  const window = dayCounts([], 14).map((d) => d.date);
  const students = new Map<string, StudentActivity>();
  for (const [userId, dates] of by) {
    const set = new Set(dates.map(dayOf));
    students.set(userId, { userId, visits: dates.length, lastAt: dates.sort().at(-1) || null, streak: streakFrom(dates), days: window.map((d) => set.has(d)) });
  }
  const days = dayCounts(rows.map((r) => r.ended_at), 14);
  const weekAgo = window.slice(-7);
  const activeThisWeek = [...by.values()].filter((dates) => dates.some((d) => weekAgo.includes(dayOf(d)))).length;
  return { rows, students, days, classStreak: streakFrom(rows.map((r) => r.ended_at)), activeThisWeek, total: rows.length };
}
