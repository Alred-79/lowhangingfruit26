import { ChevronRight, ClipboardCheck, Download, Eye, EyeOff, FileText, Pencil, Target, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import AppShell from "@/components/AppShell";
import { BarList } from "@/components/courses/charts";
import { DeleteAssignment, ReleaseFeedback } from "@/components/courses/CourseTools";
import When from "@/components/courses/When";
import GradebookTable from "@/components/faculty/GradebookTable";
import { HeatCell, HeatLegend, QuestStack, ScoreRing } from "@/components/faculty/viz";
import { Count, GameCell } from "@/components/game/hud";
import { domainLabel } from "@/components/game/derive";
import { Badge, Card, CardHeader, cx, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { assignmentFor, describeSettings, gradebook, TYPE_LABEL } from "@/lib/courses";

const v = (o: Record<string, string | number>) => o as CSSProperties;

export default async function AssignmentPage({ params }: { params: Promise<{ id: string; aid: string }> }) {
  const user = await requireUser("faculty");
  const { id, aid } = await params;
  const found = assignmentFor(user, aid);
  if (!found || found.course.id !== id) notFound();
  const { a, course } = found;
  const g = gradebook(a);
  const { insights } = g;
  const journey = a.journey_id ? get<{ title: string }>("SELECT title FROM journeys WHERE id = ?", a.journey_id) : null;
  const enrolledRows = g.rows.filter((r) => r.enrolled);
  const students = new Set(enrolledRows.map((r) => r.userId)).size;
  const studentsDone = new Set(enrolledRows.filter((r) => r.attempts.length).map((r) => r.userId)).size;
  const bests = g.rows.map((r) => r.best).filter((x): x is number => x !== null);
  const avg = bests.length ? Math.round(bests.reduce((s, x) => s + x, 0) / bests.length) : null;
  const held = !a.feedback_released;
  const started = g.rows.some((r) => r.attempts.length || r.inProgress);
  const multiCase = new Set(g.rows.map((r) => r.caseId)).size > 1;
  // Class quest progress: patients each enrolled student has finished (a finished attempt on that patient).
  const patients = Math.max(1, new Set(g.rows.map((r) => r.caseId)).size);
  const seenBy = new Map<string, number>();
  for (const r of enrolledRows) seenBy.set(r.userId, (seenBy.get(r.userId) || 0) + (r.attempts.some((x) => x.final !== null || x.score !== null) ? 1 : 0));
  const buckets = Array.from({ length: patients + 1 }, () => 0);
  for (const n of seenBy.values()) buckets[Math.min(patients, n)]++;

  return (
    <AppShell user={user}>
      <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1 text-[12.5px] font-semibold text-ink-3">
        <Link href="/faculty/courses" className="hover:text-brand-700">
          Courses
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <Link href={`/faculty/courses/${course.id}`} className="hover:text-brand-700">
          {course.name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="text-ink-2">{a.title}</span>
      </nav>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="rise font-display text-[30px] font-black leading-[1.04] tracking-[-0.035em] text-ink sm:text-[40px]">{a.title}</h1>
          <div className="rise mt-2 flex flex-wrap items-center gap-1.5 text-[14px] text-ink-2" style={v({ "--i": 1 })}>
            <Badge tone={a.type === "exam" ? "violet" : a.type === "practice" ? "slate" : "blue"}>{TYPE_LABEL[a.type]}</Badge>
            {journey && <Badge tone="teal">Care journey: {journey.title}</Badge>}
            <span>{describeSettings(a.settings)}</span>
            <span>
              ·{" "}
              {a.due_at ? (
                <>
                  Due <When at={a.due_at} />
                </>
              ) : (
                "No due date"
              )}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!started && <DeleteAssignment assignmentId={a.id} courseId={course.id} />}
          <LinkButton href={`/faculty/courses/${course.id}/assignments/${a.id}/edit`} variant="secondary" size="sm">
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit
          </LinkButton>
          <a href={`/api/assignments/${a.id}/csv`} download className="press inline-flex min-h-8 items-center gap-1.5 rounded-[10px] bg-surface px-3 text-[13px] font-semibold text-ink shadow-e1 ring-1 ring-inset ring-line-strong/50 hover:bg-brand-50 hover:ring-brand-300 pointer-coarse:min-h-11">
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export grades (CSV)
          </a>
          {(a.settings.feedbackRelease === "manual" || held) && <ReleaseFeedback assignmentId={a.id} released={!held} />}
        </div>
      </div>

      {held && (
        <div className="rise mb-4 flex items-start gap-3 rounded-2xl bg-[var(--color-tier-reluctant-soft)] px-4 py-3 text-[14px] text-ink" style={v({ "--i": 2 })}>
          <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-tier-reluctant-ink)]" aria-hidden />
          <p>Feedback is held. Students can submit, but they cannot see scores or feedback until you press Release feedback.</p>
        </div>
      )}
      {a.instructions && (
        <div className="rise mb-5 flex max-w-4xl gap-3 rounded-2xl bg-surface px-4 py-3.5 ring-1 ring-inset ring-line" style={v({ "--i": 2 })}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-tier-discoverable-soft)] text-[var(--color-tier-discoverable-ink)]">
            <FileText className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div>
            <p className="text-[12.5px] font-bold text-ink-3">Instructions shown to students</p>
            <p className="mt-0.5 whitespace-pre-line text-[14px] leading-relaxed text-ink-2">{a.instructions}</p>
          </div>
        </div>
      )}

      {/* ---------- The four numbers, visualized ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
        <GameCell tone="brand" className="lg:col-span-4" i={3}>
          <p className="flex items-center gap-2 text-[13px] font-bold text-white/85">
            <Users className="h-4 w-4" aria-hidden />
            Students submitted
          </p>
          <p className="mt-1 font-display text-[52px] font-black leading-[0.95] tracking-[-0.04em]">
            <Count value={studentsDone} />
            <span className="text-[24px] text-white/70"> of {students}</span>
          </p>
          {students === 0 ? (
            <p className="text-[12.5px] text-white/80">No students enrolled yet</p>
          ) : (
            <div className="mt-3 rounded-xl bg-white/10 p-2.5">
              <QuestStack buckets={buckets} total={students} />
              <p className="mt-1.5 text-[12px] font-semibold text-white/85">
                {buckets[patients]} saw all {patients} patient{patients === 1 ? "" : "s"} · {buckets[0]} none yet
              </p>
            </div>
          )}
        </GameCell>
        <GameCell tone="ink" className="lg:col-span-3" i={4}>
          <p className="flex items-center gap-2 text-[13px] font-bold text-white/85">
            <Target className="h-4 w-4 text-[var(--color-xp)]" aria-hidden />
            Average best score
          </p>
          <div className="mt-2 flex items-center gap-3">
            {avg === null ? <span className="font-display text-[52px] font-black leading-none">–</span> : <ScoreRing value={avg} size={84} label={`${avg}%`} className="[&_circle:first-child]:stroke-white/15 [&>span]:text-white" />}
            <p className="text-[12.5px] text-white/75">{bests.length ? `Across ${bests.length} scored ${bests.length === 1 ? "submission" : "submissions"}` : "Nothing scored yet"}</p>
          </div>
        </GameCell>
        <GameCell tone={g.needsReview ? "flame" : "xp"} className="lg:col-span-2" i={5}>
          <p className="flex items-center gap-2 text-[13px] font-bold">
            <ClipboardCheck className="h-4 w-4" aria-hidden />
            Needs your review
          </p>
          <p className="mt-1 font-display text-[52px] font-black leading-[0.95] tracking-[-0.04em]">
            <Count value={g.needsReview} />
          </p>
          <p className="text-[12.5px] font-semibold">Flagged by the rubric, no note yet</p>
        </GameCell>
        <section className={cx("rise relative overflow-hidden rounded-[26px] p-5 ring-1 ring-inset sm:p-6 lg:col-span-3", held ? "bg-[var(--color-tier-reluctant-soft)] ring-[color-mix(in_oklch,var(--color-tier-reluctant)_30%,transparent)]" : "bg-[var(--color-tier-initial-soft)] ring-[color-mix(in_oklch,var(--color-tier-initial)_30%,transparent)]")} style={v({ "--i": 6 })}>
          <p className="text-[13px] font-bold text-ink-2">Feedback</p>
          <p className={cx("mt-1 flex items-center gap-2 font-display text-[34px] font-black leading-none tracking-[-0.03em]", held ? "text-[var(--color-tier-reluctant-ink)]" : "text-[var(--color-tier-initial-ink)]")}>
            {held ? <EyeOff className="h-7 w-7" aria-hidden /> : <Eye className="h-7 w-7" aria-hidden />}
            {held ? "Held" : "Released"}
          </p>
          <p className="mt-2 text-[12.5px] text-ink-2">{a.settings.feedbackRelease === "manual" ? "Released by you" : "Shown as soon as a visit is scored"}</p>
        </section>
      </div>

      <h2 className="mb-3 mt-8 font-display text-[22px] font-extrabold tracking-[-0.02em] text-ink">What to reteach</h2>
      {insights.scored === 0 ? (
        <Card className="flex items-center gap-3 p-5">
          <span className="float-idle grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--color-mastery-soft)] text-[var(--color-mastery-ink)]">
            <Target className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-[14px] text-ink-3">The class summary appears once the first visit has been scored. It shows which rubric domains are weakest and which findings students most often miss.</p>
        </Card>
      ) : (
        <>
          {/* Rubric domain heat strip: one cell per domain, weakest first, the class average as text. */}
          <Card className="rise mb-5 p-5" style={v({ "--i": 7 })}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-bold text-ink-2">Rubric domains at a glance, weakest first</p>
              <HeatLegend />
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
              {insights.domains.map((d, i) => (
                <HeatCell key={d.key} pct={d.avgPct} i={i} className="!flex min-h-[4.5rem] w-full flex-col items-start justify-between !rounded-2xl p-2.5 text-left" tip={`${d.name}: class average ${d.avgPct}% from ${d.n} scored visit${d.n === 1 ? "" : "s"}`}>
                  <span className="font-sans text-[12px] font-bold leading-tight opacity-90">{domainLabel(d.key)}</span>
                  <span className="font-display text-[24px] font-black leading-none">{d.avgPct}%</span>
                </HeatCell>
              ))}
            </div>
          </Card>
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Card className="rise" style={v({ "--i": 8 })}>
              <CardHeader title="Rubric domains, weakest first" subtitle={`Class average for each domain as a percentage of full marks, from each student's latest scored visit (${insights.scored} in total).`} />
              <div className="p-2">
                <BarList
                  unit="Class average by rubric domain"
                  items={insights.domains.map((d) => ({
                    key: d.key,
                    label: d.name,
                    sub: d.low ? `${d.low} of ${d.n} scored in the bottom half` : undefined,
                    value: d.avgPct,
                    display: `${d.avgPct}%`,
                    detail: `Average of ${d.n} scored visit${d.n === 1 ? "" : "s"}`,
                  }))}
                />
              </div>
            </Card>
            <Card className="rise" style={v({ "--i": 9 })}>
              <CardHeader title="Findings most often missed" subtitle="Critical and important findings the patient never disclosed, by share of scored students. Taken from the disclosure record, not from a model's judgement." />
              <div className="p-2">
                {insights.missed.length === 0 ? (
                  <p className="px-2 py-4 text-[14px] text-ink-3">No critical or important finding was missed.</p>
                ) : (
                  <BarList
                    unit="Share of students who missed each finding"
                    items={insights.missed.slice(0, 6).map((m) => ({
                      key: m.key,
                      label: m.chart,
                      sub: multiCase ? m.caseTitle : `Topic: ${m.topic}`,
                      tag: { text: m.importance === "critical" ? "Critical" : "Important", tone: m.importance === "critical" ? "red" : "amber" },
                      value: (m.count / m.of) * 100,
                      display: `${m.count} of ${m.of}`,
                      detail: `Missed by ${Math.round((m.count / m.of) * 100)}% of students scored on this patient`,
                    }))}
                  />
                )}
                {insights.missed.length > 6 && <p className="px-2 pb-1 pt-2 text-[12.5px] text-ink-3">{insights.missed.length - 6} more findings were missed by fewer students.</p>}
              </div>
              {insights.actionsMissed.length > 0 && (
                <div className="border-t border-line/70 p-2">
                  <div className="px-2 pb-1 pt-2 text-[12.5px] font-bold text-ink-2">Exams and orders most often skipped</div>
                  <BarList
                    unit="Share of students who skipped each exam or order"
                    items={insights.actionsMissed.slice(0, 4).map((m) => ({
                      key: m.key,
                      label: m.name,
                      sub: multiCase ? m.caseTitle : undefined,
                      tag: { text: m.importance === "critical" ? "Critical" : "Important", tone: m.importance === "critical" ? "red" : "amber" },
                      value: (m.count / m.of) * 100,
                      display: `${m.count} of ${m.of}`,
                    }))}
                  />
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      <h2 className="mb-3 mt-8 font-display text-[22px] font-extrabold tracking-[-0.02em] text-ink">Gradebook</h2>
      <Card className="rise overflow-hidden" style={v({ "--i": 10 })}>
        {g.rows.length === 0 ? (
          <p className="px-5 py-6 text-[14px] text-ink-3">No students are enrolled in this course yet. Share the join code from the course page.</p>
        ) : (
          <GradebookTable rows={g.rows} domainCols={g.domainCols} multiCase={multiCase} />
        )}
        <p className="border-t border-line/70 bg-surface-2/50 px-5 py-2.5 text-[12.5px] text-ink-3">
          Domain columns show the latest scored attempt. Scores are a percentage of rubric marks; when you set an adjusted score on a visit it replaces the rubric score here and in the export.
        </p>
      </Card>
    </AppShell>
  );
}
