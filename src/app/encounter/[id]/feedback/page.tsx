import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDashed, Flag, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import FacultyReview from "@/components/courses/FacultyReview";
import When from "@/components/courses/When";
import EvidenceChip from "@/components/feedback/EvidenceChip";
import { CollectionBoard, RewardReveal } from "@/components/feedback/Reveal";
import ScoreRing from "@/components/feedback/ScoreRing";
import { visitReward } from "@/components/game/derive";
import VisitReplay, { type ReplayTurn } from "@/components/feedback/VisitReplay";
import TrustLabel from "@/components/TrustLabel";
import { Badge, Card, CardHeader, cx, LinkButton } from "@/components/ui";
import { FinishScoring, RetryButtons } from "@/components/visit/FeedbackActions";
import { isFaculty, requireUser } from "@/lib/auth";
import { get, parse } from "@/lib/db";
import { LEVEL_NAMES } from "@/lib/engine/difficulty";
import { loadEncounter, messagesOf } from "@/lib/engine/encounter";
import { canSeeEpisode } from "@/lib/episodes";
import { attemptHistory } from "@/lib/engine/feedback";
import { timeline } from "@/lib/engine/timeline";
import { profession } from "@/lib/professions";
import type { Feedback } from "@/lib/types";

const TONE = { 4: "green", 3: "teal", 2: "amber", 1: "red" } as const;
const LABEL: Record<number, string> = { 4: "Strong", 3: "Competent", 2: "Developing", 1: "Unsafe or absent" };
const IMP = { critical: "red", important: "amber", minor: "slate" } as const;
const MET = { met: ["green", "Met"], partial: ["amber", "Partly met"], not_met: ["red", "Not met"] } as const;
const QTYPE: Record<string, string> = { open: "open question", focused: "focused question", closed: "closed question", leading: "leading question", multiple: "stacked questions", statement: "statement" };
const SECTIONS = [
  { id: "replay", label: "Turn by turn" },
  { id: "rubric", label: "Rubric and evidence" },
  { id: "findings", label: "Findings" },
  { id: "objectives", label: "Objectives and orders" },
  { id: "coaching", label: "Strengths and next steps" },
  { id: "writeup", label: "Interview and write-up" },
  { id: "attempts", label: "Attempts" },
  { id: "transcript", label: "Transcript" },
];

function TurnLink({ turn }: { turn?: number }) {
  if (turn === undefined || turn === null) return null;
  return (
    <a href={`#t${turn}`} className="ml-1.5 inline-flex items-center whitespace-nowrap rounded bg-slate-100 px-1 font-mono text-[11px] font-medium tabular-nums text-ink-2 hover:bg-brand-100 hover:text-brand-800">
      T{turn}
    </a>
  );
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 120, H = 32;
  const x = (i: number) => 3 + (i * (W - 6)) / (values.length - 1);
  const y = (v: number) => H - 3 - (v / 100) * (H - 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-[120px]" role="img" aria-label={`Patient comfort from ${values[0]} to ${values[values.length - 1]}`}>
      <line x1={3} x2={W - 3} y1={y(50)} y2={y(50)} stroke="var(--color-slate-200)" />
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="var(--color-brand-600)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} fill="var(--color-brand-600)" stroke="var(--color-surface)" strokeWidth={1.5} />
    </svg>
  );
}

