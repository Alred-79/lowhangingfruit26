import { CalendarClock, ChevronRight, KeyRound, Plus, Route, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import AppShell from "@/components/AppShell";
import { JoinCode } from "@/components/courses/CourseTools";
import When from "@/components/courses/When";
import { classActivity } from "@/components/faculty/analytics";
import RosterActivity from "@/components/faculty/RosterActivity";
import { DayBars, HeatCell, HeatLegend, QuestStack } from "@/components/faculty/viz";
import { Count, FlameIcon, GameCell } from "@/components/game/hud";
import { Badge, Card, CardHeader, cx, Empty, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { assignmentOverviews, courseFor, describeSettings, TYPE_LABEL } from "@/lib/courses";
import { profession } from "@/lib/professions";

const v = (o: Record<string, string | number>) => o as CSSProperties;

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("faculty");
  const course = courseFor(user, (await params).id);
  if (!course) notFound();
  const roster = all<{ id: string; name: string; email: string; profession_id: string | null; created_at: string }>(
    "SELECT u.id, u.name, u.email, u.profession_id, en.created_at FROM enrollments en JOIN users u ON u.id = en.user_id WHERE en.course_id = ? ORDER BY u.name",
    course.id,
  );
  const assignments = assignmentOverviews(user, course.id);
  // Best score per student per assignment (a faculty adjustment replaces the rubric score).
  const best = new Map<string, number>();
  for (const r of all<{ user_id: string; assignment_id: string; s: number }>(
    `SELECT e.user_id, COALESCE(e.assignment_id, jr.assignment_id) AS assignment_id, MAX(COALESCE(e.faculty_score, e.score)) AS s
     FROM encounters e LEFT JOIN journey_runs jr ON jr.id = e.journey_run_id
     WHERE e.status = 'scored' AND COALESCE(e.assignment_id, jr.assignment_id) IN (SELECT id FROM assignments WHERE course_id = ?)
     GROUP BY e.user_id, COALESCE(e.assignment_id, jr.assignment_id)`,
    course.id,
  ))
    best.set(r.user_id + ":" + r.assignment_id, r.s);

  // Class quest progress: which patients of each assignment every enrolled student has finished (recorded visits by definition).
  const seenRows = all<{ user_id: string; assignment_id: string; case_id: string }>(
    `SELECT DISTINCT e.user_id, COALESCE(e.assignment_id, jr.assignment_id) AS assignment_id, e.case_id
     FROM encounters e LEFT JOIN journey_runs jr ON jr.id = e.journey_run_id
     WHERE e.status IN ('scored','submitted') AND COALESCE(e.assignment_id, jr.assignment_id) IN (SELECT id FROM assignments WHERE course_id = ?)
       AND e.user_id IN (SELECT user_id FROM enrollments WHERE course_id = ?)`,
    course.id,
    course.id,
  );
  const quests = assignments.map((o) => {
    const total = o.a.journey_id ? 1 : Math.max(1, o.a.caseIds.length);
    const per = new Map<string, Set<string>>();
    for (const r of seenRows) if (r.assignment_id === o.a.id && (o.a.journey_id || o.a.caseIds.includes(r.case_id))) per.set(r.user_id, (per.get(r.user_id) || new Set()).add(r.case_id));
    const buckets = Array.from({ length: total + 1 }, () => 0);
    for (const u of roster) buckets[Math.min(total, per.get(u.id)?.size || 0)]++;
    return { ...o, total, buckets, complete: buckets[total] };
  });

  const act = classActivity([course.id]);
  const rosterRows = roster.map((u) => {
    const s = act.students.get(u.id);
    const days = s?.days || Array.from({ length: 14 }, () => false);
    return { id: u.id, name: u.name, email: u.email, role: profession(u.profession_id).name, visits: s?.visits || 0, lastAt: s?.lastAt || null, streak: s?.streak.days || 0, days, activeThisWeek: days.slice(-7).some(Boolean) };
  });
  const done = (uid: string) => assignments.filter(({ a }) => best.has(uid + ":" + a.id)).length;

  return (
    <AppShell user={user}>
      <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-[12.5px] font-semibold text-ink-3">
        <Link href="/faculty/courses" className="hover:text-brand-700">
          Courses
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="truncate text-ink-2">{course.name}</span>
      </nav>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="rise font-display text-[30px] font-black leading-[1.04] tracking-[-0.035em] text-ink sm:text-[42px]">{course.name}</h1>
          <p className="rise mt-1.5 text-[15.5px] text-ink-2" style={v({ "--i": 1 })}>
            {course.profession_id ? `Students are training as ${profession(course.profession_id).name}.` : "Mixed / interprofessional course."}
          </p>
        </div>
        <LinkButton href={`/faculty/courses/${course.id}/assignments/new`}>
          <Plus className="h-4 w-4" aria-hidden />
          New assignment
        </LinkButton>
      </div>

      {/* ---------- Join code + class pulse ---------- */}
      <div className="grid gap-4 lg:grid-cols-12">
        <GameCell tone="ink" className="lg:col-span-6" i={0}>
          <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,oklch(0.86_0.2_128/0.28),transparent_65%)] breathe" aria-hidden />
          <h2 className="relative flex items-center gap-2 text-[13px] font-bold text-white/85">
            <KeyRound className="h-4 w-4 text-[var(--color-xp)]" aria-hidden />
            Join code
          </h2>
          <p className="relative mb-3 text-[13px] text-white/70">Students enter this on their home page. Click the code to copy it.</p>
          <div className="relative">
            <JoinCode courseId={course.id} code={course.join_code} />
          </div>
        </GameCell>
        <GameCell tone="brand" className="lg:col-span-3" i={1}>
          <p className="flex items-center gap-2 text-[13px] font-bold text-white/85">
            <Users className="h-4 w-4" aria-hidden />
            Students
          </p>
          <p className="font-display text-[56px] font-black leading-[0.95] tracking-[-0.045em]">
            <Count value={roster.length} />
          </p>
          <p className="text-[13px] font-semibold text-white/80">{act.activeThisWeek} active this week</p>
          <DayBars days={act.days} color="white" track="rgb(255 255 255 / 0.16)" dark h={36} className="mt-3" label={`Recorded visits finished per day over the last 14 days: ${act.days.map((d) => d.n).join(", ")}`} />
          <p className="mt-1 text-[11.5px] font-semibold text-white/70">Recorded visits · 14 days</p>
        </GameCell>
        <GameCell tone="flame" className="lg:col-span-3" i={2}>
          <p className="text-[13px] font-bold">Class streak</p>
          <div className="mt-1 flex items-end gap-2">
            <FlameIcon className={cx("h-12 w-10", act.classStreak.days > 0 && "flicker")} lit={act.classStreak.days > 0} />
            <span className="font-display text-[52px] font-black leading-[0.9] tracking-[-0.04em]">
              <Count value={act.classStreak.days} />
            </span>
            <span className="mb-1 text-[14px] font-bold">day{act.classStreak.days === 1 ? "" : "s"}</span>
          </div>
          <p className="mt-2 text-[12.5px] font-semibold">Consecutive days on which someone in this course finished an assignment visit. Best run {act.classStreak.best}.</p>
          <p className="mt-2 text-[12px] font-semibold opacity-80">Private practice never counts here.</p>
        </GameCell>
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          {/* ---------- Assignments as class quests ---------- */}
          <Card className="rise overflow-hidden" style={v({ "--i": 3 })}>
            <CardHeader title="Assignments" subtitle="Open one for its gradebook and class summary. Each bar shows how many students have seen how many of its patients." />
            {assignments.length === 0 ? (
              <div className="p-4">
                <Empty>
                  No assignments yet.{" "}
                  <Link href={`/faculty/courses/${course.id}/assignments/new`} className="font-medium text-brand-700 underline">
                    Create one
                  </Link>{" "}
                  by hand or with the guide.
                </Empty>
              </div>
            ) : (
              <ul className="divide-y divide-line/70">
                {quests.map(({ a, roster: n, submitted, inProgress, total, buckets, complete }, i) => (
                  <li key={a.id} className="rise" style={v({ "--i": 4 + i })}>
                    <Link href={`/faculty/courses/${course.id}/assignments/${a.id}`} className="group block px-5 py-4 transition-colors hover:bg-brand-50/50">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white clay", a.type === "exam" ? "bg-[var(--color-mastery)]" : a.type === "practice" ? "bg-ink" : "bg-brand-600")} aria-hidden>
                            {a.journey_id ? <Route className="h-5 w-5" /> : <span className="font-display text-[16px] font-black">{a.caseIds.length}</span>}
                          </span>
                          <div className="min-w-0">
                            <div className="font-display text-[17px] font-extrabold leading-tight text-ink group-hover:text-brand-700">{a.title}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
                              <Badge tone={a.type === "exam" ? "violet" : a.type === "practice" ? "slate" : "blue"}>{TYPE_LABEL[a.type]}</Badge>
                              {a.journey_id ? <Badge tone="teal">Care journey</Badge> : <span>{a.caseIds.length} patient{a.caseIds.length === 1 ? "" : "s"}</span>}
                              <span>· {describeSettings(a.settings)}</span>
                              {!a.feedback_released && <Badge tone="amber">Feedback held</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="text-[12.5px] text-ink-3 sm:text-right">
                          <div className="text-[14px] font-bold text-ink">
                            <span className="font-display text-[20px] font-black">{submitted}</span> of {n} submitted
                          </div>
                          <div className="inline-flex items-center gap-1">
                            {inProgress > 0 && `${inProgress} in progress · `}
                            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                            {a.due_at ? (
                              <>
                                Due <When at={a.due_at} />
                              </>
                            ) : (
                              "No due date"
                            )}
                          </div>
                        </div>
                      </div>
                      {n > 0 && (
                        <div className="mt-3 grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                          <QuestStack buckets={buckets} total={n} />
                          <p className="text-[12px] font-semibold text-ink-2">
                            <span className="font-mono font-bold text-ink">{complete}</span> of {n} saw all {total} · {buckets.slice(1, total).reduce((s, b) => s + b, 0)} partway · {buckets[0]} none yet
                          </p>
                        </div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {assignments.length > 0 && roster.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line/70 bg-surface-2/50 px-5 py-2.5 text-[12px] font-semibold text-ink-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-4 rounded-full bg-[var(--color-xp)]" aria-hidden />
                  saw every patient
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-4 rounded-full bg-[color-mix(in_oklch,var(--color-xp)_55%,var(--color-surface-2))]" aria-hidden />
                  partway
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-4 rounded-full bg-surface-2 ring-1 ring-inset ring-line" aria-hidden />
                  none yet
                </span>
              </div>
            )}
          </Card>

          {/* ---------- Gradebook as a heat grid ---------- */}
          <Card className="rise overflow-hidden" style={v({ "--i": 6 })}>
            <CardHeader title="Gradebook" subtitle="Best score per student for each assignment. A dash means nothing has been scored yet." action={<HeatLegend />} />
            {roster.length === 0 || assignments.length === 0 ? (
              <p className="px-5 py-6 text-[14px] text-ink-3">{roster.length === 0 ? "No students have joined yet." : "Add an assignment to start the gradebook."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[12px] text-ink-3">
                      <th className="sticky left-0 z-10 bg-surface px-5 py-2.5 font-bold">Student</th>
                      <th className="px-3 py-2.5 font-bold">Progress</th>
                      {assignments.map(({ a }) => (
                        <th key={a.id} className="max-w-[10rem] px-2 py-2.5 text-center font-bold">
                          <Link href={`/faculty/courses/${course.id}/assignments/${a.id}`} className="line-clamp-2 hover:text-brand-700" title={a.title}>
                            {a.title}
                          </Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {roster.map((u, ri) => {
                      const d = done(u.id);
                      return (
                        <tr key={u.id}>
                          <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-5 py-2 font-bold text-ink">{u.name}</td>
                          <td className="px-3 py-2">
                            <span className="flex min-w-[6.5rem] items-center gap-2">
                              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                                <span className="bar-grow block h-full rounded-full bg-[var(--color-xp)]" style={v({ width: `${Math.max(4, (d / assignments.length) * 100)}%`, "--delay": `${200 + ri * 50}ms` })} />
                              </span>
                              <span className="font-mono text-[12px] font-bold text-ink">
                                {d}/{assignments.length}
                              </span>
                            </span>
                          </td>
                          {assignments.map(({ a }, ci) => {
                            const s = best.get(u.id + ":" + a.id);
                            return (
                              <td key={a.id} className="px-2 py-2 text-center tabular-nums">
                                <HeatCell pct={s === undefined ? null : s} i={ri + ci} below={ri === 0} tip={s === undefined ? `${u.name}: nothing scored yet on ${a.title}` : `${u.name}: best ${Math.round(s)}% on ${a.title}`}>
                                  {s === undefined ? "–" : `${Math.round(s)}%`}
                                </HeatCell>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card className="rise overflow-hidden" style={v({ "--i": 5 })}>
          <CardHeader title={`Roster (${roster.length})`} subtitle="Recorded visits over the last 14 days. Private practice is never shown." />
          {roster.length === 0 ? <p className="px-4 py-6 text-[14px] text-ink-3">No students yet. Share the join code.</p> : <RosterActivity courseId={course.id} rows={rosterRows} />}
        </Card>
      </div>
    </AppShell>
  );
}
