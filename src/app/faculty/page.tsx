import { ArrowRight, BookOpenCheck, ClipboardCheck, Flag, GraduationCap, Radio, Route, ShieldAlert, Sparkles, UserRoundPen, Users } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import AppShell from "@/components/AppShell";
import When from "@/components/courses/When";
import { classActivity, dayOf } from "@/components/faculty/analytics";
import DueBoard from "@/components/faculty/DueBoard";
import { DayBars, ScoreRing, Spark } from "@/components/faculty/viz";
import { Count, FlameIcon, GameCell } from "@/components/game/hud";
import { Badge, Card, CardHeader, cx, Empty, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all, get, parse } from "@/lib/db";
import { assignmentOverviews, coursesOf, feedbackUrl, liveVisitCount, RECORDED_VISIT, reviewQueue, toDate, TYPE_LABEL } from "@/lib/courses";
import type { EncounterConfig, EncounterState } from "@/lib/types";

const LINKS = [
  { href: "/faculty/cases", title: "Patient Studio", text: "Build, review and publish virtual patients.", Icon: UserRoundPen, tone: "bg-[var(--color-mastery)] text-white" },
  { href: "/faculty/journeys", title: "Care Journeys", text: "One patient seen by several professions, with handoffs.", Icon: Route, tone: "bg-[var(--color-tier-initial)] text-white" },
  { href: "/faculty/courses", title: "Courses", text: "Rosters, assignments and gradebooks.", Icon: GraduationCap, tone: "bg-brand-600 text-white" },
  { href: "/faculty/live", title: "Live Visits", text: "Watch visits in progress, pause one and help.", Icon: Radio, tone: "bg-[var(--color-live)] text-white" },
];
const nowMs = () => Date.now();
const v = (o: Record<string, string | number>) => o as CSSProperties;