/** The question mix as one stacked bar (open is what the rubric rewards), with the counts as text. */
function QuestionMix({ stats }: { stats: { open: number; focused: number; closed: number; leading: number; multiple: number } }) {
  const parts = [
    { k: "open", n: stats.open, c: "var(--color-tier-initial)" },
    { k: "focused", n: stats.focused, c: "var(--color-tier-discoverable)" },
    { k: "closed", n: stats.closed, c: "var(--color-tier-reluctant)" },
    { k: "leading/stacked", n: stats.leading + stats.multiple, c: "var(--color-tier-hidden)" },
  ];
  const total = Math.max(1, parts.reduce((a, p) => a + p.n, 0));
  return (
    <div>
      <div className="mt-1 flex h-3 gap-[2px] overflow-hidden rounded-full" aria-hidden>
        {parts.map((p) => p.n > 0 && <span key={p.k} className="bar-grow h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.n / total) * 100}%`, background: p.c }} />)}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-snug text-ink-2">
        <span className="font-bold tabular text-ink">{stats.open}</span> open, <span className="font-bold tabular text-ink">{stats.focused}</span> focused, <span className="font-bold tabular text-ink">{stats.closed}</span> closed, <span className="font-bold tabular text-ink">{stats.leading + stats.multiple}</span> leading/stacked
      </p>
    </div>
  );
}

function Pips({ score, max = 4 }: { score: number; max?: number }) {
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cx("h-2.5 w-6 rounded-full", i < score ? (score >= 3 ? "pop-spring bg-[var(--color-tier-initial)]" : score === 2 ? "pop-spring bg-[var(--color-tier-reluctant)]" : "pop-spring bg-[var(--color-tier-hidden)]") : "bg-slate-200")} style={{ ["--i" as string]: i }} />
      ))}
    </span>
  );
}

