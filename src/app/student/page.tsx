import { ArrowRight, BookOpenCheck, CalendarClock, PlayCircle, Route, Sparkles } from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import JoinCourse from "@/components/courses/JoinCourse";
import StartVisit from "@/components/courses/StartVisit";
import When from "@/components/courses/When";
import TrustLabel from "@/components/TrustLabel";
import { Badge, Card, CardHeader, cx, LinkButton, PageHeader } from "@/components/ui";
import { recommend } from "@/lib/adaptive";
import { requireUser } from "@/lib/auth";
import { all, parse } from "@/lib/db";
import { decodeEntities } from "@/lib/courses/save";
import { describeSettings, feedbackUrl, heldAssignmentIds, publishedCaseCards, studentAssignments, studentCaseLabels, toDate, TYPE_LABEL, visitUrl } from "@/lib/courses";
import { LEVEL_NAMES } from "@/lib/engine/difficulty";
import { profession } from "@/lib/professions";
import type { EncounterConfig, EncounterState } from "@/lib/types";

const MODE_LABEL: Record<string, string> = { practice: "Practice", adaptive: "Adaptive", homework: "Homework", exam: "Exam", journey: "Care journey" };
const nowMs = () => Date.now();

function LevelSteps({ level }: { level: number }) {
  return (
    <div className="flex items-end gap-1" role="img" aria-label={`Level ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((l) => (
        <span key={l} className={cx("w-3 rounded-sm transition-colors", l <= level ? "bg-brand-500" : "bg-brand-200/60")} style={{ height: 8 + l * 6 }} />
      ))}
    </div>
  );
}

function ScoreChip({ value }: { value: number }) {
  const v = Math.round(value);
  return <span className={cx("shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[13px] font-semibold tabular-nums", v >= 75 ? "bg-emerald-50 text-emerald-800" : v >= 50 ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-800")}>{v}%</span>;
}

export default async function StudentHome() {
  const user = await requireUser();
  const role = profession(user.profession_id);
  const rec = recommend(user.id, role.id);
  const recCard = rec.caseId ? publishedCaseCards().find((c) => c.id === rec.caseId) : null;
  const assignments = studentAssignments(user.id);
  const courses = all<{ id: string; name: string }>("SELECT co.id, co.name FROM courses co JOIN enrollments en ON en.course_id = co.id WHERE en.user_id = ? ORDER BY co.name", user.id);
  const held = heldAssignmentIds();
  const now = nowMs();

  const active = all<{ id: string; case_id: string; config: string; state: string; status: string; started_at: string; assignment: string | null; journey_run_id: string | null }>(
    `SELECT e.id, e.case_id, e.config, e.state, e.status, e.started_at, a.title AS assignment, e.journey_run_id
     FROM encounters e JOIN cases c ON c.id = e.case_id LEFT JOIN assignments a ON a.id = e.assignment_id
     WHERE e.user_id = ? AND e.status IN ('active','paused') AND e.started_at > datetime('now','-14 days') ORDER BY e.started_at DESC LIMIT 6`,
    user.id,
  );
  const recent = all<{ id: string; case_id: string; config: string; score: number | null; faculty_score: number | null; ended_at: string | null; attempt: number; assignment_id: string | null; assignment: string | null; faculty_note: string | null }>(
    `SELECT e.id, e.case_id, e.config, e.score, e.faculty_score, e.ended_at, e.attempt, e.assignment_id, a.title AS assignment, e.faculty_note
     FROM encounters e JOIN cases c ON c.id = e.case_id LEFT JOIN assignments a ON a.id = e.assignment_id
     WHERE e.user_id = ? AND e.status = 'scored' ORDER BY e.ended_at DESC LIMIT 6`,
    user.id,
  );
  // Case titles are faculty-facing and name the diagnosis; students get a neutral label.
  const labels = studentCaseLabels([...active, ...recent].map((e) => e.case_id));
  const open = assignments.filter((x) => x.status !== "submitted");
  const doneAssignments = assignments.filter((x) => x.status === "submitted");

  return (
    <AppShell user={user}>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} subtitle={`You are practising as ${role.name}.`} action={<LinkButton href="/student/practice" variant="secondary">Browse all patients</LinkButton>} />

      {/* Hero: the one thing to do next. */}
      <section aria-labelledby="next-visit" className="overflow-hidden rounded-2xl border border-brand-200 bg-surface">
        <div className="grid lg:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="flex flex-col justify-between gap-6 bg-brand-950 p-6 text-white">
            <div>
              <div className="flex items-center gap-2 text-[13px] font-medium text-[oklch(0.82_0.15_168)]">
                <Sparkles className="h-4 w-4" aria-hidden />
                Adaptive session
              </div>
              <h2 id="next-visit" className="mt-2 font-display text-[24px] font-semibold leading-tight">
                Your next visit
              </h2>
            </div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[12.5px] text-white/65">Level chosen for you</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-[44px] font-semibold leading-none tabular">{rec.level}</span>
                  <span className="text-[15px] font-medium text-white/85">{LEVEL_NAMES[rec.level]}</span>
                </div>
              </div>
              <LevelSteps level={rec.level} />
            </div>
          </div>
          <div className="flex flex-col gap-4 p-6">
            <p className="text-[13px] text-ink-3">The next patient and difficulty are chosen from your results so far. No language model is involved in the choice.</p>
            <p className="max-w-2xl text-[16px] leading-relaxed text-ink">{rec.reason}</p>
            {recCard ? (
              <div className="flex flex-wrap items-center gap-2 text-[14px]">
                <span className="text-ink-3">Patient picked:</span>
                <span className="font-semibold text-ink">{recCard.label}</span>
                {recCard.aiDraft && <TrustLabel kind="ai-draft" />}
              </div>
            ) : (
              <p className="text-[14px] text-ink-2">
                There are no published patients for {role.name} yet, so there is nothing to recommend. You can still practise with patients written for other roles in the{" "}
                <Link href="/student/practice" className="font-medium text-brand-700 underline">
                  practice library
                </Link>
                .
              </p>
            )}
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="text-[13px] text-ink-3">
                {rec.profile.sessions > 0 ? `Based on ${rec.profile.sessions} scored visit${rec.profile.sessions === 1 ? "" : "s"}. ` : ""}
                <Link href="/student/progress" className="font-medium text-brand-700 hover:underline">
                  See your skill ratings and how the level is chosen
                </Link>
              </p>
              {rec.caseId && <StartVisit size="lg" label="Start adaptive visit" body={{ caseId: rec.caseId, mode: "adaptive", level: rec.level, knobs: rec.knobs, perturb: true }} />}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ---------- Assignments ---------- */}
        <Card>
          <CardHeader title="Assignments" subtitle={assignments.length ? `${open.length} to do, ${doneAssignments.length} submitted` : undefined} />
          {assignments.length === 0 ? (
            <div className="flex items-start gap-3 px-4 py-6 text-[14px] text-ink-3">
              <BookOpenCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
              <p>{courses.length ? "Your instructor has not set any assignments yet." : "Join a course with the code from your instructor to see your assignments here."}</p>
            </div>
          ) : (
            <ul className="divide-y divide-line/70">
              {[...open, ...doneAssignments].map(({ a, course, cases, status, feedbackVisible, journeyTitle }) => {
                const pastDue = a.due_at && toDate(a.due_at).getTime() < now && status !== "submitted";
                const max = a.settings.maxAttempts;
                return (
                  <li key={a.id} className="px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold text-ink">{a.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
                          <Badge tone={a.type === "exam" ? "violet" : a.type === "practice" ? "slate" : "blue"}>{TYPE_LABEL[a.type]}</Badge>
                          <span>{course}</span>
                          {a.due_at && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                              Due <When at={a.due_at} />
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {pastDue && <Badge tone="red">Past due</Badge>}
                        <Badge tone={status === "submitted" ? "green" : status === "in_progress" ? "amber" : "slate"}>{status === "submitted" ? "Submitted" : status === "in_progress" ? "In progress" : "Not started"}</Badge>
                      </div>
                    </div>
                    {a.instructions && <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-ink-2">{a.instructions}</p>}
                    <p className="mt-1.5 text-[12.5px] text-ink-3">
                      {describeSettings(a.settings)}
                      {a.settings.liveAssist && ". Your instructor can watch these visits live and may pause to help"}
                      {!feedbackVisible && ". Feedback is released by your instructor"}
                    </p>
                    {a.journey_id ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5">
                        <div className="flex items-center gap-2 text-[14px] text-ink">
                          <Route className="h-4 w-4 text-brand-600" aria-hidden />
                          <span className="text-ink-3">Care journey:</span>
                          {journeyTitle}
                        </div>
                        <LinkButton href={`/student/journeys/${a.journey_id}?assignment=${a.id}`} size="sm">
                          {status === "not_started" ? "Open journey" : "Continue journey"}
                        </LinkButton>
                      </div>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {cases.map((c) => {
                          const left = max ? Math.max(0, max - c.attemptsUsed) : null;
                          return (
                            <li key={c.card.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5">
                              <div className="min-w-0 flex-1">
                                <div className="text-[14px] font-semibold text-ink">{c.card.label}</div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-3">
                                  <span>{max ? `${c.attemptsUsed} of ${max} attempt${max === 1 ? "" : "s"} used` : `${c.attemptsUsed} attempt${c.attemptsUsed === 1 ? "" : "s"} so far`}</span>
                                  {c.best !== null && (
                                    <span>
                                      best <span className="font-semibold text-ink">{Math.round(c.best)}%</span>
                                    </span>
                                  )}
                                  {c.scoredCount > 0 && !feedbackVisible && <span>submitted, feedback not released yet</span>}
                                  {c.card.aiDraft && <TrustLabel kind="ai-draft" />}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {c.lastId && feedbackVisible && (
                                  <LinkButton href={feedbackUrl(c.lastId)} variant="ghost" size="sm">
                                    Feedback
                                  </LinkButton>
                                )}
                                {c.activeId ? (
                                  <LinkButton href={visitUrl(c.activeId)} size="sm">
                                    Resume visit
                                  </LinkButton>
                                ) : left === 0 ? (
                                  <span className="text-[12.5px] text-ink-3">No attempts left</span>
                                ) : (
                                  <StartVisit size="sm" variant={c.scoredCount ? "secondary" : "primary"} label={c.scoredCount ? "Try again" : "Start visit"} body={{ caseId: c.card.id, assignmentId: a.id }} />
                                )}
                              </div>
                            </li>
                          );
                        })}
                        {cases.length === 0 && <li className="text-[12.5px] text-ink-3">The patients for this assignment are not available right now.</li>}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          {active.length > 0 && (
            <Card>
              <CardHeader title="Visits in progress" subtitle="Pick up where you left off." />
              <ul className="divide-y divide-line/70">
                {active.map((e) => {
                  const cfg = parse<Partial<EncounterConfig>>(e.config, {});
                  const st = parse<Partial<EncounterState>>(e.state, {});
                  return (
                    <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-ink">{labels.get(e.case_id) || "Visit"}</div>
                        <div className="text-[12.5px] text-ink-3">
                          {(e.assignment && decodeEntities(e.assignment)) || MODE_LABEL[cfg.mode || "practice"]} · turn {st.turn ?? 0} · started <When at={e.started_at} />
                          {e.status === "paused" && " · paused by your instructor"}
                        </div>
                      </div>
                      <LinkButton href={visitUrl(e.id)} size="sm" variant="secondary">
                        <PlayCircle className="h-3.5 w-3.5" aria-hidden />
                        Resume
                      </LinkButton>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Recent results"
              action={
                <LinkButton href="/student/progress" variant="ghost" size="sm">
                  Progress
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </LinkButton>
              }
            />
            {recent.length === 0 ? (
              <p className="px-4 py-6 text-[14px] text-ink-3">Finish a visit to see your score and feedback here.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {recent.map((e) => {
                  const cfg = parse<Partial<EncounterConfig>>(e.config, {});
                  const hidden = !!e.assignment_id && held.has(e.assignment_id);
                  const body = (
                    <>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-ink">{labels.get(e.case_id) || "Visit"}</div>
                        <div className="text-[12.5px] text-ink-3">
                          {(e.assignment && decodeEntities(e.assignment)) || MODE_LABEL[cfg.mode || "practice"]} · attempt {e.attempt} · level {cfg.knobs?.level ?? "?"} · <When at={e.ended_at} />
                          {!hidden && e.faculty_note && " · instructor note"}
                        </div>
                      </div>
                      {hidden ? <span className="shrink-0 text-[12.5px] text-ink-3">Feedback held</span> : <ScoreChip value={e.faculty_score ?? e.score ?? 0} />}
                    </>
                  );
                  return (
                    <li key={e.id}>
                      {hidden ? (
                        <div className="flex items-center justify-between gap-3 px-4 py-3">{body}</div>
                      ) : (
                        <Link href={feedbackUrl(e.id)} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
                          {body}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Your courses" subtitle="Enter the join code your instructor gave you." />
            <div className="p-4">
              <JoinCourse />
              {courses.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-[14px] text-ink">
                  {courses.map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
                      {c.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
