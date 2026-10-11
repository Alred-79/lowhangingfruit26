import { ArrowRight, CalendarClock, Flag, GraduationCap, Radio, Route, ShieldAlert, Sparkles, UserRoundPen } from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import When from "@/components/courses/When";
import { Badge, Card, CardHeader, cx, Empty, LinkButton, PageHeader, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { assignmentOverviews, coursesOf, feedbackUrl, liveVisitCount, RECORDED_VISIT, reviewQueue, toDate, TYPE_LABEL } from "@/lib/courses";

const LINKS = [
  { href: "/faculty/cases", title: "Patient Studio", text: "Build, review and publish virtual patients.", Icon: UserRoundPen },
  { href: "/faculty/journeys", title: "Care Journeys", text: "One patient seen by several professions, with handoffs.", Icon: Route },
  { href: "/faculty/courses", title: "Courses", text: "Rosters, assignments and gradebooks.", Icon: GraduationCap },
  { href: "/faculty/live", title: "Live Visits", text: "Watch visits in progress, pause one and help.", Icon: Radio },
];
const nowMs = () => Date.now();

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
  const held = assignments.filter((x) => !x.a.feedback_released && x.submitted > 0);
  const queue = reviewQueue(user, 8);
  const queueTotal = reviewQueue(user, 200).length;
  const live = liveVisitCount();
  const published = get<{ n: number }>("SELECT COUNT(*) AS n FROM cases WHERE status = 'published'")!.n;
  // Assignment and care-journey visits only: self-started practice is private to the student.
  const recent = all<{ id: string; student: string; title: string; score: number | null; faculty_score: number | null; ended_at: string | null }>(
    `SELECT e.id, u.name AS student, c.title, e.score, e.faculty_score, e.ended_at FROM encounters e JOIN users u ON u.id = e.user_id JOIN cases c ON c.id = e.case_id
     WHERE e.status = 'scored' AND u.role = 'student' AND ${RECORDED_VISIT} ORDER BY e.ended_at DESC LIMIT 6`,
  );

  return (
    <AppShell user={user}>
      <PageHeader
        title={`Welcome, ${user.name}`}
        subtitle="What needs your attention across your courses."
        action={
          <>
            <LinkButton href="/faculty/cases/new" variant="secondary">
              <Sparkles className="h-4 w-4 text-brand-600" aria-hidden />
              New patient
            </LinkButton>
            <LinkButton href="/faculty/courses">New course or assignment</LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Visits needing review" value={queueTotal} note="Flagged by the rubric, not yet reviewed" href="#review" tone={queueTotal ? "alert" : "default"} />
        <Stat label="Live visits now" value={live} note="With live assist turned on" href="/faculty/live" tone={live ? "live" : "default"} />
        <Stat label="Courses" value={courses.length} note={`${students} student${students === 1 ? "" : "s"} enrolled`} href="/faculty/courses" />
        <Stat label="Assignments" value={assignments.length} note={`${due.length} due around now`} href="/faculty/courses" />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Card id="review" className="scroll-mt-6">
          <CardHeader title="Submissions needing review" subtitle="The rubric flags a visit when a safety concern is raised or a key domain scores 1. Adding a note or adjusted score clears it." />
          {queue.length === 0 ? (
            <p className="px-4 py-6 text-[14px] text-ink-3">No flagged visits are waiting for you.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {queue.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="flex min-w-0 gap-3">
                    <span className={cx("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", r.reasons.some((x) => /safety/i.test(x)) ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600")}>
                      {r.reasons.some((x) => /safety/i.test(x)) ? <ShieldAlert className="h-4 w-4" aria-hidden /> : <Flag className="h-4 w-4" aria-hidden />}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-ink">
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
                    {r.score !== null && <span className="font-mono text-[14px] font-semibold tabular-nums text-ink">{Math.round(r.score)}%</span>}
                    <LinkButton href={feedbackUrl(r.id)} variant="secondary" size="sm">
                      Review
                    </LinkButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {queueTotal > queue.length && <p className="border-t border-line px-4 py-2 text-[12.5px] text-ink-3">{queueTotal - queue.length} more in your assignment gradebooks.</p>}
        </Card>

        <Card>
          <CardHeader title="Assignments due" subtitle="Due in the next two weeks or in the past week." />
          {due.length === 0 ? (
            <p className="px-4 py-6 text-[14px] text-ink-3">{assignments.length ? "Nothing is due around now." : "You have not set any assignments yet. Open a course to create one."}</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {due.map(({ a, course, roster, submitted, inProgress }) => {
                const past = toDate(a.due_at!).getTime() < now;
                const pct = roster ? Math.round((submitted / roster) * 100) : 0;
                return (
                  <li key={a.id} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/faculty/courses/${a.course_id}/assignments/${a.id}`} className="block truncate text-[14px] font-semibold text-ink hover:text-brand-700">
                          {a.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
                          <Badge tone={a.type === "exam" ? "violet" : a.type === "practice" ? "slate" : "blue"}>{TYPE_LABEL[a.type]}</Badge>
                          <span>{course}</span>
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                            {past ? "Was due" : "Due"} <When at={a.due_at} />
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-[12.5px] text-ink-3">
                        <div className="text-[14px] font-semibold text-ink">
                          {submitted} of {roster} submitted
                        </div>
                        {inProgress > 0 && <div>{inProgress} in progress</div>}
                      </div>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200/80" role="img" aria-label={`${submitted} of ${roster} submitted`}>
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {held.length > 0 && (
            <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-950">
              Feedback is being held for{" "}
              {held.map(({ a }, i) => (
                <span key={a.id}>
                  {i > 0 && ", "}
                  <Link href={`/faculty/courses/${a.course_id}/assignments/${a.id}`} className="font-semibold underline">
                    {a.title}
                  </Link>
                </span>
              ))}
              . Students cannot see their results until you release it.
            </div>
          )}
        </Card>

        <Card>
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
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
                    <Link href={`/faculty/courses/${c.id}`} className="min-w-0 truncate text-[14px] font-semibold text-ink hover:text-brand-700">
                      {c.name}
                    </Link>
                    <span className="shrink-0 text-[12.5px] text-ink-3">
                      {n[0]?.roster ?? get<{ n: number }>("SELECT COUNT(*) AS n FROM enrollments WHERE course_id = ?", c.id)!.n} students · {n.length} assignment{n.length === 1 ? "" : "s"} · code <span className="rounded bg-surface-2 px-1 font-mono font-semibold text-ink">{c.join_code}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recently scored visits" subtitle="Across all students, newest first." />
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-[14px] text-ink-3">No assignment or care journey visit has been scored yet. Students&apos; private practice visits are not listed here.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link href={feedbackUrl(r.id)} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
                    <span className="min-w-0 truncate text-[14px] text-ink">
                      <span className="font-semibold">{r.student}</span> <span className="text-ink-3">· {r.title}</span>
                    </span>
                    <span className="shrink-0 text-[12.5px] text-ink-3">
                      <span className="font-mono text-[14px] font-semibold tabular-nums text-ink">{Math.round(r.faculty_score ?? r.score ?? 0)}%</span> · <When at={r.ended_at} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-[14px] font-semibold text-ink-2">Go to</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="press group flex gap-3 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand-300">
            <l.Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[14px] font-semibold text-ink">
                {l.title}
                <ArrowRight className="h-3.5 w-3.5 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-3">{l.text}</span>
              {l.href === "/faculty/cases" && <span className="mt-1.5 block text-[12.5px] font-medium text-ink-2">{published} published patient{published === 1 ? "" : "s"}</span>}
              {l.href === "/faculty/live" && <span className="mt-1.5 block text-[12.5px] font-medium text-ink-2">{live} in progress</span>}
            </span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
