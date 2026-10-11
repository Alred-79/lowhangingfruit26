import { ArrowRight, GraduationCap } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import AppShell from "@/components/AppShell";
import CreateCourse from "@/components/courses/CreateCourse";
import { classActivity } from "@/components/faculty/analytics";
import { DayBars } from "@/components/faculty/viz";
import { Card, CardHeader, Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { coursesOf } from "@/lib/courses";
import { profession, professions } from "@/lib/professions";

const v = (o: Record<string, string | number>) => o as CSSProperties;

export default async function CoursesPage() {
  const user = await requireUser("faculty");
  const courses = coursesOf(user).map((c) => ({
    ...c,
    students: get<{ n: number }>("SELECT COUNT(*) AS n FROM enrollments WHERE course_id = ?", c.id)!.n,
    assignments: get<{ n: number }>("SELECT COUNT(*) AS n FROM assignments WHERE course_id = ?", c.id)!.n,
    activity: classActivity([c.id]),
  }));
  return (
    <AppShell user={user}>
      <PageHeader title="Courses" subtitle="A course has a join code, a roster, assignments and a gradebook." />
      <Card className="rise mb-6 overflow-hidden" style={v({ "--i": 2 })}>
        <CardHeader title="Create a course" subtitle="Students join with a six-character code you share in class." />
        <CreateCourse professions={professions().map((p) => ({ id: p.id, name: p.name }))} />
      </Card>
      {courses.length === 0 ? (
        <Empty>You have no courses yet. Create one above, then add assignments to it.</Empty>
      ) : (
        <ul className="space-y-3">
          {courses.map((c, i) => (
            <li key={c.id} className="rise" style={v({ "--i": 3 + i })}>
              <Link href={`/faculty/courses/${c.id}`} className="lift press group grid gap-4 rounded-[22px] border border-line/80 bg-surface p-4 shadow-e1 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:p-5">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white clay">
                    <GraduationCap className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 font-display text-[19px] font-extrabold leading-tight text-ink group-hover:text-brand-700">
                      <span className="truncate">{c.name}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                    <span className="mt-0.5 block text-[13px] text-ink-3">{c.profession_id ? profession(c.profession_id).name : "Mixed / interprofessional"}</span>
                    <span className="mt-1 block text-[13px] font-semibold text-ink-2">
                      {c.students} student{c.students === 1 ? "" : "s"} · {c.assignments} assignment{c.assignments === 1 ? "" : "s"} · {c.activity.activeThisWeek} active this week
                    </span>
                  </span>
                </span>
                <span className="w-full sm:w-44">
                  <span className="mb-1 block text-[11.5px] font-bold text-ink-3">Recorded visits · 14 days</span>
                  <DayBars days={c.activity.days} h={32} label={`Recorded visits per day over the last 14 days: ${c.activity.days.map((d) => d.n).join(", ")}`} />
                </span>
                <span className="flex items-center gap-2 text-[12px] font-bold text-ink-3">
                  Join code
                  <span className="rounded-xl bg-ink px-3 py-1.5 font-mono text-[18px] font-black tracking-[0.22em] text-[var(--color-xp)]">{c.join_code}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
