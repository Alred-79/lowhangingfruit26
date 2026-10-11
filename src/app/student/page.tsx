import { ArrowRight, BookOpenCheck, CalendarClock, ChevronRight, Gauge, PlayCircle, Route, Sparkles, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import AppShell from "@/components/AppShell";
import JoinCourse from "@/components/courses/JoinCourse";
import StartVisit from "@/components/courses/StartVisit";
import When from "@/components/courses/When";
import { GameLayerSwitch, TiltCard } from "@/components/game/controls";
import { deriveGame, domainLabel, releasedSkills } from "@/components/game/derive";
import { AchievementBadge, Count, GameCell, MasteryRadar, QuestPips, RankRing, StreakPanel, XpBar, XpRules } from "@/components/game/hud";
import TrustLabel from "@/components/TrustLabel";
import { Badge, Card, CardHeader, cx, LinkButton } from "@/components/ui";
import { expectedScore, recommend } from "@/lib/adaptive";
import { requireUser } from "@/lib/auth";
import { all, get, parse } from "@/lib/db";
import { decodeEntities } from "@/lib/courses/save";
import { describeSettings, feedbackUrl, heldAssignmentIds, publishedCaseCards, studentAssignments, studentCaseLabels, toDate, TYPE_LABEL, visitUrl } from "@/lib/courses";
import { LEVEL_NAMES } from "@/lib/engine/difficulty";
import { profession } from "@/lib/professions";
import type { EncounterConfig, EncounterState } from "@/lib/types";

const MODE_LABEL: Record<string, string> = { practice: "Practice", adaptive: "Adaptive", homework: "Homework", exam: "Exam", journey: "Care journey" };
const nowMs = () => Date.now();
const v = (o: Record<string, string | number>) => o as CSSProperties;

/** Difficulty as a rising staircase of five steps; the chosen ones lit. */
function LevelSteps({ level, light = false }: { level: number; light?: boolean }) {
  return (
    <div className="flex items-end gap-1.5" role="img" aria-label={`Level ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((l) => (
        <span
          key={l}
          className={cx("pop-spring w-3.5 rounded-[5px]", l <= level ? (light ? "bg-[var(--color-xp)]" : "bg-brand-600") : light ? "bg-white/20" : "bg-brand-100")}
          style={v({ height: 10 + l * 7, "--i": l })}
        />
      ))}
    </div>
  );
}

/** A score as a small ring with the number inside (never color alone). */
function ScoreRing({ value }: { value: number }) {
  const s = Math.round(value);
  const c = 2 * Math.PI * 16;
  const tone = s >= 75 ? "var(--color-tier-initial)" : s >= 50 ? "var(--color-tier-reluctant)" : "var(--color-tier-hidden)";
  return (
    <span className="relative grid h-11 w-11 shrink-0 place-items-center" role="img" aria-label={`${s}%`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-surface-2)" strokeWidth="5" />
        <circle cx="20" cy="20" r="16" fill="none" stroke={tone} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - s / 100)} className="ring-fill" style={v({ "--from": c })} />
      </svg>
      <span className="font-mono text-[12px] font-bold text-ink">{s}</span>
    </span>
  );
}

export default async function StudentHome() {
  const user = await requireUser();
  const role = profession(user.profession_id);
  const rec = recommend(user.id, role.id);
  const recCard = rec.caseId ? publishedCaseCards().find((c) => c.id === rec.caseId) : null;
  // Only the portrait path is read from the profile (as on the practice page): no title or clinical content.
  const recPortrait = rec.caseId ? get<{ p: string | null }>("SELECT json_extract(profile, '$.patient.portrait') AS p FROM cases WHERE id = ?", rec.caseId)?.p || null : null;
  const assignments = studentAssignments(user.id);
  const courses = all<{ id: string; name: string }>("SELECT co.id, co.name FROM courses co JOIN enrollments en ON en.course_id = co.id WHERE en.user_id = ? ORDER BY co.name", user.id);
  const held = heldAssignmentIds();
  const now = nowMs();
  const game = deriveGame(user.id, role.id);
  const first = user.name.split(" ")[0];

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
  const quest = open[0];
  const questDone = quest ? (quest.a.journey_id ? (quest.status === "in_progress" ? 1 : 0) : quest.cases.filter((c) => c.scoredCount > 0).length) : 0;
  const questTotal = quest ? (quest.a.journey_id ? 2 : Math.max(1, quest.cases.length)) : 0;
  const got = game.achievements.filter((a) => a.got);
  const shelf = [...got, ...game.achievements.filter((a) => !a.got)].slice(0, 6);
  // Shown ratings stop before a visit whose feedback is held (derive.ts releasedSkills), so a held
  // grade cannot be read back out of them. The recommendation itself still uses every visit.
  const rs = releasedSkills(user.id, role.id);
  const shownProfile = rs.held ? { overall: rs.overall, sessions: rs.sessions, weakest: rs.weakest, expectedAtLevel: expectedScore(rs.overall, rec.level) } : rec.profile;
  const reason = rs.held
    ? "Some of your feedback is held by your instructor, so the ratings shown here stop at the visit before it. The level is still chosen from all of your visits, and no language model is involved in the choice."
    : rec.reason;
  const weakest = shownProfile.weakest ? domainLabel(shownProfile.weakest) : null;
  // More patients written for this role: unseen first, then nearest the recommended level. Only the
  // student-safe card and the portrait path are read (as on the practice page).
  const seen = new Map(all<{ case_id: string; n: number }>("SELECT case_id, COUNT(*) AS n FROM encounters WHERE user_id = ? AND status IN ('submitted','scored') GROUP BY case_id", user.id).map((r) => [r.case_id, r.n]));
  const rank = (a: { id: string; difficulty: number }, b: { id: string; difficulty: number }) => (seen.get(a.id) || 0) - (seen.get(b.id) || 0) || Math.abs(a.difficulty - rec.level) - Math.abs(b.difficulty - rec.level) || a.id.localeCompare(b.id);
  const pool = publishedCaseCards().filter((c) => c.id !== rec.caseId);
  // This role's patients first; if there are fewer than three, patients written for other roles fill in (labelled).
  const more = [...pool.filter((c) => c.professions.includes(role.id)).sort(rank), ...pool.filter((c) => !c.professions.includes(role.id)).sort(rank)].slice(0, 3);
  const morePortraits = new Map(
    more.length ? all<{ id: string; p: string | null }>(`SELECT id, json_extract(profile, '$.patient.portrait') AS p FROM cases WHERE id IN (${more.map(() => "?").join(",")})`, ...more.map((c) => c.id)).map((r) => [r.id, r.p]) : [],
  );

  return (
    <AppShell user={user}>
      <h1 className="sr-only">Home</h1>

      {/* ---------- The HUD: rank and XP, streak, this week ---------- */}
      <div className="grid gap-4 lg:grid-cols-12">
        <GameCell tone="brand" className="lg:col-span-6" i={0}>
          <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 spin-slow [background:conic-gradient(from_0deg,transparent,rgb(255_255_255/0.16),transparent_40%)]" aria-hidden />
          <div className="relative flex flex-wrap items-start justify-between gap-2">
            <p className="text-[13px] font-bold text-white/85">You are practising as {role.name}.</p>
            <Link href="/student/practice" className="press inline-flex min-h-9 items-center gap-1 rounded-full bg-white/15 px-3 text-[12.5px] font-bold text-white ring-1 ring-white/25 hover:bg-white/25 pointer-coarse:min-h-11">
              Browse all patients
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <p className="relative mt-1 font-display text-[clamp(2rem,3.6vw,2.9rem)] font-black leading-[0.98] tracking-[-0.035em]">{game.visits ? `Back on shift, ${first}.` : `Your first shift, ${first}.`}</p>
          <div className="game-layer relative mt-5 flex items-center gap-4">
            <RankRing rank={game.rank} size={88} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-display text-[22px] font-extrabold leading-tight">{game.rank.title}</span>
                <XpRules dark />
              </div>
              <XpBar rank={game.rank} xp={game.xp} dark className="mt-1.5" />
            </div>
          </div>
        </GameCell>

        <GameCell tone="flame" className="game-layer lg:col-span-3" i={1}>
          <StreakPanel streak={game.streak} />
        </GameCell>

        <GameCell tone="xp" className="game-layer lg:col-span-3" i={2}>
          <p className="text-[13px] font-bold">This week</p>
          <p className="mt-1 font-display text-[64px] font-black leading-[0.85] tracking-[-0.04em]">
            <Count value={game.weekXp} />
          </p>
          <p className="mt-1 text-[13.5px] font-bold">XP earned</p>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-ink">
            <div className="rounded-2xl bg-white/45 p-2.5">
              <dt className="text-[11.5px] font-bold">Visits</dt>
              <dd className="font-display text-[24px] font-black leading-none">
                <Count value={game.visits} />
              </dd>
            </div>
            <div className="rounded-2xl bg-white/45 p-2.5">
              <dt className="text-[11.5px] font-bold">Badges</dt>
              <dd className="font-display text-[24px] font-black leading-none">
                {got.length}
                <span className="text-[14px] opacity-70">/{game.achievements.length}</span>
              </dd>
            </div>
          </dl>
        </GameCell>
      </div>

      {/* ---------- Active quest: the first open assignment ---------- */}
      {quest && (
        <section aria-labelledby="quest" className="rise mt-4 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-[26px] bg-ink p-5 text-white clay sm:px-7" style={v({ "--i": 3 })}>
          <span className="breathe grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--color-xp)] text-ink">
            <Target className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold text-[var(--color-xp)]">Active quest · {TYPE_LABEL[quest.a.type]}</p>
            <h2 id="quest" className="font-display text-[22px] font-extrabold leading-tight tracking-[-0.02em]">
              {quest.a.title}
            </h2>
            <p className="mt-0.5 text-[13.5px] text-white/80">
              {quest.course}
              {quest.a.due_at && (
                <>
                  {" "}
                  · due <When at={quest.a.due_at} />
                </>
              )}
            </p>
          </div>
          <QuestPips done={questDone} total={questTotal} dark />
          <a href="#assignments" className="press inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--color-xp)] px-5 font-bold text-ink clay">
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </section>
      )}

      {/* ---------- Next patient (adaptive) + mastery ---------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <section aria-labelledby="next-visit" className="rise lg:col-span-7" style={v({ "--i": 4 })}>
          <TiltCard className="h-full rounded-[26px]" max={4}>
            <div className="flex h-full flex-col overflow-hidden rounded-[26px] border border-line/80 bg-surface shadow-e2">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-brand-700 to-brand-500 px-5 py-4 text-white">
                <div>
                  <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--color-xp)]">
                    <Sparkles className="h-4 w-4" aria-hidden />
                    Adaptive session
                  </p>
                  <h2 id="next-visit" className="font-display text-[24px] font-black leading-tight tracking-[-0.02em]">
                    Your next patient
                  </h2>
                </div>
                <div className="flex items-end gap-3">
                  <div className="text-right">
                    <p className="text-[11.5px] font-bold text-white/80">Level chosen for you</p>
                    <p className="font-display text-[20px] font-black leading-none">
                      {rec.level} · {LEVEL_NAMES[rec.level]}
                    </p>
                  </div>
                  <LevelSteps level={rec.level} light />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-4 p-5">
                {recCard ? (
                  <div className="flex flex-wrap items-center gap-3">
                    {recPortrait ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={recPortrait} alt="" width={72} height={72} className="float-idle h-[72px] w-[72px] shrink-0 rounded-[22px] object-cover clay ring-4 ring-[var(--color-xp)]" />
                    ) : (
                      <span className="float-idle grid h-[72px] w-[72px] shrink-0 place-items-center rounded-[22px] bg-gradient-to-br from-[var(--color-tier-initial)] to-brand-500 font-display text-[26px] font-black text-white clay">
                        {recCard.patientFirstName.slice(0, 1)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[19px] font-extrabold leading-tight text-ink">{recCard.label}</p>
                      {recCard.aiDraft && <TrustLabel kind="ai-draft" className="mt-1" />}
                    </div>
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
                {/* The recommendation's reasoning as three designed facts; the exact sentence is one click away. */}
                <ul className="grid gap-2 sm:grid-cols-3">
                  <li className="rounded-2xl bg-[var(--color-mastery-soft)] p-3">
                    <p className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-mastery-ink)]">
                      <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                      Your rating
                    </p>
                    <p className="font-display text-[24px] font-black leading-tight text-ink">{shownProfile.sessions > 0 ? Math.round(shownProfile.overall) : "New"}</p>
                  </li>
                  <li className="rounded-2xl bg-[var(--color-tier-initial-soft)] p-3">
                    <p className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-tier-initial-ink)]">
                      <Gauge className="h-3.5 w-3.5" aria-hidden />
                      Expected score
                    </p>
                    <p className="font-display text-[24px] font-black leading-tight text-ink">{shownProfile.sessions > 0 ? `${Math.round(shownProfile.expectedAtLevel * 100)}%` : "Level 2 start"}</p>
                  </li>
                  <li className="rounded-2xl bg-[var(--color-tier-hidden-soft)] p-3">
                    <p className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-tier-hidden-ink)]">
                      <Target className="h-3.5 w-3.5" aria-hidden />
                      Training
                    </p>
                    <p className="font-display text-[20px] font-black leading-tight text-ink">{weakest || "Balanced"}</p>
                  </li>
                </ul>
                <details className="group text-[13.5px]">
                  <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 font-semibold text-brand-700 pointer-coarse:min-h-11">
                    <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden />
                    Why this patient and level?
                  </summary>
                  <p className="pop-in mt-1.5 max-w-2xl leading-relaxed text-ink-2">{reason}</p>
                  <p className="mt-1.5 text-[12.5px] text-ink-3">The next patient and difficulty are chosen from your results so far. No language model is involved in the choice.</p>
                </details>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <p className="text-[13px] text-ink-3">
                    {shownProfile.sessions > 0 ? `Based on ${shownProfile.sessions} scored visit${shownProfile.sessions === 1 ? "" : "s"}${rs.held ? " with released feedback" : ""}. ` : ""}
                    <Link href="/student/progress" className="font-semibold text-brand-700 hover:underline">
                      See your skill ratings and how the level is chosen
                    </Link>
                  </p>
                  {rec.caseId && <StartVisit size="lg" label="Start adaptive visit" body={{ caseId: rec.caseId, mode: "adaptive", level: rec.level, knobs: rec.knobs, perturb: true }} />}
                </div>
              </div>
            </div>
          </TiltCard>
        </section>

        <Card className="rise p-5 lg:col-span-5" style={v({ "--i": 5 })}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-display text-[19px] font-extrabold tracking-[-0.02em] text-ink">Mastery</h2>
            <span className="rounded-full bg-[var(--color-mastery-soft)] px-2.5 py-1 text-[12px] font-bold text-[var(--color-mastery-ink)]">{game.mastery.length} skills</span>
          </div>
          {game.mastery.length ? (
            <MasteryRadar data={game.mastery} size={300} />
          ) : (
            <div className="grid place-items-center py-10 text-center">
              <span className="float-idle grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-mastery-soft)] text-[var(--color-mastery-ink)]">
                <TrendingUp className="h-7 w-7" aria-hidden />
              </span>
              <p className="mt-3 font-display text-[17px] font-bold text-ink">Your skill map starts with your first scored visit</p>
              <p className="mt-1 max-w-xs text-[13.5px] text-ink-3">Each rubric area becomes a point on this map and moves as you practise.</p>
            </div>
          )}
          <p className="mt-2 text-center text-[12px] text-ink-3">From your rubric results (Elo ratings shown on a 0-100 scale).</p>
        </Card>
      </div>

      {more.length > 0 && (
        <section aria-labelledby="more-patients" className="mt-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 id="more-patients" className="font-display text-[24px] font-black tracking-[-0.025em] text-ink">
              More patients for you
            </h2>
            <Link href="/student/practice" className="text-[13.5px] font-bold text-brand-700 hover:underline">
              All patients
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3">
            {more.map((c, i) => {
              const portrait = morePortraits.get(c.id);
              const xp = 100 + 40 * (rec.level - 1);
              return (
                <li key={c.id} className="rise" style={v({ "--i": 6 + i })}>
                  <TiltCard className="h-full rounded-[24px]">
                    <div className="flex h-full flex-col overflow-hidden rounded-[24px] bg-surface shadow-e2 ring-1 ring-line/80">
                      <div className="relative h-40 overflow-hidden bg-stage">
                        {portrait ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={portrait} alt="" loading="lazy" className="float-idle h-full w-full scale-105 object-cover object-[50%_25%]" style={v({ "--i": i })} />
                        ) : (
                          <div className="grid h-full place-items-center font-display text-[44px] font-black text-white/80">{c.patientFirstName.slice(0, 1)}</div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10 text-white">
                          <p className="font-display text-[20px] font-black leading-tight">
                            {c.patientFirstName}
                            {c.age ? `, ${c.age}` : ""}
                          </p>
                        </div>
                        <span className="absolute right-3 top-3 rounded-full bg-[var(--color-xp)] px-2.5 py-1 font-mono text-[12px] font-bold text-ink">+{xp} XP</span>
                        {!seen.get(c.id) && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11.5px] font-bold text-ink">New to you</span>}
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-4">
                        <p className="text-[13.5px] font-semibold leading-snug text-ink-2">
                          {c.encounterType.charAt(0).toUpperCase() + c.encounterType.slice(1)} · {c.specialty}
                        </p>
                        {!c.professions.includes(role.id) && <span className="w-fit rounded-full bg-[var(--color-mastery-soft)] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--color-mastery-ink)]">Written for another role</span>}
                        {c.aiDraft && <TrustLabel kind="ai-draft" />}
                        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
                          <div>
                            <p className="text-[11.5px] font-bold text-ink-3">Your level</p>
                            <LevelSteps level={rec.level} />
                          </div>
                          <StartVisit size="sm" label="Start visit" body={{ caseId: c.id, mode: "practice", level: rec.level, perturb: !!seen.get(c.id) }} />
                        </div>
                      </div>
                    </div>
                  </TiltCard>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[12px] text-ink-3">XP shown is for finishing at your level, plus 5 per fact you uncover. Practice visits are private to you.</p>
        </section>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        {/* ---------- Assignments, as quests ---------- */}
        <Card id="assignments" className="rise scroll-mt-6 lg:col-span-7" style={v({ "--i": 6 })}>
          <CardHeader title="Quests from your courses" subtitle={assignments.length ? `${open.length} to do, ${doneAssignments.length} submitted` : undefined} />
          {assignments.length === 0 ? (
            <div className="flex items-start gap-3 px-5 py-6 text-[14px] text-ink-3">
              <BookOpenCheck className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden />
              <p>{courses.length ? "Your instructor has not set any assignments yet." : "Join a course with the code from your instructor to see your assignments here."}</p>
            </div>
          ) : (
            <ul className="divide-y divide-line/70">
              {[...open, ...doneAssignments].map(({ a, course, cases, status, feedbackVisible, journeyTitle }, ai) => {
                const pastDue = a.due_at && toDate(a.due_at).getTime() < now && status !== "submitted";
                const max = a.settings.maxAttempts;
                const seen = cases.filter((c) => c.scoredCount > 0).length;
                return (
                  <li key={a.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={cx("mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl clay", status === "submitted" ? "bg-[var(--color-xp)] text-ink" : a.type === "exam" ? "bg-[var(--color-mastery)] text-white" : "bg-brand-600 text-white")} aria-hidden>
                          {a.journey_id ? <Route className="h-5 w-5" /> : <span className="font-display text-[16px] font-black">{ai + 1}</span>}
                        </span>
                        <div className="min-w-0">
                          <div className="font-display text-[17px] font-extrabold leading-tight text-ink">{a.title}</div>
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
                      </div>
                      <div className="flex items-center gap-1.5">
                        {pastDue && <Badge tone="red">Past due</Badge>}
                        <Badge tone={status === "submitted" ? "green" : status === "in_progress" ? "amber" : "slate"}>{status === "submitted" ? "Submitted" : status === "in_progress" ? "In progress" : "Not started"}</Badge>
                      </div>
                    </div>
                    {!a.journey_id && cases.length > 0 && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="meter" aria-label="Patients seen" aria-valuemin={0} aria-valuemax={cases.length} aria-valuenow={seen}>
                          <div className="bar-grow h-full rounded-full bg-[var(--color-xp)]" style={{ width: `${Math.max(3, (seen / cases.length) * 100)}%` }} />
                        </div>
                        <span className="font-mono text-[12.5px] font-bold text-ink">
                          {seen}/{cases.length} seen
                        </span>
                      </div>
                    )}
                    {a.instructions && <p className="mt-2.5 whitespace-pre-line rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2">{a.instructions}</p>}
                    <p className="mt-1.5 text-[12.5px] text-ink-3">
                      {describeSettings(a.settings)}
                      {a.settings.liveAssist && ". Your instructor can watch these visits live and may pause to help"}
                      {!feedbackVisible && ". Feedback is released by your instructor"}
                    </p>
                    {a.journey_id ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--color-flame-soft)] px-3.5 py-2.5">
                        <div className="flex items-center gap-2 text-[14px] text-ink">
                          <Route className="h-4 w-4 text-[var(--color-flame-ink)]" aria-hidden />
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
                            <li key={c.card.id} className="lift flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 px-3.5 py-2.5 ring-1 ring-inset ring-line/60">
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-[14px] font-black", c.scoredCount ? "bg-[var(--color-xp)] text-ink" : "bg-surface text-ink-2 ring-1 ring-line")} aria-hidden>
                                  {c.card.patientFirstName.slice(0, 1)}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-[14px] font-bold text-ink">{c.card.label}</div>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-3">
                                    <span>{max ? `${c.attemptsUsed} of ${max} attempt${max === 1 ? "" : "s"} used` : `${c.attemptsUsed} attempt${c.attemptsUsed === 1 ? "" : "s"} so far`}</span>
                                    {c.best !== null && (
                                      <span>
                                        best <span className="font-bold text-ink">{Math.round(c.best)}%</span>
                                      </span>
                                    )}
                                    {c.scoredCount > 0 && !feedbackVisible && <span>submitted, feedback not released yet</span>}
                                    {c.card.aiDraft && <TrustLabel kind="ai-draft" />}
                                  </div>
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

        <div className="space-y-4 lg:col-span-5">
          {active.length > 0 && (
            <Card className="rise" style={v({ "--i": 7 })}>
              <CardHeader title="Visits in progress" subtitle="Pick up where you left off." />
              <ul className="divide-y divide-line/70">
                {active.map((e) => {
                  const cfg = parse<Partial<EncounterConfig>>(e.config, {});
                  const st = parse<Partial<EncounterState>>(e.state, {});
                  return (
                    <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-flame-soft)] text-[var(--color-flame-ink)]">
                          <PlayCircle className="h-5 w-5" aria-hidden />
                          {e.status !== "paused" && <span className="live-dot absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--color-flame)] ring-2 ring-surface" aria-hidden />}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-bold text-ink">{cfg.journey?.roleTitle ? `${(labels.get(e.case_id) || "Visit").split(" · ")[0]} · ${cfg.journey.roleTitle}` : labels.get(e.case_id) || "Visit"}</div>
                          <div className="text-[12.5px] text-ink-3">
                            {(e.assignment && decodeEntities(e.assignment)) || MODE_LABEL[cfg.mode || "practice"]} · turn {st.turn ?? 0} · started <When at={e.started_at} />
                            {e.status === "paused" && " · paused by your instructor"}
                          </div>
                        </div>
                      </div>
                      <LinkButton href={visitUrl(e.id)} size="sm" variant="secondary">
                        Resume
                      </LinkButton>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card className="game-layer rise" style={v({ "--i": 8 })}>
            <CardHeader title="Badges" subtitle={`${got.length} of ${game.achievements.length} unlocked, all from your real visits`} action={<GameLayerSwitch />} />
            <ul className="grid gap-3 p-5 sm:grid-cols-2">
              {shelf.map((a, i) => (
                <AchievementBadge key={a.id} a={a} i={i} size="sm" />
              ))}
            </ul>
          </Card>

          <Card className="rise" style={v({ "--i": 9 })}>
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
              <p className="px-5 py-6 text-[14px] text-ink-3">Finish a visit to see your score and feedback here.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {recent.map((e) => {
                  const cfg = parse<Partial<EncounterConfig>>(e.config, {});
                  const hidden = !!e.assignment_id && held.has(e.assignment_id);
                  const body = (
                    <>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-bold text-ink">{cfg.journey?.roleTitle ? `${(labels.get(e.case_id) || "Visit").split(" · ")[0]} · ${cfg.journey.roleTitle}` : labels.get(e.case_id) || "Visit"}</div>
                        <div className="text-[12.5px] text-ink-3">
                          {(e.assignment && decodeEntities(e.assignment)) || MODE_LABEL[cfg.mode || "practice"]} · attempt {e.attempt} · level {cfg.knobs?.level ?? "?"} · <When at={e.ended_at} />
                          {!hidden && e.faculty_note && " · instructor note"}
                        </div>
                      </div>
                      {hidden ? <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-ink-3">Feedback held</span> : <ScoreRing value={e.faculty_score ?? e.score ?? 0} />}
                    </>
                  );
                  return (
                    <li key={e.id}>
                      {hidden ? (
                        <div className="flex items-center justify-between gap-3 px-5 py-3">{body}</div>
                      ) : (
                        <Link href={feedbackUrl(e.id)} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-brand-50/60">
                          {body}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="rise" style={v({ "--i": 10 })}>
            <CardHeader title="Your courses" subtitle="Enter the join code your instructor gave you." />
            <div className="p-5">
              <JoinCourse />
              {courses.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2 text-[14px] text-ink">
                  {courses.map((c) => (
                    <li key={c.id} className="inline-flex items-center gap-2 rounded-full bg-[var(--color-tier-initial-soft)] px-3 py-1 font-semibold text-[var(--color-tier-initial-ink)]">
                      <span className="h-2 w-2 rounded-full bg-[var(--color-tier-initial)]" aria-hidden />
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