export default async function FacultyHome() {
  const user = await requireUser("faculty");
  const courses = coursesOf(user);
  const students = courses.length
    ? get<{ n: number }>(`SELECT COUNT(DISTINCT user_id) AS n FROM enrollments WHERE course_id IN (${courses.map(() => "?").join(",")})`, ...courses.map((c) => c.id))!.n
    : 0;
  const assignments = assignmentOverviews(user);
  const now = nowMs();
  const week = 7 * 24 * 3600 * 1000;
  // Due in the next two weeks, or recently due and still missing submissions.
  const due = assignments
    .filter((x) => x.a.due_at)
    .filter((x) => {
      const t = toDate(x.a.due_at!).getTime();
      return t > now - week && t < now + 2 * week;
    })
    .slice(0, 8);
  const dueThisWeek = due.filter((x) => {
    const t = toDate(x.a.due_at!).getTime();
    return t >= now && t < now + week;
  });
  const held = assignments.filter((x) => !x.a.feedback_released && x.submitted > 0);
  const queue = reviewQueue(user, 8);
  const queueAll = reviewQueue(user, 200);
  const queueTotal = queueAll.length;
  const live = liveVisitCount();
  const published = get<{ n: number }>("SELECT COUNT(*) AS n FROM cases WHERE status = 'published'")!.n;
  // Assignment and care-journey visits only: self-started practice is private to the student.
  const recent = all<{ id: string; student: string; title: string; score: number | null; faculty_score: number | null; ended_at: string | null }>(
    `SELECT e.id, u.name AS student, c.title, e.score, e.faculty_score, e.ended_at FROM encounters e JOIN users u ON u.id = e.user_id JOIN cases c ON c.id = e.case_id
     WHERE e.status = 'scored' AND u.role = 'student' AND ${RECORDED_VISIT} ORDER BY e.ended_at DESC LIMIT 6`,
  );
  // The live visits behind the count, with each patient's comfort so far (same rule as liveVisitCount: recorded, live assist on, last 3 hours).
  const liveNow = all<{ id: string; student: string; config: string; state: string; status: string }>(
    `SELECT e.id, u.name AS student, e.config, e.state, e.status FROM encounters e JOIN users u ON u.id = e.user_id
     WHERE e.status IN ('active','paused') AND e.started_at > datetime('now','-3 hours') AND ${RECORDED_VISIT} ORDER BY e.started_at DESC`,
  )
    .filter((r) => parse<Partial<EncounterConfig>>(r.config, {}).liveAssist)
    .map((r) => {
      const st = parse<Partial<EncounterState>>(r.state, {});
      const hist = [...(st.rapportHistory || []), st.rapport ?? 50];
      return { id: r.id, student: r.student, paused: r.status === "paused", turn: st.turn ?? 0, comfort: hist };
    });
  const activity = classActivity(courses.map((c) => c.id));
  const reviewDays = activity.days.map((d) => ({ date: d.date, n: queueAll.filter((q) => q.ended_at && dayOf(q.ended_at) === d.date).length }));
  const first = user.name.replace(/^Dr\.?\s+/, "").split(" ")[0];

  return (
    <AppShell user={user}>
      {/* ---------- Header: greeting, counts as links, primary actions ---------- */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="rise font-display text-[32px] font-black leading-[1.02] tracking-[-0.035em] text-ink sm:text-[44px]">Welcome, {user.name}</h1>
          <p className="rise mt-1.5 text-[15.5px] text-ink-2" style={v({ "--i": 1 })}>
            What needs your attention across your courses.
          </p>
          <nav aria-label="Counts" className="rise mt-3 flex flex-wrap gap-2" style={v({ "--i": 2 })}>
            <Link href="/faculty/courses" className="press inline-flex min-h-9 items-center gap-2 rounded-full bg-surface px-3.5 text-[13px] font-bold text-ink ring-1 ring-inset ring-line hover:ring-brand-300 pointer-coarse:min-h-11">
              <GraduationCap className="h-4 w-4 text-brand-600" aria-hidden />
              <span className="font-display text-[16px] font-black">{courses.length}</span> Course{courses.length === 1 ? "" : "s"}
              <span className="font-semibold text-ink-3">
                · {students} student{students === 1 ? "" : "s"} enrolled
              </span>
            </Link>
            <Link href="/faculty/courses" className="press inline-flex min-h-9 items-center gap-2 rounded-full bg-surface px-3.5 text-[13px] font-bold text-ink ring-1 ring-inset ring-line hover:ring-brand-300 pointer-coarse:min-h-11">
              <BookOpenCheck className="h-4 w-4 text-[var(--color-tier-initial)]" aria-hidden />
              <span className="font-display text-[16px] font-black">{assignments.length}</span> Assignment{assignments.length === 1 ? "" : "s"}
              <span className="font-semibold text-ink-3">· {due.length} due around now</span>
            </Link>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href="/faculty/cases/new" variant="secondary">
            <Sparkles className="h-4 w-4 text-brand-600" aria-hidden />
            New patient
          </LinkButton>
          <LinkButton href="/faculty/courses">New course or assignment</LinkButton>
        </div>
      </div>

      {/* ---------- Attention first: live now, needs review, class streak, due soon ---------- */}
      <div className="grid gap-4 lg:grid-cols-12">
        <GameCell tone="ink" className="lg:col-span-5 lg:row-span-2" i={0}>
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,oklch(0.64_0.23_18/0.45),transparent_65%)] breathe" aria-hidden />
          <div className="relative flex items-start justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-[13px] font-bold text-white/85">
              <span className={cx("h-2.5 w-2.5 rounded-full", live ? "live-dot bg-[var(--color-live)]" : "bg-white/40")} aria-hidden />
              Live visits now
            </p>
            <Link href="/faculty/live" className="press inline-flex min-h-9 items-center gap-1 rounded-full bg-white/15 px-3 text-[12.5px] font-bold text-white ring-1 ring-white/25 hover:bg-white/25 pointer-coarse:min-h-11">
              Open console
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <Link href="/faculty/live" className="relative mt-1 block w-fit font-display text-[88px] font-black leading-[0.9] tracking-[-0.05em] hover:text-[var(--color-xp)]">
            <Count value={live} />
          </Link>
          <p className="relative text-[13.5px] font-semibold text-white/75">With live assist turned on</p>
          {liveNow.length ? (
            <ul className="relative mt-4 space-y-2">
              {liveNow.slice(0, 4).map((l, i) => (
                <li key={l.id}>
                  <Link href={`/faculty/live?visit=${l.id}`} className="press flex items-center gap-3 rounded-2xl bg-white/[0.08] px-3 py-2.5 ring-1 ring-white/10 transition-colors hover:bg-white/[0.14]">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--color-live)] font-display text-[13px] font-black">{l.student.slice(0, 1)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold">{l.student}</span>
                      <span className="block text-[12px] text-white/65">
                        {l.paused ? "Paused" : "Live"} · turn {l.turn} · comfort {Math.round(l.comfort[l.comfort.length - 1])}
                      </span>
                    </span>
                    <Spark values={l.comfort} min={Math.max(0, Math.min(...l.comfort) - 10)} max={Math.min(100, Math.max(...l.comfort) + 10)} w={96} h={30} color="var(--color-xp)" ring="var(--color-ink)" live={!l.paused} className="h-8 w-24 shrink-0" label={`Patient comfort over the visit, now ${Math.round(l.comfort[l.comfort.length - 1])}`} i={i} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="relative mt-4 rounded-2xl bg-white/[0.08] px-3.5 py-3 text-[13.5px] text-white/80">Nobody is in a live-assist visit right now. Turn on Live assist in an assignment to watch visits as they happen.</p>
          )}
        </GameCell>

        <GameCell tone="brand" className="lg:col-span-4" i={1}>
          <a href="#review" className="block">
            <p className="flex items-center gap-2 text-[13px] font-bold text-white/85">
              <ClipboardCheck className="h-4 w-4" aria-hidden />
              Visits needing review
            </p>
            <div className="mt-1 flex items-end justify-between gap-4">
              <span className="font-display text-[64px] font-black leading-[0.9] tracking-[-0.045em]">
                <Count value={queueTotal} />
              </span>
              <DayBars days={reviewDays} color="white" track="rgb(255 255 255 / 0.16)" dark className="mb-1 w-36" label={`Flagged visits per day over the last 14 days: ${reviewDays.map((d) => d.n).join(", ")}`} />
            </div>
            <p className="mt-1.5 text-[13px] text-white/80">Flagged by the rubric, not yet reviewed · last 14 days</p>
          </a>
        </GameCell>

        <GameCell tone="flame" className="lg:col-span-3" i={2}>
          <p className="text-[13px] font-bold">Class streak</p>
          <div className="mt-1 flex items-end gap-2">
            <FlameIcon className={cx("h-14 w-11", activity.classStreak.days > 0 && "flicker")} lit={activity.classStreak.days > 0} />
            <span className="font-display text-[56px] font-black leading-[0.9] tracking-[-0.04em]">
              <Count value={activity.classStreak.days} />
            </span>
            <span className="mb-1 text-[14px] font-bold">day{activity.classStreak.days === 1 ? "" : "s"}</span>
          </div>
          <p className="mt-1.5 text-[12.5px] font-semibold">In a row with a recorded visit. Private practice never counts.</p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/50 px-2.5 py-1 text-[12.5px] font-bold">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {activity.activeThisWeek} of {students} active this week
          </p>
        </GameCell>

        <GameCell tone="xp" className="lg:col-span-7" i={3}>
          <a href="#due" className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              <p className="text-[13px] font-bold">Due this week</p>
              <span className="font-display text-[56px] font-black leading-[0.9] tracking-[-0.045em]">
                <Count value={dueThisWeek.length} />
              </span>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {dueThisWeek.length ? (
                dueThisWeek.slice(0, 3).map(({ a, roster, submitted }, i) => (
                  <div key={a.id}>
                    <div className="flex items-baseline justify-between gap-2 text-[12.5px] font-bold">
                      <span className="truncate">{a.title}</span>
                      <span className="shrink-0 font-mono">
                        {submitted}/{roster}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/50">
                      <div className="bar-grow h-full rounded-full bg-ink" style={v({ width: `${roster ? Math.max(3, (submitted / roster) * 100) : 3}%`, "--delay": `${300 + i * 80}ms` })} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[13.5px] font-semibold">Nothing is due in the next seven days.</p>
              )}
            </div>
            <div className="w-full sm:w-auto">
              <p className="mb-1 text-[12px] font-bold">Recorded visits · 14 days</p>
              <DayBars days={activity.days} color="var(--color-ink)" track="rgb(255 255 255 / 0.45)" className="w-full sm:w-40" label={`Recorded visits finished per day over the last 14 days: ${activity.days.map((d) => d.n).join(", ")}`} />
            </div>
          </a>
        </GameCell>
      </div>

      {/* ---------- Review queue + due list ---------- */}
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card id="review" className="rise scroll-mt-6 overflow-hidden" style={v({ "--i": 4 })}>
          <CardHeader title="Submissions needing review" subtitle="The rubric flags a visit when a safety concern is raised or a key domain scores 1. Adding a note or adjusted score clears it." />
          {queue.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-6">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--color-xp-soft)] text-[var(--color-xp-ink)]">
                <ClipboardCheck className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-[14px] text-ink-3">No flagged visits are waiting for you.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line/70">
              {queue.map((r, i) => {
                const safety = r.reasons.some((x) => /safety/i.test(x));
                return (
                  <li key={r.id} className="rise flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:flex-nowrap" style={v({ "--i": 5 + i })}>
                    <div className="flex min-w-0 gap-3">
                      <span className={cx("mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-2xl", safety ? "bg-[var(--color-tier-hidden-soft)] text-[var(--color-tier-hidden-ink)]" : "bg-[var(--color-tier-reluctant-soft)] text-[var(--color-tier-reluctant-ink)]")}>
                        {safety ? <ShieldAlert className="h-5 w-5" aria-hidden /> : <Flag className="h-5 w-5" aria-hidden />}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[14.5px] font-bold text-ink">
                          {r.student} <span className="font-normal text-ink-3">· {r.title}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
                          {r.reasons.map((x) => (
                            <Badge key={x} tone={/safety/i.test(x) ? "red" : "amber"}>
                              {x}
                            </Badge>
                          ))}
                          <span>
                            {r.assignment || "Independent practice"} · <When at={r.ended_at} />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {r.score !== null && <ScoreRing value={r.score} size={44} label={`${Math.round(r.score)}%`} />}
                      <LinkButton href={feedbackUrl(r.id)} variant="secondary" size="sm">
                        Review
                      </LinkButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {queueTotal > queue.length && <p className="border-t border-line px-5 py-2.5 text-[12.5px] text-ink-3">{queueTotal - queue.length} more in your assignment gradebooks.</p>}
        </Card>

        <Card id="due" className="rise scroll-mt-6 overflow-hidden" style={v({ "--i": 5 })}>
          <CardHeader title="Assignments due" subtitle="Due in the next two weeks or in the past week." />
          <DueBoard
            empty={assignments.length ? "Nothing is due around now." : "You have not set any assignments yet. Open a course to create one."}
            items={due.map(({ a, course, roster, submitted, inProgress }) => ({ id: a.id, courseId: a.course_id, title: a.title, type: a.type, typeLabel: TYPE_LABEL[a.type], course, dueAt: a.due_at!, past: toDate(a.due_at!).getTime() < now, roster, submitted, inProgress }))}
          />
          {held.length > 0 && (
            <div className="m-4 mt-1 flex gap-2.5 rounded-2xl bg-[var(--color-tier-reluctant-soft)] px-3.5 py-3 text-[13px] text-ink">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-tier-reluctant-ink)]" aria-hidden />
              <p>
                Feedback is being held for{" "}
                {held.map(({ a }, i) => (
                  <span key={a.id}>
                    {i > 0 && ", "}
                    <Link href={`/faculty/courses/${a.course_id}/assignments/${a.id}`} className="font-bold underline">
                      {a.title}
                    </Link>
                  </span>
                ))}
                . Students cannot see their results until you release it.
              </p>
            </div>
          )}
        </Card>

        <Card className="rise overflow-hidden" style={v({ "--i": 6 })}>
          <CardHeader title="Your courses" action={<LinkButton href="/faculty/courses" variant="secondary" size="sm">All courses</LinkButton>} />
          {courses.length === 0 ? (
            <div className="p-4">
              <Empty>
                No courses yet.{" "}
                <Link href="/faculty/courses" className="font-medium text-brand-700 underline">
                  Create your first course
                </Link>{" "}
                to get a join code for students.
              </Empty>
            </div>
          ) : (
            <ul className="divide-y divide-line/70">
              {courses.slice(0, 6).map((c) => {
                const n = assignments.filter((x) => x.a.course_id === c.id);
                return (
                  <li key={c.id}>
                    <Link href={`/faculty/courses/${c.id}`} className="group flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3.5 transition-colors hover:bg-brand-50/60">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white clay">
                          <GraduationCap className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14.5px] font-bold text-ink group-hover:text-brand-700">{c.name}</span>
                          <span className="block text-[12.5px] text-ink-3">
                            {n[0]?.roster ?? get<{ n: number }>("SELECT COUNT(*) AS n FROM enrollments WHERE course_id = ?", c.id)!.n} students · {n.length} assignment{n.length === 1 ? "" : "s"}
                          </span>
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-ink-3">
                        code
                        <span className="rounded-lg bg-ink px-2 py-1 font-mono text-[14px] font-black tracking-[0.18em] text-[var(--color-xp)]">{c.join_code}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="rise overflow-hidden" style={v({ "--i": 7 })}>
          <CardHeader title="Recently scored visits" subtitle="Across all students, newest first." />
          {recent.length === 0 ? (
            <p className="px-5 py-6 text-[14px] text-ink-3">No assignment or care journey visit has been scored yet. Students&apos; private practice visits are not listed here.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={feedbackUrl(r.id)} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-brand-50/60">
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] text-ink">
                        <span className="font-bold">{r.student}</span> <span className="text-ink-3">· {r.title}</span>
                      </span>
                      <span className="block text-[12.5px] text-ink-3">
                        <When at={r.ended_at} />
                      </span>
                    </span>
                    <ScoreRing value={r.faculty_score ?? r.score ?? 0} size={40} label={`${Math.round(r.faculty_score ?? r.score ?? 0)}%`} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <nav aria-label="Go to" className="mt-8">
        <h2 className="mb-3 font-display text-[18px] font-extrabold tracking-[-0.02em] text-ink">Go to</h2>
        <ul className="divide-y divide-line/70 overflow-hidden rounded-[20px] border border-line/80 bg-surface shadow-e1 sm:grid sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          {LINKS.map((l) => (
            <li key={l.href} className="sm:border-r sm:border-line/70 sm:last:border-r-0">
              <Link href={l.href} className="group flex h-full items-start gap-3 px-4 py-3.5 transition-colors hover:bg-brand-50/60">
                <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl clay", l.tone)}>
                  <l.Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[14.5px] font-bold text-ink">
                    {l.title}
                    <ArrowRight className="h-3.5 w-3.5 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-3">
                    {l.text}
                    {l.href === "/faculty/cases" && <span className="font-semibold text-ink-2"> {published} published patient{published === 1 ? "" : "s"}.</span>}
                    {l.href === "/faculty/live" && <span className="font-semibold text-ink-2"> {live} in progress.</span>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </AppShell>
  );
}