export default async function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const enc = loadEncounter(id);
  if (!enc) notFound();
  const faculty = isFaculty(user);
  // Owner, a teammate on a class-shared patient, or faculty for recorded visits. Private practice stays private.
  if (enc.row.user_id !== user.id && !canSeeEpisode(user, id)) notFound();
  const { row, c, cfg, state } = enc;
  const own = row.user_id === user.id;
  const role = profession(cfg.professionId);
  const f = parse<Feedback | null>(row.feedback, null);
  const msgs = messagesOf(id);
  const wrap = parse<Record<string, string>>(row.wrapup, {});
  const student = get<{ name: string }>("SELECT name FROM users WHERE id = ?", row.user_id);
  const assignment = row.assignment_id ? get<{ title: string; type: string; feedback_released: number }>("SELECT title, type, feedback_released FROM assignments WHERE id = ?", row.assignment_id) : undefined;
  const withheld = !!assignment && !assignment.feedback_released && !faculty;
  // Columns added by the courses area; absent on a database that predates them.
  let review: { faculty_note: string | null; faculty_score: number | null } = { faculty_note: null, faculty_score: null };
  try {
    review = get("SELECT faculty_note, faculty_score FROM encounters WHERE id = ?", id) || review;
  } catch {}
  const history = attemptHistory(row.user_id, row.case_id);
  const idx = history.findIndex((h) => h.id === id);
  const prev = idx > 0 ? history[idx - 1] : null;
  const prevElicited = new Set(prev?.elicitedIds || []);
  const recorded = !!(row.assignment_id || row.journey_run_id);
  // The reveal belongs to the student who did the visit (faculty and teammates see the feedback only).
  const reward = own && !withheld && f ? visitReward(user.id, id) : null;

  const header = (
    <div className="mb-6">
      <Link href={faculty && !own ? "/faculty/courses" : "/student"} className="press mb-4 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-[13.5px] font-semibold text-ink-2 shadow-e1 ring-1 ring-line hover:text-ink pointer-coarse:min-h-11">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </Link>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="teal">{assignment ? assignment.title : cfg.mode === "adaptive" ? "Adaptive practice" : "Practice"}</Badge>
        <Badge>
          Level {cfg.knobs.level} · {LEVEL_NAMES[cfg.knobs.level]}
        </Badge>
        <Badge>Attempt {row.attempt}</Badge>
        {(cfg.visitNumber || 1) > 1 && <Badge tone="blue">Follow-up · visit {cfg.visitNumber}</Badge>}
        <TrustLabel kind={recorded ? "recorded" : "private"} />
        {cfg.perturbation && <Badge tone="violet">Patient variation: {cfg.perturbation.label}</Badge>}
        {row.parent_id && <Badge tone="blue">Rewound branch</Badge>}
      </div>
      <h1 className="rise mt-3 font-display text-[32px] font-black leading-[1.02] tracking-[-0.03em] text-ink sm:text-[42px]">
        Visit with {c.patient.name}
        {!own && student ? <span className="text-ink-3"> · {student.name}</span> : ""}
      </h1>
      <p className="mt-1 text-[14.5px] text-ink-2">
        {role.name} · {state.turn} turns · <When at={row.ended_at} />
      </p>
    </div>
  );

  if (!f || withheld) {
    return (
      <AppShell user={user}>
        {header}
        <Card className="max-w-2xl p-6">
          {withheld ? (
            <>
              <h2 className="font-display text-xl font-semibold text-ink">Submitted</h2>
              <p className="mt-1 text-[14.5px] text-ink-2">Your instructor will release feedback for “{assignment!.title}” after the assessment closes.</p>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl font-semibold text-ink">This visit has not been scored yet</h2>
              <p className="mb-4 mt-1 text-[14.5px] text-ink-2">{row.status === "active" || row.status === "paused" ? "The visit is still in progress." : "Scoring did not finish. Your transcript and write-up are saved."}</p>
              {row.status === "submitted" ? <FinishScoring id={id} /> : own ? <LinkButton href={`/encounter/${id}`}>Return to the visit</LinkButton> : null}
            </>
          )}
        </Card>
      </AppShell>
    );
  }

  const tl = timeline(c, cfg, msgs);
  const critMissed = f.missed.filter((m) => m.importance === "critical");
  const meta = (m: (typeof msgs)[number]) => parse<{ revealed?: string[]; deflected?: string[]; rapportDelta?: number; questionType?: string }>(m.meta, {});
  const factText = (fid: string) => c.facts.find((x) => x.id === fid);
  const naCount = f.domains.filter((d) => d.score === null).length;

  // The replay is built from what this page already shows: the timeline, each turn's lines and the
  // topics it unlocked or deflected. Nothing else from the case reaches the browser.
  const replay: ReplayTurn[] = tl.map((p) => {
    const s = msgs.find((m) => m.turn === p.turn && m.speaker === "student");
    const pm = msgs.find((m) => m.turn === p.turn && m.speaker === "patient");
    const x = pm ? meta(pm) : {};
    return {
      turn: p.turn,
      score: p.score,
      coverage: p.coverage,
      communication: p.communication,
      comfort: p.comfort,
      note: p.note,
      student: s?.text || "",
      patient: pm ? pm.text.replace(/\*[^*]*\*/g, " ").replace(/\s+/g, " ").trim() : "",
      unlocked: (x.revealed || []).map((fid) => factText(fid)?.topic || "").filter(Boolean),
      deflected: (x.deflected || []).map((fid) => factText(fid)?.topic || "").filter(Boolean),
      delta: x.rapportDelta || 0,
      outside: msgs.some((m) => m.turn === p.turn && m.speaker === "system" && m.text.startsWith("Outside the case record")),
    };
  });
  const shownSections = SECTIONS.filter((s) => (s.id === "replay" ? tl.length > 1 : s.id === "attempts" ? history.length > 1 : true));

  return (
    <AppShell user={user}>
      {header}

      {f.needsReview && (
        <div role="alert" className="mb-4 flex gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] text-rose-900">
          <Flag className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
          <p>
            <span className="font-semibold">Flagged for instructor review:</span> {f.reviewReasons.join("; ")}. An instructor should look at this visit whatever the total score.
          </p>
        </div>
      )}
      {review.faculty_note && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-[14px] text-violet-950">
          <span className="font-semibold">From your instructor{review.faculty_score !== null ? ` (adjusted score ${Math.round(review.faculty_score)}%)` : ""}:</span> {review.faculty_note}
        </div>
      )}
      {faculty && !own && (
        <div className="mb-4">
          <FacultyReview encounterId={id} note={review.faculty_note} score={review.faculty_score} />
        </div>
      )}

      {/* Hero: the score and summary beside the reward reveal. */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className={cx("rise overflow-hidden p-5 sm:p-6", reward ? "lg:col-span-7" : "lg:col-span-12")}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ScoreRing total={f.total} max={f.max} percent={f.percent} size={164} />
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-ink-2">{f.rubricType === "domain4" ? "Rubric total" : "Points"}</div>
              {prev && (
                <div className={cx("pop-spring mt-1 inline-flex rounded-full px-2.5 py-0.5 font-mono text-[13px] font-bold tabular-nums", f.percent >= prev.percent ? "bg-[var(--color-xp)] text-ink" : "bg-rose-100 text-rose-800")}>
                  {f.percent >= prev.percent ? "+" : ""}
                  {f.percent - prev.percent} pts vs attempt {prev.attempt}
                </div>
              )}
              <p className="mt-1.5 max-w-[22rem] text-[12.5px] leading-relaxed text-ink-3">
                {f.percent}%{naCount ? `, ${naCount} domain(s) not applicable` : ""}. A discussion aid, not a pass or fail grade.
              </p>
            </div>
          </div>
          <p className="mt-5 max-w-3xl rounded-2xl bg-surface-2 px-4 py-3 text-[16px] leading-relaxed text-ink">{f.summary}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-[var(--color-xp-soft)] p-3">
              <dt className="text-[12px] font-bold text-[var(--color-xp-ink)]">findings elicited</dt>
              <dd className="font-display text-[28px] font-black leading-none tabular text-ink">
                {f.elicited.length}
                <span className="text-[15px] text-ink-3"> / {f.elicited.length + f.missed.length}</span>
              </dd>
            </div>
            <div className={cx("rounded-2xl p-3", critMissed.length ? "bg-[var(--color-tier-hidden-soft)]" : "bg-surface-2")}>
              <dt className={cx("text-[12px] font-bold", critMissed.length ? "text-[var(--color-tier-hidden-ink)]" : "text-ink-3")}>critical missed</dt>
              <dd className={cx("font-display text-[28px] font-black leading-none tabular", critMissed.length ? "text-[var(--color-tier-hidden-ink)]" : "text-ink")}>{critMissed.length}</dd>
            </div>
            <div className="rounded-2xl bg-[var(--color-mastery-soft)] p-3">
              <dt className="text-[12px] font-bold text-[var(--color-mastery-ink)]">patient comfort, from {state.rapportHistory[0]} to {state.rapport}</dt>
              <dd className="flex items-end gap-2">
                <span className="font-display text-[28px] font-black leading-none tabular text-ink">{state.rapport}</span>
                <Spark values={state.rapportHistory} />
              </dd>
            </div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <dt className="text-[12px] font-bold text-ink-3">Questions{state.hintsUsed > 0 ? ` · ${state.hintsUsed} coach hint${state.hintsUsed === 1 ? "" : "s"} used` : ""}</dt>
              <dd>
                <QuestionMix stats={state.stats} />
              </dd>
            </div>
          </dl>
        </Card>
        {reward && (
          <div className="rise lg:col-span-5" style={{ ["--i" as string]: 2 }}>
            <RewardReveal reward={reward} />
          </div>
        )}
      </div>

      <Card className="mt-4 overflow-hidden">
        {own && assignment?.type !== "exam" && (
          <div className="bg-gradient-to-r from-brand-50 to-[var(--color-xp-soft)] px-5 py-5 sm:px-6">
            <h2 className="font-display text-[18px] font-extrabold text-ink">For your next attempt</h2>
            <p className="mt-0.5 max-w-3xl text-[13px] text-ink-3">Start over to practise the same visit again (optionally with the patient in a different mood), or book a follow-up where the patient remembers you and this conversation.</p>
            <ol className="mb-4 mt-3 grid gap-2 sm:grid-cols-2">
              {f.nextAttempt.map((n, i) => (
                <li key={i} className="rise flex gap-2.5 rounded-2xl bg-surface px-3 py-2.5 text-[13.5px] leading-relaxed text-ink shadow-e1 ring-1 ring-inset ring-line" style={{ ["--i" as string]: i }}>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[var(--color-xp)] font-display text-[12.5px] font-black text-ink">{i + 1}</span>
                  {n}
                </li>
              ))}
            </ol>
            {cfg.mode !== "exam" && cfg.mode !== "journey" && <RetryButtons caseId={row.case_id} level={cfg.knobs.level} assignmentId={row.assignment_id} allowVariation />}
          </div>
        )}
      </Card>

      <div className="mt-8 grid gap-8 xl:grid-cols-[11rem_minmax(0,1fr)]">
        {/* Section index */}
        <nav aria-label="On this page" className="hidden xl:block">
          <ol className="sticky top-6 space-y-0.5 border-l border-line">
            {shownSections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="-ml-px block border-l-[3px] border-transparent py-1.5 pl-3 text-[13px] font-semibold text-ink-3 hover:border-[var(--color-xp)] hover:text-ink">
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-6">
          {tl.length > 1 && (
            <section id="replay" className="scroll-mt-6">
              <Card>
                <CardHeader title="The visit, turn by turn" subtitle="Calculated live from each turn as it happened: findings covered against a steady pace, how you communicated, and how comfortable the patient was. No model call; the same line your instructor can watch live. Turn numbers match the transcript below." />
                <div className="p-4 sm:p-5">
                  <VisitReplay turns={replay} />
                </div>
              </Card>
            </section>
          )}

          <section id="rubric" className="scroll-mt-6">
            <Card>
              <CardHeader title={f.rubricType === "domain4" ? "Rubric, with the evidence for each score" : "Checklist, with the evidence for each item"} subtitle="Every score points at the turn it came from. Each quote below was found in your transcript by code before it was shown. Select a turn to jump to it." />
              <div className="grid gap-3 p-4 sm:p-5">
                {f.domains.map((d, di) => (
                  <div key={d.key} className="rise grid gap-3 rounded-2xl bg-surface-2 p-4 ring-1 ring-inset ring-line/70 md:grid-cols-[15rem_minmax(0,1fr)]" style={{ ["--i" as string]: di }}>
                    <div>
                      <div className="font-display text-[16px] font-extrabold leading-tight text-ink">{d.name}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {d.score === null ? (
                          <Badge>Not applicable</Badge>
                        ) : f.rubricType === "domain4" ? (
                          <>
                            <Pips score={d.score} />
                            <Badge tone={TONE[d.score as 1 | 2 | 3 | 4]}>
                              {d.score} · {LABEL[d.score]}
                            </Badge>
                          </>
                        ) : (
                          <Badge tone={d.score >= d.max * 0.8 ? "green" : d.score >= d.max * 0.5 ? "amber" : "red"}>
                            {d.score} / {d.max}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-[14px]">
                      <p className="leading-relaxed text-ink">{d.rationale}</p>
                      {d.evidence.length > 0 && (
                        <ul className="mt-3 space-y-2.5">
                          {d.evidence.map((e, i) => (
                            <li key={i} className="rounded-2xl bg-surface px-3 py-2.5 ring-1 ring-inset ring-line">
                              {e.quote && <EvidenceChip quote={e.quote} turn={e.turn} />}
                              <div className={cx("leading-relaxed text-ink-2", e.quote && "mt-1.5")}>
                                {e.note}
                                {!e.quote && <TurnLink turn={e.turn} />}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section id="findings" className="scroll-mt-6 space-y-6">
            <Card className="p-5 sm:p-6">
              <CollectionBoard f={f} prevElicited={prevElicited} deflected={state.deflected} hasPrev={!!prev} />
            </Card>

            {!!f.mismatches?.length && (
              <Card>
                <CardHeader title="What the patient said versus what the chart showed" subtitle="Built into the case to test whether you cross-check the record." />
                <ul className="divide-y divide-line/70">
                  {f.mismatches.map((m) => (
                    <li key={m.id} className="p-4 text-[13.5px]">
                      <Badge tone={m.noticed ? "green" : "red"}>{m.noticed ? "You caught this" : "Not picked up"}</Badge>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <p className="rounded-lg bg-surface-2 px-3 py-2 leading-relaxed text-ink">
                          <span className="block text-[12px] font-semibold text-ink-3">Patient</span>
                          {m.patientClaim}
                        </p>
                        <p className="rounded-lg bg-surface-2 px-3 py-2 leading-relaxed text-ink">
                          <span className="block text-[12px] font-semibold text-ink-3">Chart</span>
                          {m.recordEvidence}
                        </p>
                      </div>
                      {m.comment && <p className="mt-2 leading-relaxed text-ink-2">{m.comment}</p>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>

          <section id="objectives" className="scroll-mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Learning objectives" subtitle="Set by the faculty author of this case. Met only when the disclosure record and the examiner agree." />
              <div className="flex gap-1 px-4 pt-3" aria-hidden>
                {f.objectives.map((o) => (
                  <span key={o.id} className={cx("bar-grow h-2.5 flex-1 rounded-full", o.met === "met" ? "bg-[var(--color-tier-initial)]" : o.met === "partial" ? "bg-[var(--color-tier-reluctant)]" : "bg-[var(--color-tier-hidden)]")} />
                ))}
              </div>
              <ul className="divide-y divide-line/70">
                {f.objectives.map((o) => (
                  <li key={o.id} className="p-4 text-[13.5px]">
                    <div className="flex items-start gap-2">
                      <Badge tone={MET[o.met][0]} className="mt-0.5 shrink-0">
                        {MET[o.met][1]}
                      </Badge>
                      <span className="font-semibold leading-relaxed text-ink">{o.text}</span>
                    </div>
                    {o.comment && <p className="mt-1 leading-relaxed text-ink-2">{o.comment}</p>}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Exams, tests and records" />
              <div className="space-y-4 p-4 text-[13.5px]">
                <div>
                  <div className="mb-1.5 text-[12.5px] font-semibold text-ink-3">Requested</div>
                  {f.actionsDone.length ? (
                    <div className="flex flex-wrap gap-1">
                      {f.actionsDone.map((a) => (
                        <Badge key={a.id} tone="teal">
                          {a.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-ink-3">None.</span>
                  )}
                </div>
                <div>
                  <div className="mb-1.5 text-[12.5px] font-semibold text-ink-3">Would have helped</div>
                  {f.actionsMissed.length ? (
                    <div className="flex flex-wrap gap-1">
                      {f.actionsMissed.map((a) => (
                        <Badge key={a.id} tone={IMP[a.importance]}>
                          {a.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-ink-3">Nothing important left out.</span>
                  )}
                </div>
                {f.unnecessaryOrders.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[12.5px] font-semibold text-ink-3">Requested but not part of this case</div>
                    <div className="flex flex-wrap gap-1">
                      {f.unnecessaryOrders.map((u, i) => (
                        <Badge key={i}>{u}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </section>

          <section id="coaching" className="scroll-mt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="bg-[var(--color-xp-soft)]">
                <CardHeader title="What went well" />
                <ul className="space-y-2.5 p-4 text-[13.5px] leading-relaxed text-ink">
                  {f.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-[var(--color-xp)] p-0.5 text-ink" aria-hidden />
                      <span>
                        {s.text}
                        <TurnLink turn={s.turn} />
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="bg-[var(--color-flame-soft)]">
                <CardHeader title="What to work on" />
                <ul className="space-y-2.5 p-4 text-[13.5px] leading-relaxed text-ink">
                  {f.improvements.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-flame-ink)]" aria-hidden />
                      <span>
                        {s.text}
                        <TurnLink turn={s.turn} />
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
            {(f.safetyConcerns.length > 0 || f.accuracyIssues.length > 0) && (
              <Card className="border-2 border-rose-300 bg-rose-50/60">
                <CardHeader title="Safety and accuracy" subtitle="Checked against the case answer key and the faculty's knowledge sources only." />
                <ul className="space-y-2.5 p-4 text-[13.5px] leading-relaxed text-ink">
                  {f.safetyConcerns.map((s, i) => (
                    <li key={"s" + i} className="flex gap-2">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
                      <span>
                        <Badge tone="red" className="mr-1.5">
                          Safety
                        </Badge>
                        {s.text}
                        <TurnLink turn={s.turn} />
                      </span>
                    </li>
                  ))}
                  {f.accuracyIssues.map((a, i) => (
                    <li key={"a" + i} className="flex gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                      <span>
                        <Badge tone="amber" className="mr-1.5">
                          Accuracy
                        </Badge>
                        You said: “{a.claim}”. {a.correction}
                        <TurnLink turn={a.turn} />
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>

          <section id="writeup" className="scroll-mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="How the interview was built" />
              <dl className="space-y-3 p-4 text-[13.5px]">
                {(
                  [
                    ["Structure", f.interview.structure],
                    ["Sequencing", f.interview.sequencing],
                    ["Question mix", f.interview.questionMix],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[12.5px] font-semibold text-ink-3">{k}</dt>
                    <dd className="leading-relaxed text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            <Card>
              <CardHeader title={`Your ${role.noteFormat} write-up`} />
              <div className="space-y-3 p-4 text-[13.5px]">
                <p className="leading-relaxed text-ink">{f.wrapUpReview}</p>
                {role.wrapUp.map((w) => (
                  <div key={w.id}>
                    <div className="text-[12.5px] font-semibold text-ink-3">{w.label}</div>
                    <div className="mt-0.5 whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 leading-relaxed text-ink-2">{wrap[w.id] || "Left blank"}</div>
                  </div>
                ))}
                <details className="group rounded-lg border border-line px-3 py-2">
                  <summary className="cursor-pointer text-[13px] font-medium text-ink-2">Show the case answer key</summary>
                  <div className="mt-2 space-y-1.5 leading-relaxed text-ink-2">
                    <p>
                      <span className="font-semibold text-ink">Primary problem:</span> {c.answerKey.primaryProblem}
                    </p>
                    {c.answerKey.differential.length > 0 && (
                      <p>
                        <span className="font-semibold text-ink">Differential:</span> {c.answerKey.differential.join("; ")}
                      </p>
                    )}
                    <p>
                      <span className="font-semibold text-ink">Plan:</span> {c.answerKey.plan.join("; ")}
                    </p>
                    {c.answerKey.redFlags.length > 0 && (
                      <p>
                        <span className="font-semibold text-ink">Red flags:</span> {c.answerKey.redFlags.join("; ")}
                      </p>
                    )}
                  </div>
                </details>
              </div>
            </Card>
          </section>

          {history.length > 1 && (
            <section id="attempts" className="scroll-mt-6">
              <Card>
                <CardHeader title="What changed across your attempts" subtitle="Same patient, same answer key. Variation changes the patient's mood, not the facts." />
                <div className="overflow-x-auto p-4">
                  <table className="w-full border-collapse text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-line text-[12px] text-ink-3">
                        <th className="py-2 pr-3 font-medium">Domain</th>
                        {history.map((h) => (
                          <th key={h.id} className={cx("px-2 py-2 font-medium", h.id === id && "text-ink")}>
                            <Link href={`/encounter/${h.id}/feedback`} className="hover:underline">
                              Attempt {h.attempt}
                            </Link>
                            <div className="font-normal">
                              L{h.level}
                              {h.variation ? ` · ${h.variation}` : ""}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {f.domains.map((d) => (
                        <tr key={d.key} className="border-b border-line/60">
                          <td className="py-2 pr-3 text-ink">{d.name}</td>
                          {history.map((h, i) => {
                            const s = h.domains.find((x) => x.key === d.key)?.score ?? null;
                            const before = i > 0 ? (history[i - 1].domains.find((x) => x.key === d.key)?.score ?? null) : null;
                            const delta = s !== null && before !== null ? s - before : 0;
                            return (
                              <td key={h.id} className={cx("px-2 py-2 font-mono tabular-nums", h.id === id && "bg-brand-50/60 font-semibold")}>
                                {s === null ? "N/A" : s}
                                {delta !== 0 && <span className={cx("ml-1 text-[11px]", delta > 0 ? "text-emerald-700" : "text-rose-700")}>{delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="font-semibold">
                        <td className="py-2 pr-3">Overall</td>
                        {history.map((h) => (
                          <td key={h.id} className={cx("px-2 py-2 font-mono tabular-nums", h.id === id && "bg-brand-50/60")}>
                            {h.percent}%
                          </td>
                        ))}
                      </tr>
                      <tr className="text-ink-2">
                        <td className="py-2 pr-3">Critical findings missed</td>
                        {history.map((h) => (
                          <td key={h.id} className={cx("px-2 py-2 font-mono tabular-nums", h.id === id && "bg-brand-50/60")}>
                            {h.missedCritical}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                  {prev && (
                    <p className="mt-3 text-[13.5px] leading-relaxed text-ink">
                      <span className="font-semibold">New this time:</span> {f.elicited.filter((e) => !prevElicited.has(e.id)).map((e) => e.chart).join("; ") || "nothing you had not already found"}.
                      {f.missed.some((m) => prevElicited.has(m.id)) && (
                        <>
                          {" "}
                          <span className="font-semibold">Found last time but not this time:</span> {f.missed.filter((m) => prevElicited.has(m.id)).map((m) => m.topic).join("; ")}.
                        </>
                      )}
                    </p>
                  )}
                </div>
              </Card>
            </section>
          )}

          <section id="transcript" className="scroll-mt-6">
            <Card>
              <CardHeader title="Transcript" subtitle="Annotated with what each question unlocked and how the patient's comfort moved." />
              <div className="space-y-3 p-4 sm:p-5">
                {msgs.map((m) => {
                  const x = meta(m);
                  if (m.speaker === "student")
                    return (
                      <div key={m.id} id={`t${m.turn}`} className="flex scroll-mt-20 gap-3 rounded-xl px-1 py-0.5 target:bg-amber-50 target:ring-1 target:ring-amber-200">
                        <span className="mt-0.5 w-8 shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-3">T{m.turn}</span>
                        <div className="text-[14px] leading-relaxed">
                          <span className="font-semibold text-brand-700">{own ? "You" : "Student"}:</span> <span className="text-ink">{m.text}</span>
                        </div>
                      </div>
                    );
                  if (m.speaker === "patient")
                    return (
                      <div key={m.id} className="flex gap-3">
                        <span className="w-8 shrink-0" />
                        <div className="text-[14px] leading-relaxed">
                          <span className="font-semibold text-ink-2">{c.patient.name.split(" ")[0]}:</span> <span className="text-ink">{m.text}</span>
                          <div className="mt-1 flex flex-wrap items-center gap-1 text-[11.5px]">
                            {x.questionType && !["other", "greeting"].includes(x.questionType) && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-ink-2">{QTYPE[x.questionType] || x.questionType}</span>}
                            {!!x.rapportDelta && (
                              <span className={cx("rounded px-1.5 py-0.5 font-mono", x.rapportDelta > 0 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800")}>
                                comfort {x.rapportDelta > 0 ? "+" : ""}
                                {x.rapportDelta}
                              </span>
                            )}
                            {(x.revealed || []).map((fid) => (
                              <span key={fid} className="rounded-full bg-[var(--color-xp-soft)] px-2 py-0.5 font-semibold text-[var(--color-xp-ink)] ring-1 ring-inset ring-[var(--color-xp)]">
                                unlocked: {factText(fid)?.topic}
                              </span>
                            ))}
                            {(x.deflected || []).map((fid) => (
                              <span key={fid} className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-900">
                                deflected: {factText(fid)?.topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  const outside = m.speaker === "system" && m.text.startsWith("Outside the case record");
                  return (
                    <div key={m.id} className="flex gap-3">
                      <span className="w-8 shrink-0" />
                      <div className={cx("whitespace-pre-wrap rounded-lg px-3 py-2 text-[12.5px] leading-relaxed", outside ? "bg-rose-50 text-rose-900 ring-1 ring-inset ring-rose-200" : m.speaker === "coach" ? "bg-amber-50 text-amber-950" : m.speaker === "instructor" ? "bg-violet-50 text-violet-950" : "bg-surface-2 font-mono text-ink-2")}>
                        <span className="mr-1.5 font-sans text-[11px] font-semibold uppercase tracking-wide">{outside ? "Guardrail" : m.speaker === "system" ? "Chart" : m.speaker}</span>
                        {m.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
