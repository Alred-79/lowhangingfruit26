import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDashed, Flag, MessageSquareQuote, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import FacultyReview from "@/components/courses/FacultyReview";
import When from "@/components/courses/When";
import ScoreRing from "@/components/feedback/ScoreRing";
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

/** One cell per finding in the case: filled when elicited, outlined when missed. Read from the ledger. */
function FindingsLedger({ f }: { f: Feedback }) {
  const order = { critical: 0, important: 1, minor: 2 } as const;
  const cells = [...f.elicited.map((e) => ({ id: e.id, got: true, imp: e.importance, text: e.chart })), ...f.missed.map((m) => ({ id: m.id, got: false, imp: m.importance, text: `${m.topic}: ${m.chart}` }))].sort((a, b) => order[a.imp] - order[b.imp] || Number(b.got) - Number(a.got));
  const tone = { critical: "bg-rose-500 ring-rose-500", important: "bg-amber-500 ring-amber-500", minor: "bg-slate-400 ring-slate-400" } as const;
  return (
    <div>
      <div className="flex flex-wrap gap-1" role="list" aria-label={`${f.elicited.length} of ${cells.length} findings elicited`}>
        {cells.map((c) => (
          <span key={c.id} role="listitem" title={`${c.got ? "Elicited" : "Missed"} (${c.imp}): ${c.text}`} className={cx("h-5 w-3.5 rounded-[4px] ring-[1.5px] ring-inset", c.imp === "critical" && "h-6", c.got ? tone[c.imp] : `bg-transparent ${tone[c.imp].split(" ")[1]} opacity-70`)} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-2.5 rounded-[3px] bg-slate-500" aria-hidden /> elicited
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-2.5 rounded-[3px] ring-[1.5px] ring-inset ring-slate-500" aria-hidden /> missed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-500" aria-hidden /> critical
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden /> important
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden /> minor
        </span>
        <span>From the disclosure record, not from a model&apos;s impression.</span>
      </div>
    </div>
  );
}

function Pips({ score, max = 4 }: { score: number; max?: number }) {
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cx("h-2 w-5 rounded-full", i < score ? (score >= 3 ? "bg-brand-500" : score === 2 ? "bg-amber-500" : "bg-rose-500") : "bg-slate-200")} />
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

  const header = (
    <div className="mb-6">
      <Link href={faculty && !own ? "/faculty/courses" : "/student"} className="mb-4 inline-flex min-h-9 items-center gap-1.5 rounded-md text-[13.5px] font-medium text-ink-3 hover:text-ink">
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
      <h1 className="mt-3 font-display text-[28px] font-semibold leading-tight text-ink sm:text-[32px]">
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

      {/* Hero: the score, the summary and the ledger of findings. */}
      <Card className="overflow-hidden">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div className="flex flex-col items-center gap-3 sm:flex-row lg:flex-col lg:items-start">
            <ScoreRing total={f.total} max={f.max} percent={f.percent} />
            <div className="text-center sm:text-left">
              <div className="text-[13px] font-semibold text-ink-2">{f.rubricType === "domain4" ? "Rubric total" : "Points"}</div>
              {prev && (
                <div className={cx("mt-0.5 font-mono text-[13px] font-semibold tabular-nums", f.percent >= prev.percent ? "text-emerald-700" : "text-rose-700")}>
                  {f.percent >= prev.percent ? "+" : ""}
                  {f.percent - prev.percent} pts vs attempt {prev.attempt}
                </div>
              )}
              <p className="mt-1 max-w-[16rem] text-[12.5px] leading-relaxed text-ink-3">
                {f.percent}%{naCount ? `, ${naCount} domain(s) not applicable` : ""}. A discussion aid, not a pass or fail grade.
              </p>
            </div>
          </div>
          <div className="min-w-0">
            <p className="max-w-3xl text-[16px] leading-relaxed text-ink">{f.summary}</p>
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <div>
                <div className="font-display text-[26px] font-semibold leading-none tabular text-ink">
                  {f.elicited.length}
                  <span className="text-[16px] text-ink-3"> / {f.elicited.length + f.missed.length}</span>
                </div>
                <div className="mt-1 text-[12.5px] text-ink-3">findings elicited</div>
              </div>
              <div>
                <div className={cx("font-display text-[26px] font-semibold leading-none tabular", critMissed.length ? "text-rose-700" : "text-ink")}>{critMissed.length}</div>
                <div className="mt-1 text-[12.5px] text-ink-3">critical missed</div>
              </div>
              <div>
                <div className="flex items-end gap-2">
                  <span className="font-display text-[26px] font-semibold leading-none tabular text-ink">{state.rapport}</span>
                  <Spark values={state.rapportHistory} />
                </div>
                <div className="mt-1 text-[12.5px] text-ink-3">
                  patient comfort, from {state.rapportHistory[0]} to {state.rapport}
                </div>
              </div>
              <div>
                <div className="text-[13.5px] leading-snug text-ink-2">
                  <span className="font-semibold tabular text-ink">{state.stats.open}</span> open, <span className="font-semibold tabular text-ink">{state.stats.focused}</span> focused, <span className="font-semibold tabular text-ink">{state.stats.closed}</span> closed, <span className="font-semibold tabular text-ink">{state.stats.leading + state.stats.multiple}</span> leading/stacked
                </div>
                <div className="mt-1 text-[12.5px] text-ink-3">Questions{state.hintsUsed > 0 ? ` · ${state.hintsUsed} coach hint${state.hintsUsed === 1 ? "" : "s"} used` : ""}</div>
              </div>
            </div>
            <div className="mt-5 border-t border-line pt-4">
              <FindingsLedger f={f} />
            </div>
          </div>
        </div>
        {own && assignment?.type !== "exam" && (
          <div className="border-t border-line bg-surface-2 px-5 py-5 sm:px-6">
            <h2 className="text-[14.5px] font-semibold text-ink">For your next attempt</h2>
            <p className="mt-0.5 max-w-3xl text-[13px] text-ink-3">Start over to practise the same visit again (optionally with the patient in a different mood), or book a follow-up where the patient remembers you and this conversation.</p>
            <ol className="mb-4 mt-3 grid gap-2 sm:grid-cols-2">
              {f.nextAttempt.map((n, i) => (
                <li key={i} className="flex gap-2.5 rounded-xl bg-surface px-3 py-2.5 text-[13.5px] leading-relaxed text-ink ring-1 ring-inset ring-line">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-100 font-mono text-[11px] font-semibold text-brand-800">{i + 1}</span>
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
                <a href={`#${s.id}`} className="-ml-px block border-l-2 border-transparent py-1 pl-3 text-[13px] text-ink-3 hover:border-brand-500 hover:text-ink">
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
              <div className="divide-y divide-line/70">
                {f.domains.map((d) => (
                  <div key={d.key} className="grid gap-3 p-4 sm:p-5 md:grid-cols-[15rem_minmax(0,1fr)]">
                    <div>
                      <div className="text-[14.5px] font-semibold text-ink">{d.name}</div>
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
                        <ul className="mt-3 space-y-2">
                          {d.evidence.map((e, i) => (
                            <li key={i} className="rounded-xl bg-surface-2 px-3.5 py-2.5">
                              {e.quote && (
                                <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                                  <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                                  <span className="min-w-0 flex-1 italic leading-relaxed text-ink">“{e.quote}”</span>
                                  <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-emerald-700">
                                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                                    found in transcript
                                    <TurnLink turn={e.turn} />
                                  </span>
                                </div>
                              )}
                              <div className={cx("leading-relaxed text-ink-2", e.quote && "mt-1 pl-6")}>
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
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader title={`Findings you elicited (${f.elicited.length})`} subtitle="From the disclosure record, not from a model's impression." />
                <ul className="space-y-1.5 p-4 text-[13.5px]">
                  {f.elicited.length === 0 && <li className="text-ink-3">None.</li>}
                  {f.elicited.map((e) => (
                    <li key={e.id} className="flex items-start gap-2">
                      <Badge tone={IMP[e.importance]} className="mt-0.5 shrink-0">
                        {e.importance}
                      </Badge>
                      <span className="leading-relaxed text-ink">
                        {e.chart}
                        <TurnLink turn={e.turn} />
                        {prev && !prevElicited.has(e.id) && (
                          <Badge tone="green" className="ml-1.5">
                            new
                          </Badge>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <CardHeader title={`Findings you missed (${f.missed.length})`} subtitle="Most important first." />
                <ul className="space-y-1.5 p-4 text-[13.5px]">
                  {f.missed.length === 0 && <li className="text-ink-3">Nothing missed.</li>}
                  {f.missed.map((m) => (
                    <li key={m.id} className="flex items-start gap-2">
                      <Badge tone={IMP[m.importance]} className="mt-0.5 shrink-0">
                        {m.importance}
                      </Badge>
                      <span className="leading-relaxed text-ink">
                        <span className="font-semibold">{m.topic}:</span> {m.chart}
                        {state.deflected[m.id] ? <span className="ml-1 text-amber-800">(you asked; the patient was not ready to say)</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

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
              <Card>
                <CardHeader title="What went well" />
                <ul className="space-y-2.5 p-4 text-[13.5px] leading-relaxed text-ink">
                  {f.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      <span>
                        {s.text}
                        <TurnLink turn={s.turn} />
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <CardHeader title="What to work on" />
                <ul className="space-y-2.5 p-4 text-[13.5px] leading-relaxed text-ink">
                  {f.improvements.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
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
              <Card className="border-rose-200">
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
                      <div key={m.id} id={`t${m.turn}`} className="flex scroll-mt-20 gap-3 rounded-lg target:bg-amber-50 target:ring-1 target:ring-amber-200">
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
                              <span key={fid} className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-800">
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
