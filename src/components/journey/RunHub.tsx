"use client";

import { ArrowRight, Bot, CircleAlert, Eye, EyeOff, GitBranch, Hourglass, Inbox, ListChecks, Map as MapIcon, MessagesSquare, PenLine, Play, RotateCcw, Send, Sparkles, Stethoscope, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CountUp } from "@/components/motion";
import { Badge, Button, Textarea, cx } from "@/components/ui";
import { BEHAVIOURS, SBAR_FIELDS, STATUS_LABEL, statusBoard, type HuddleItem, type RunView, type Sbar, type StageView, type TraceEvaluation } from "@/lib/journey/types";
import ConsultPanel from "./ConsultPanel";
import FinalView from "./FinalView";
import JourneyGraph from "./JourneyGraph";
import LevelPath, { stopsOf } from "./LevelPath";
import { Avatar, DomainMeter, EntryList, LitCtx, post, ProvenancePanel, SBAR_HUE, SbarCard, SbarLetter, Spinner, StatusBadge, StatusIcon, TraceTable, Transcript, useRun, v, type Live } from "./shared";

type Step = string; // stage id | "huddle" | "final"

/** A plain link styled as a button. Starting or continuing the visit must never wait on a request or on client routing. */
function VisitLink({ href, small, children }: { href: string; small?: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={cx(
        "press inline-flex items-center justify-center gap-1.5 bg-brand-600 font-bold text-white shadow-[inset_0_1.5px_0_rgb(255_255_255/0.22),inset_0_-2px_0_rgb(0_24_30/0.18),0_8px_18px_-8px_oklch(0.45_0.132_198/0.7)] transition-colors hover:bg-brand-500",
        small ? "min-h-9 rounded-[12px] px-3.5 text-[13px] pointer-coarse:min-h-11" : "min-h-11 rounded-2xl px-5 text-[14.5px]",
      )}
    >
      <Play className="h-4 w-4 fill-current" aria-hidden />
      {children}
    </a>
  );
}

/** A titled block in the hub: icon tile, display heading, lead line. */
function Panel({ icon: Icon, tone = "bg-brand-600 text-white", title, subtitle, action, children, className }: { icon: typeof Users; tone?: string; title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <section className={cx("rise rounded-[22px] border border-line/80 bg-surface shadow-e1", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-xl clay", tone)}><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
          <div className="min-w-0">
            <h2 className="font-display text-[17px] font-extrabold leading-snug tracking-[-0.02em] text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 max-w-3xl text-[13px] leading-relaxed text-ink-3">{subtitle}</p>}
          </div>
        </div>
        {action}
      </header>
      {children && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}

// ---------- A colleague's (AI) encounter ----------

function AiStage({ view, s, live, onOpen }: { view: RunView; s: StageView; live: Live; onOpen: (id: string) => void }) {
  const running = s.status !== "complete" && s.status !== "error";
  const isLive = running && live.stageId === s.stage.id && live.lines.length > 0;
  const lines = isLive ? live.lines : s.transcript;
  const [showTalk, setShowTalk] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isLive && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [isLive, lines]);
  const mine = view.entries.filter((e) => e.stageId === s.stage.id);
  const handoff = view.handoffs.find((h) => h.fromStage === s.stage.id);
  const used = view.links.filter((l) => l.stageId === s.stage.id && l.relation === "uses");
  const usedTargets = [...new Set(used.map((l) => l.to))].map((id) => view.entries.find((e) => e.id === id)).filter((e) => e && e.stageOrder < s.stage.order);
  return (
    <div className="space-y-4">
      <section className="rise overflow-hidden rounded-[22px] border border-line/80 bg-surface shadow-e1">
        <header className="flex flex-wrap items-start justify-between gap-3 bg-surface-2/70 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={s.clinicianName} className="h-12 w-12 text-[15px]" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-ink px-2 py-0.5 font-mono text-[11px] font-bold text-white">Encounter {s.stage.order}</span>
                <Badge><Bot className="h-3 w-3" aria-hidden />AI colleague</Badge>
                {isLive && <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2 py-0.5 text-[11.5px] font-bold text-rose-900"><span className="live-dot h-2 w-2 rounded-full bg-[var(--color-live)]" aria-hidden />Live</span>}
              </div>
              <h2 className="mt-1 font-display text-[19px] font-black leading-tight tracking-[-0.025em] text-ink">{`${s.clinicianName} sees ${view.patient.name}`}</h2>
              <p className="mt-0.5 max-w-3xl text-[13px] leading-relaxed text-ink-3">{`${s.stage.visitLabel || "Telehealth visit"} · ${s.stage.simTime} · an AI colleague playing a faculty-provided persona. The patient's answers come from the same case engine you will use.`}</p>
            </div>
          </div>
          {lines.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setShowTalk((x) => !x)}>
              {showTalk ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
              {showTalk ? "Hide the conversation" : "Show the conversation"}
            </Button>
          )}
        </header>
        <div className="p-4">
          {s.status === "pending" && (
            <p className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 px-4 py-4 text-sm text-ink-3"><Hourglass className="float-idle h-4 w-4 text-brand-500" aria-hidden />This visit starts when the encounter before it has finished and handed off.</p>
          )}
          {showTalk && lines.length > 0 && (
            <div ref={box} className="scroll-quiet max-h-[26rem] overflow-y-auto pr-1">
              <Transcript lines={lines} clinician={s.clinicianName} patient={view.patient.name} />
            </div>
          )}
          {running && s.status !== "pending" && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50 px-3.5 py-2.5">
              <Spinner label={live.stageId === s.stage.id && live.phase ? live.phase : lines.length ? "The visit is in progress" : `${s.clinicianName} is reading the record and the handoff`} hint="A colleague's visit, note and handoff take about two minutes" />
              <span className="text-xs text-ink-3">You can read along or wait: the visit continues on its own and the handoff appears here when it is done.</span>
            </div>
          )}
        </div>
      </section>

      {s.status === "complete" && (
        <>
          {usedTargets.length > 0 && (
            <Panel icon={GitBranch} tone="bg-surface-2 text-brand-700" title="Earlier information this encounter drew on" subtitle="Entries from the record or an earlier professional that shaped a question in this visit.">
              <div className="-mx-2"><EntryList entries={usedTargets.map((e) => e!)} onOpen={onOpen} /></div>
            </Panel>
          )}
          <Panel icon={Sparkles} tone="bg-[var(--color-xp)] text-ink" title="What this encounter added to the shared patient state" subtitle={`${mine.length} entries. Patient statements and results come from the case file; assessments are ${s.clinicianName}'s and are marked as such.`}>
            <div className="-mx-2"><EntryList entries={mine} onOpen={onOpen} showWho={false} /></div>
          </Panel>
          {handoff && (
            <div className="space-y-2">
              <SbarCard handoff={handoff} />
              {handoff.evaluation ? (
                <details className="group rounded-[20px] border border-line/80 bg-surface px-4 py-3 shadow-e1">
                  <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 text-[14px] font-bold text-ink [&::-webkit-details-marker]:hidden">
                    <ListChecks className="h-4 w-4 text-brand-600" aria-hidden />
                    <span className="flex-1">Worked example: how this handoff measures up against the communication behaviours</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11.5px] font-bold text-emerald-900">{handoff.evaluation.behaviours.filter((b) => b.observed === "yes").length} of {handoff.evaluation.behaviours.length} observed</span>
                  </summary>
                  <div className="mt-3"><TraceTable evaluation={handoff.evaluation} /></div>
                </details>
              ) : (
                <p className="text-xs text-ink-3">The communication review of this handoff is being written.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- The learner's own encounter ----------

function SbarForm({ view, s, refresh, onSent }: { view: RunView; s: StageView; refresh: () => void; onSent: () => void }) {
  const [sbar, setSbar] = useState<Sbar>({ situation: "", background: "", assessment: "", recommendation: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);
  const next = view.stages.find((x) => x.stage.order === s.stage.order + 1);
  const empty = SBAR_FIELDS.filter((f) => !sbar[f.key].trim()).map((f) => f.label);
  async function submit(force = false) {
    // An SBAR with a blank section still goes out if the learner insists, but never by accident.
    if (empty.length && !force) return setConfirm(true);
    setConfirm(false);
    setBusy(true);
    setErr("");
    onSent(); // stay on this page so the review of the handoff is seen before the next encounter
    const r = await post<{ evaluation: TraceEvaluation }>(`/api/journeys/runs/${view.id}/handoff`, sbar);
    setBusy(false);
    if (r.error) return setErr(r.error);
    refresh();
  }
  const filled = 4 - empty.length;
  return (
    <Panel
      icon={PenLine}
      title={`Write your SBAR handoff to ${next ? `${next.clinicianName}, ${next.stage.roleTitle}` : "the care team"}`}
      subtitle={next ? `${next.clinicianName} will read this before seeing ${view.patient.name}. What you leave out, they will not know to ask.` : "You are the last professional in this journey. This goes to the whole team ahead of the huddle."}
      action={
        <span className="flex items-center gap-2" aria-label={`${filled} of 4 sections written`}>
          {SBAR_FIELDS.map((f) => (
            <span key={f.key} className={cx("grid h-7 w-7 place-items-center rounded-lg font-display text-[13px] font-black transition-[background-color,color,transform] duration-200", sbar[f.key].trim() ? "scale-100 text-white clay" : "scale-90 bg-surface-2 text-ink-3 ring-1 ring-inset ring-line")} style={sbar[f.key].trim() ? { background: SBAR_HUE[f.key].tile } : undefined} aria-hidden>
              {f.label[0]}
            </span>
          ))}
          <span className="font-mono text-[12px] font-bold text-ink-2">{filled}/4</span>
        </span>
      }
    >
      <div className="@container space-y-3">
        <div className="grid gap-2.5 @2xl:grid-cols-2">
          {SBAR_FIELDS.map((f) => {
            const h = SBAR_HUE[f.key];
            return (
              <div key={f.key} className="rounded-2xl p-3 transition-shadow focus-within:shadow-e2" style={{ background: h.soft }}>
                <label htmlFor={`sbar-${f.key}`} className="mb-2 flex items-center gap-2.5">
                  <SbarLetter k={f.key} label={f.label} className="h-8 w-8 text-[16px]" />
                  <span className="font-display text-[14.5px] font-extrabold" style={{ color: h.ink }}>{f.label}</span>
                  <span className="ml-auto font-mono text-[11px] text-ink-3">{sbar[f.key].trim().split(/\s+/).filter(Boolean).length} words</span>
                </label>
                <Textarea id={`sbar-${f.key}`} rows={3} value={sbar[f.key]} onChange={(e) => { setSbar({ ...sbar, [f.key]: e.target.value }); setConfirm(false); }} placeholder={f.prompt} className="bg-surface/90" />
              </div>
            );
          })}
        </div>
        {confirm && empty.length > 0 && (
          <div className="pop-in rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-inset ring-amber-300" role="alert">
            <p className="flex items-start gap-2"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden /><span><span className="font-bold">{empty.join(" and ")} {empty.length === 1 ? "is" : "are"} empty.</span> {empty.includes("Recommendation") ? `Without a Recommendation ${next ? next.clinicianName : "the team"} will not know what you need from them. ` : ""}Send the handoff like this?</span></p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setConfirm(false)}>Keep writing</Button>
              <Button size="sm" onClick={() => submit(true)}>Send with {empty.length === 1 ? "that section" : "those sections"} empty</Button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => submit()} disabled={busy || confirm || !Object.values(sbar).some((x) => x.trim())}><Send className="h-4 w-4" aria-hidden />Send handoff</Button>
          {busy && <Spinner label="Sending your handoff and reviewing it against the communication behaviours" hint="Usually 20 to 40 seconds" />}
          {err && <span className="text-sm font-semibold text-rose-700">{err}</span>}
        </div>
      </div>
    </Panel>
  );
}

function StudentStage({ view, s, onOpen, refresh, onSent, onContinue, phase }: { view: RunView; s: StageView; onOpen: (id: string) => void; refresh: () => void; onSent: () => void; onContinue: (() => void) | null; phase: string }) {
  const received = view.handoffs.filter((h) => h.toStage === s.stage.id).pop();
  const mine = view.entries.filter((e) => e.stageId === s.stage.id);
  const handoff = view.handoffs.find((h) => h.fromStage === s.stage.id);
  const scored = s.encounterStatus === "scored";
  const prior = view.entries.filter((e) => e.stageOrder < s.stage.order);
  const open = prior.filter((e) => ["uncertain", "disputed", "open_question"].includes(e.effectiveStatus));
  const owner = view.viewerIsOwner;
  return (
    <div className="space-y-4">
      <section className="rise relative overflow-hidden rounded-[24px] bg-[var(--color-mastery)] p-5 text-white clay sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-20 h-60 w-60 rounded-full spin-slow [background:conic-gradient(from_0deg,transparent,rgb(255_255_255/0.18),transparent_40%)]" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 font-mono text-[11.5px] font-bold">Encounter {s.stage.order} of {view.stages.length}</span>
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-extrabold text-[var(--color-mastery-ink)]">{owner ? "Your encounter" : "Learner"}</span>
        </div>
        <h2 className="relative mt-2 font-display text-[26px] font-black leading-[1.05] tracking-[-0.03em] sm:text-[30px]">{owner ? `Your encounter: ${s.stage.roleTitle}` : `${s.clinicianName}'s encounter: ${s.stage.roleTitle}`}</h2>
        <p className="relative mt-1 text-[13.5px] font-semibold text-white/85">{`${s.stage.visitLabel || "Telehealth visit"} · ${s.stage.simTime}`}</p>
        <p className="relative mt-3 max-w-[68ch] rounded-2xl bg-white/12 px-4 py-3 text-[14.5px] leading-relaxed text-white ring-1 ring-inset ring-white/20">{s.stage.focus}</p>
        <div className="relative mt-4 space-y-2">
          {s.status === "pending" && <p className="flex items-center gap-2 text-sm font-semibold text-white/90"><Hourglass className="float-idle h-4 w-4" aria-hidden />{owner ? "Your visit opens when the colleagues before you have finished and handed off." : "Not started yet."}</p>}
          {s.status === "ready" && !scored && s.encounterStatus !== "submitted" && owner && (
            <div className="flex flex-wrap items-center gap-3">
              <a href={`/encounter/${s.encounterId}`} className="press inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[var(--color-xp)] px-5 text-[15px] font-extrabold text-ink clay hover:brightness-105">
                <Play className="h-4 w-4 fill-current" aria-hidden />
                {s.transcript.length ? "Continue your visit" : `Start your visit with ${view.patient.name}`}
              </a>
              <span className="max-w-md text-xs text-white/85">The chart has a Care team tab with everything below, and you can page a colleague from there.</span>
            </div>
          )}
          {s.status === "ready" && (scored || s.encounterStatus === "submitted") && (
            <div className="rounded-2xl bg-surface px-3.5 py-2.5 text-ink">
              {s.error ? <p className="text-sm font-semibold text-rose-700">Updating the shared state failed: {s.error}. Use &ldquo;Try this stage again&rdquo; above.</p> : <Spinner label={phase || (s.encounterStatus === "submitted" ? "Your visit is being scored; then what you found is added to the shared patient state" : "Reading your visit and note, and adding what you found to the shared patient state")} hint="Usually 30 to 60 seconds" />}
            </div>
          )}
          {scored && s.encounterId && owner && (
            <Link href={`/encounter/${s.encounterId}/feedback`} className="press inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-sm font-bold text-white ring-1 ring-inset ring-white/30 hover:bg-white/25">
              See the feedback on your visit with the patient
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
      </section>

      {!handoff && s.status !== "complete" && (
        <>
          {received ? (
            <SbarCard handoff={received} title={`Handoff to you from ${received.authorName}`} />
          ) : s.stage.order === 1 ? (
            <p className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-surface/70 px-4 py-3 text-sm text-ink-2"><Inbox className="h-4 w-4 text-brand-500" aria-hidden />You are first in this journey. There is no handoff; you start from the existing record.</p>
          ) : null}
          {s.status !== "pending" && open.length > 0 && (
            <Panel icon={CircleAlert} tone="bg-[var(--color-flame-2)] text-ink" title="Left open by the professionals before you" subtitle="Uncertain, disputed or unanswered when your visit starts.">
              <div className="-mx-2"><EntryList entries={open} onOpen={onOpen} /></div>
            </Panel>
          )}
        </>
      )}

      {s.status === "awaiting_handoff" && owner && <SbarForm view={view} s={s} refresh={refresh} onSent={onSent} />}

      {mine.length > 0 && (
        <Panel icon={Sparkles} tone="bg-[var(--color-xp)] text-ink" title={owner ? "What your encounter added to the shared patient state" : "What this encounter added to the shared patient state"} subtitle={`${mine.length} entries. Select one to see the words it rests on.`}>
          <div className="-mx-2"><EntryList entries={mine} onOpen={onOpen} showWho={false} /></div>
        </Panel>
      )}
      {s.transcript.length > 0 && scored && (
        <details className="group rounded-[20px] border border-line/80 bg-surface px-4 py-3 shadow-e1">
          <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 text-[14px] font-bold text-ink [&::-webkit-details-marker]:hidden">
            <MessagesSquare className="h-4 w-4 text-brand-600" aria-hidden />
            <span className="flex-1">Conversation with the patient</span>
            <span className="font-mono text-[12px] text-ink-3">{s.transcript.length} lines</span>
          </summary>
          <div className="mt-3"><Transcript lines={s.transcript} clinician={s.clinicianName} patient={view.patient.name} /></div>
        </details>
      )}
      {handoff && (
        <div className="space-y-3">
          {onContinue && (
            <div className="pop-in flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-[var(--color-xp)] px-4 py-3 text-sm text-ink clay">
              <span className="flex items-start gap-2"><Send className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span><span className="font-extrabold">Your handoff was sent.</span> {handoff.evaluation ? "The review of your SBAR is below. " : "The review of your SBAR appears below in a moment. "}The journey is already continuing in the background.</span></span>
              <Button size="sm" onClick={onContinue}>Continue to what happens next<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Button>
            </div>
          )}
          <SbarCard handoff={handoff} title={owner ? "Your SBAR handoff" : `SBAR handoff from ${handoff.authorName}`} />
          {!handoff.evaluation && owner && <Spinner label="Reviewing your handoff against the communication behaviours" hint="Usually 20 to 40 seconds" />}
          {handoff.evaluation && (
            <Panel icon={ListChecks} tone="bg-emerald-600 text-white" title="Review of the handoff" subtitle="Each communication behaviour, whether it was observed, where, and what to do next time.">
              <TraceTable evaluation={handoff.evaluation} />
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Huddle ----------

function HuddleItemCard({ view, item, onOpen, refresh, i }: { view: RunView; item: HuddleItem; onOpen: (id: string) => void; refresh: () => void; i: number }) {
  const entry = view.entries.find((e) => e.id === item.entryId);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!entry) return null;
  const proposal = view.messages.find((m) => m.thread === "huddle" && m.kind === "proposal" && m.meta?.itemId === item.entryId);
  async function send() {
    setBusy(true);
    setErr("");
    const r = await post(`/api/journeys/runs/${view.id}/huddle`, { action: "resolve", entryId: item.entryId, text });
    setBusy(false);
    if (r.error) return setErr(r.error);
    refresh();
  }
  return (
    <article className="rise overflow-hidden rounded-[22px] border border-line/80 bg-surface shadow-e1" style={v({ "--i": i })}>
      <button onClick={() => onOpen(entry.id)} className="flex w-full items-start gap-3 bg-surface-2/70 px-4 py-3.5 text-left hover:bg-brand-50">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface font-display text-[15px] font-black text-ink clay">{i + 1}</span>
        <span className="min-w-0 flex-1">
          <StatusBadge status={item.reason} />
          <span className="mt-1 block font-display text-[15.5px] font-bold leading-snug text-ink">{entry.text}</span>
          <span className="text-[11.5px] text-ink-3">Raised by {entry.contributorName}, {entry.contributorRole} · {entry.simTime}</span>
        </span>
      </button>
      <div className="space-y-2.5 px-4 py-3.5">
        {item.positions.map((p, k) => (
          <div key={k} className="flex items-start gap-2.5">
            <Avatar name={p.name} className="h-8 w-8 text-[11px]" />
            <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-surface-2 px-3.5 py-2 text-[13.5px]">
              <div className="text-[11.5px] font-bold text-ink-3">{p.name} · {p.role}</div>
              <p className="leading-relaxed text-ink">{p.text}</p>
              {p.cites.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {p.cites.map((id) => {
                    const e = view.entries.find((x) => x.id === id);
                    return e ? <button key={id} onClick={() => onOpen(id)} className="inline-flex min-h-7 max-w-[15rem] items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11.5px] text-ink-2 ring-1 ring-inset ring-line hover:bg-brand-50 pointer-coarse:min-h-11"><StatusIcon status={e.effectiveStatus} className="h-3 w-3 shrink-0" /><span className="truncate">{e.text}</span></button> : null;
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {item.outcome ? (
          <>
            {proposal && (
              <div className="ml-auto flex max-w-[92%] flex-row-reverse items-start gap-2.5">
                <Avatar name={view.studentName} you className="h-8 w-8 text-[11px]" />
                <div className="rounded-2xl rounded-tr-md bg-[var(--color-mastery-soft)] px-3.5 py-2 text-[13.5px] text-ink"><div className="text-[11.5px] font-bold text-[var(--color-mastery-ink)]">{view.viewerIsOwner ? "You" : view.studentName}</div>{proposal.text}</div>
              </div>
            )}
            <div className="rounded-2xl bg-surface-2 px-3.5 py-2 text-[13.5px] text-ink"><div className="text-[11.5px] font-bold text-ink-3">Team response</div>{item.outcome.teamResponse}</div>
            <button onClick={() => onOpen(item.outcome!.entryId)} className={cx("press flex w-full items-start gap-3 rounded-2xl px-3.5 py-2.5 text-left text-[13.5px] ring-1 ring-inset", item.outcome.decision === "resolved" ? "bg-emerald-50 ring-emerald-300" : "bg-amber-50 ring-amber-300")}>
              <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-full text-white clay", item.outcome.decision === "resolved" ? "bg-emerald-600" : "bg-amber-600")}><StatusIcon status={item.outcome.decision === "resolved" ? "resolved" : "open_question"} className="h-4 w-4 !text-white" /></span>
              <span className="min-w-0">
                <span className="block text-[12px] font-extrabold text-ink">{item.outcome.decision === "resolved" ? "Recorded as resolved" : "Stays open, with an owner"}</span>
                <span className="block text-ink">{item.outcome.text}</span>
                {item.outcome.owner && <span className="block text-[11.5px] text-ink-2">Owner: {item.outcome.owner}</span>}
              </span>
            </button>
          </>
        ) : view.viewerIsOwner && view.huddle?.status === "open" ? (
          <div className="space-y-2 rounded-2xl bg-[var(--color-mastery-soft)] p-3">
            <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="How would you settle this? Say what you think, what it rests on, and who should own any follow-up. If it cannot be settled yet, say what is missing." className="bg-surface" />
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={send} disabled={busy || !text.trim()}><Send className="h-3.5 w-3.5" aria-hidden />Put it to the team</Button>
              {busy && <Spinner label="The colleague best placed to answer is responding, and the outcome is being recorded" hint="Usually 10 to 20 seconds" />}
              {err && <span className="text-xs font-semibold text-rose-700">{err}</span>}
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-3">Not discussed.</p>
        )}
      </div>
    </article>
  );
}

function HuddlePanel({ view, onOpen, refresh, phase }: { view: RunView; onOpen: (id: string) => void; refresh: () => void; phase: string }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const ready = view.stages.every((s) => s.status === "complete");
  const h = view.huddle;
  async function act(action: "start" | "close") {
    setBusy(action);
    setErr("");
    const r = await post(`/api/journeys/runs/${view.id}/huddle`, { action });
    if (r.error) setErr(r.error);
    await refresh();
    setBusy("");
  }
  if (!ready)
    return (
      <p className="flex items-center gap-3 rounded-[22px] border-2 border-dashed border-brand-200 bg-surface/70 px-5 py-6 text-sm text-ink-2">
        <Users className="float-idle h-6 w-6 shrink-0 text-brand-500" aria-hidden />
        The huddle opens after the last encounter. The team will reconcile whatever is still disputed, uncertain or unanswered.
      </p>
    );
  if (!h)
    return (
      <Panel icon={Users} title="Team huddle" subtitle="Everyone who saw the patient, together, outside the handoff order.">
        <div className="space-y-4 text-sm text-ink-2">
          <ol className="grid gap-2 sm:grid-cols-3">
            {[
              ["The agenda", "Drawn from the entries in the shared state that are still disputed, unanswered or uncertain, the most important for the patient's safety first."],
              ["Positions, then your call", "Each colleague gives a position; you propose how to settle each item."],
              ["A kept trail", "The outcome is recorded as a new entry linked to the original, so the trail is kept."],
            ].map(([t, d], i) => (
              <li key={t} className="rise rounded-2xl bg-surface-2 p-3" style={v({ "--i": i })}>
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 font-display text-[13px] font-black text-white">{i + 1}</span>
                <p className="mt-2 font-display text-[14px] font-extrabold text-ink">{t}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{d}</p>
              </li>
            ))}
          </ol>
          {view.viewerIsOwner && (
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => act("start")} disabled={!!busy}><Users className="h-4 w-4" aria-hidden />Open the huddle</Button>
              {busy && <Spinner label="Choosing the agenda by clinical importance; each colleague is preparing a position from the shared record" hint="Usually 30 to 60 seconds" />}
              {err && <span className="font-semibold text-rose-700">{err}</span>}
            </div>
          )}
        </div>
      </Panel>
    );
  const done = h.items.filter((i) => i.outcome).length;
  const writing = h.status === "closed" && view.status !== "complete" && !view.error;
  return (
    <div className="space-y-4">
      <section className="rise rounded-[24px] bg-ink p-5 text-white clay">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="inline-flex items-center gap-2 font-display text-[22px] font-black tracking-[-0.03em]"><Users className="h-5 w-5 text-[var(--color-xp)]" aria-hidden />Team huddle</h2>
            <p className="mt-0.5 text-[13.5px] text-white/80">{`${h.items.length} item${h.items.length === 1 ? "" : "s"} on the agenda · ${done} discussed${h.status === "closed" ? " · closed" : ""}`}</p>
          </div>
          <ol className="flex flex-wrap gap-1.5" aria-label={`${done} of ${h.items.length} discussed`}>
            {h.items.map((it, i) => (
              <li key={it.entryId} className={cx("pop-spring grid h-9 w-9 place-items-center rounded-xl font-display text-[15px] font-black", it.outcome ? "bg-[var(--color-xp)] text-ink clay" : "border-2 border-white/40 text-white/85")} style={v({ "--i": i })}>{i + 1}</li>
            ))}
          </ol>
        </div>
        <div className="mt-3 space-y-3">
          {!h.items.length && <p className="text-sm text-white/85">Nothing in the shared state is disputed, unanswered or uncertain, so there is nothing to reconcile.</p>}
          {h.status === "open" && view.viewerIsOwner && (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => act("close")} disabled={!!busy} className="!bg-[var(--color-xp)] !text-ink">{done < h.items.length ? "Close the huddle with items left open" : "Close the huddle and write the care plan"}</Button>
              {busy === "close" && <span className="rounded-full bg-surface px-3 py-1"><Spinner label="Closing the huddle" /></span>}
              {err && <span className="text-sm font-semibold text-rose-300">{err}</span>}
            </div>
          )}
          {writing && (
            <div className="space-y-1 rounded-2xl bg-surface px-3.5 py-2.5 text-ink">
              <Spinner label={phase || "Writing the integrated care plan and your teamwork evaluation"} hint="Usually 60 to 90 seconds" />
              <p className="text-xs text-ink-3">The plan is written from the shared state and each action is checked against it; your evaluation is written from your visit, note, SBAR, messages and huddle contributions. This continues on the server if you leave the page.</p>
            </div>
          )}
          {h.status === "closed" && view.error && view.viewerIsOwner && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-950">
              <span>Writing the care plan and evaluation did not finish ({view.error}). Nothing you did is lost.</span>
              <Button size="sm" variant="secondary" onClick={() => act("close")} disabled={!!busy}><RotateCcw className="h-3.5 w-3.5" aria-hidden />Try again</Button>
            </div>
          )}
        </div>
      </section>
      {h.items.map((it, i) => <HuddleItemCard key={it.entryId} i={i} view={view} item={it} onOpen={onOpen} refresh={refresh} />)}
    </div>
  );
}

// ---------- Hub ----------

const TABS = [
  { key: "journey", label: "Journey", icon: MapIcon },
  { key: "state", label: "Integrated patient view", icon: Stethoscope },
  { key: "team", label: "Team messages", icon: MessagesSquare },
  { key: "evaluation", label: "Teamwork evaluation", icon: ListChecks },
] as const;

const NEXT_ICON = { wait: Hourglass, start_visit: Play, continue_visit: Play, write_handoff: PenLine, huddle: Users, finish: Hourglass, done: Trophy, error: CircleAlert } as const;

/** The teamwork evaluation's four domains as a scorecard: observed of applicable, as a ring with the count in words. */
function DomainRings({ evaluation }: { evaluation: TraceEvaluation }) {
  const domains = [...new Set(BEHAVIOURS.map((b) => b.domain))];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {domains.map((d, i) => {
        const items = BEHAVIOURS.filter((b) => b.domain === d).map((b) => evaluation.behaviours.find((x) => x.key === b.key)).filter(Boolean);
        const yes = items.filter((x) => x!.observed === "yes").length;
        const app = items.filter((x) => x!.observed !== "na").length;
        const c = 2 * Math.PI * 16;
        return (
          <div key={d} className="rise flex items-center gap-3 rounded-[20px] bg-surface p-3.5 ring-1 ring-inset ring-line" style={v({ "--i": i })}>
            <span className="relative grid h-14 w-14 shrink-0 place-items-center" aria-hidden>
              <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
                <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-surface-2)" strokeWidth="5" />
                <circle cx="20" cy="20" r="16" fill="none" stroke="#059669" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - (app ? yes / app : 0))} className="ring-fill" style={v({ "--from": c })} />
              </svg>
              <span className="font-mono text-[13px] font-bold text-ink">{yes}/{app}</span>
            </span>
            <div className="min-w-0">
              <div className="font-display text-[14px] font-extrabold leading-tight text-ink">{d}</div>
              <div className="text-[12px] text-ink-3">{yes} of {app} observed</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RunHub({ runId }: { runId: string }) {
  const { view, error, live, refresh: reload } = useRun(runId);
  // After the learner does something the run is fetched straight away (still one request at a time).
  const refresh = useCallback(() => reload(true), [reload]);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("journey");
  const [step, setStep] = useState<Step | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [lit, setLit] = useState<string[] | null>(null);
  // Set when the learner sends their SBAR: the hub stays on their encounter so the review is seen.
  const [held, setHeld] = useState(false);
  const follow = view ? (view.next.stageId ? view.next.stageId : view.next.kind === "done" ? "final" : "huddle") : null;
  const lastFollow = useRef<string | null>(null);
  useEffect(() => {
    if (!follow || follow === lastFollow.current || held) return;
    // Move the learner to whatever needs their attention next, after the current render.
    const t = setTimeout(() => {
      lastFollow.current = follow;
      setStep(follow);
      if (follow === "final") setTab("state");
    }, 0);
    return () => clearTimeout(t);
  }, [follow, held]);

  // The learner chose where to look: do not pull them elsewhere until the run moves on again.
  const go = (to: Step) => {
    setHeld(false);
    lastFollow.current = follow;
    setStep(to);
  };

  if (error && !view) return <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200">{error}</p>;
  if (!view)
    return (
      <div className="space-y-4" aria-busy>
        <Spinner label="Loading the care journey" />
        <div className="h-36 animate-pulse rounded-[26px] bg-surface-2" />
        <div className="h-52 animate-pulse rounded-[22px] bg-surface-2" />
      </div>
    );
  const current = step || follow || view.stages[0].stage.id;
  const sv = view.stages.find((s) => s.stage.id === current);
  const me = view.stages.find((s) => s.isStudent);
  const board = statusBoard(view.entries, view.links);
  const unresolved = board.unresolved;
  const n = view.next;
  const spinning = n.kind === "wait" || n.kind === "finish";
  const stops = stopsOf(view);
  const stopsDone = stops.filter((s) => s.state === "done").length;
  const NextIcon = NEXT_ICON[n.kind] || Hourglass;
  const teamCount = view.messages.filter((m) => m.thread !== "huddle" && m.thread !== "plan").length;
  const ringC = 2 * Math.PI * 16;

  return (
    <LitCtx.Provider value={{ lit, setLit }}>
      <div>
        {/* ---------- Hero ---------- */}
        <section className="rise relative mb-4 overflow-hidden rounded-[28px] bg-brand-600 p-5 text-white clay sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full spin-slow [background:conic-gradient(from_0deg,transparent,rgb(255_255_255/0.16),transparent_40%)]" aria-hidden />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <Avatar name={view.patient.name} className="float-idle hidden h-16 w-16 text-[22px] sm:grid" />
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[12.5px] font-bold">Care journey</div>
                <h1 className="mt-1.5 font-display text-[28px] font-black leading-[1.02] tracking-[-0.035em] sm:text-[36px]">{view.journey.title}</h1>
                <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-white/90">
                  {view.patient.name}, {view.patient.age}, {view.patient.sex} · {view.viewerIsOwner ? "You are" : `${view.studentName} is`} the <span className="font-extrabold text-white">{me?.stage.roleTitle.toLowerCase()}</span> (encounter {me?.stage.order} of {view.stages.length}). The AI plays the patient and the other professionals.
                </p>
              </div>
            </div>
            <dl className="flex flex-wrap gap-2 text-[12.5px]">
              <div className="flex items-center gap-2.5 rounded-2xl bg-white/12 px-3 py-2 ring-1 ring-inset ring-white/20">
                <span className="relative grid h-11 w-11 place-items-center" aria-hidden>
                  <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
                    <circle cx="20" cy="20" r="16" fill="none" stroke="rgb(255 255 255 / 0.2)" strokeWidth="5" />
                    <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-xp)" strokeWidth="5" strokeLinecap="round" strokeDasharray={ringC} strokeDashoffset={ringC * (1 - stopsDone / stops.length)} className="ring-fill" style={v({ "--from": ringC })} />
                  </svg>
                  <span className="font-mono text-[11px] font-bold">{stopsDone}/{stops.length}</span>
                </span>
                <div><dd className="font-display text-[15px] font-extrabold leading-none">{stopsDone} of {stops.length}</dd><dt className="mt-1 text-white/80">stops done</dt></div>
              </div>
              <div className="rounded-2xl bg-white px-3.5 py-2 text-ink">
                <dd className="font-display text-[26px] font-black leading-none tracking-[-0.03em] tabular"><CountUp value={board.total} /></dd>
                <dt className="mt-1 text-ink-3">items in shared state</dt>
              </div>
              <div className={cx("rounded-2xl px-3.5 py-2", unresolved ? "bg-[var(--color-flame-2)] text-ink" : "bg-[var(--color-xp)] text-ink")}>
                <dd className="font-display text-[26px] font-black leading-none tracking-[-0.03em] tabular"><CountUp value={unresolved} /></dd>
                <dt className="mt-1">uncertain or open</dt>
              </div>
            </dl>
          </div>
        </section>

        {/* ---------- What to do now ---------- */}
        <div className={cx("rise mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[20px] px-4 py-3 text-[14px] shadow-e1 ring-1 ring-inset", n.kind === "error" ? "bg-rose-50 text-rose-950 ring-rose-200" : n.kind === "done" ? "bg-[var(--color-xp-soft)] text-ink ring-[var(--color-xp-ink)]/30" : "bg-surface text-ink ring-line")} style={v({ "--i": 1 })}>
          <span className="flex items-center gap-3">
            <span className={cx("relative grid h-10 w-10 shrink-0 place-items-center rounded-xl clay", n.kind === "error" ? "bg-rose-600 text-white" : n.kind === "done" ? "bg-[var(--color-xp)] text-ink" : "bg-brand-600 text-white")}>
              {spinning ? <span className="jr-spin h-5 w-5 rounded-full border-[3px] border-white/30 border-t-white" aria-hidden /> : <NextIcon className="h-5 w-5" aria-hidden />}
              {!spinning && n.kind !== "done" && n.kind !== "error" && <span className="jr-pulse !inset-[-4px] !rounded-xl" aria-hidden />}
            </span>
            <span><span className="font-extrabold">{n.kind === "done" ? "Complete. " : n.kind === "error" ? "Stopped. " : "Now: "}</span>{n.label}</span>
          </span>
          {view.viewerIsOwner && (
            <span className="flex flex-wrap gap-2">
              {(n.kind === "start_visit" || n.kind === "continue_visit") && me?.encounterId && <VisitLink small href={`/encounter/${me.encounterId}`}>{n.kind === "start_visit" ? "Start your visit" : "Continue your visit"}</VisitLink>}
              {n.kind === "error" && (
                <Button size="sm" variant="secondary" disabled={retrying} onClick={async () => { setRetrying(true); await post(`/api/journeys/runs/${view.id}/retry`, {}); await refresh(); setRetrying(false); }}><RotateCcw className="h-3.5 w-3.5" aria-hidden />{n.stageId ? "Try this stage again" : "Try again"}</Button>
              )}
              {(n.kind === "write_handoff" || n.kind === "huddle") && <Button size="sm" onClick={() => { setTab("journey"); go(n.kind === "huddle" ? "huddle" : n.stageId!); }}>{n.kind === "huddle" ? "Go to the huddle" : "Write the handoff"}<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Button>}
              {n.kind === "done" && <Button size="sm" onClick={() => setTab("state")}>Open the integrated patient view<ArrowRight className="h-3.5 w-3.5" aria-hidden /></Button>}
            </span>
          )}
        </div>

        {/* ---------- The journey map: a level path of every stop ---------- */}
        <section className="rise mb-5 rounded-[24px] border border-line/80 bg-surface px-4 pb-3 pt-4 shadow-e1 sm:px-5" style={v({ "--i": 2 })}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 font-display text-[17px] font-extrabold tracking-[-0.02em] text-ink"><MapIcon className="h-4 w-4 text-brand-600" aria-hidden />Journey map</h2>
            <p className="text-[12px] text-ink-3">Select a stop to open it · arrow keys move between stops</p>
          </div>
          <LevelPath view={view} current={tab === "state" ? "final" : current} lit={lit} onPick={(k) => { setTab("journey"); if (k === "final") setTab("state"); else go(k); }} />
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">Each encounter starts from the shared patient state, adds to it, and hands off with an SBAR. Nothing in the state is ever overwritten.</p>
        </section>

        {view.entries.length > 0 && (
          <Panel
            className="mb-6"
            icon={GitBranch}
            title="Shared patient state"
            subtitle="Every entry is a dot in the encounter that added it, coloured by its status now; every curve is a typed link from earlier information to what built on it. Nothing is ever overwritten. Select a dot to see who recorded it, when, and the words it rests on."
          >
            <JourneyGraph view={view} onOpen={setOpen} lit={lit} />
          </Panel>
        )}

        <div role="tablist" aria-label="Journey views" className="scroll-quiet sticky top-2 z-20 mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-surface/90 p-1.5 shadow-e1 ring-1 ring-line backdrop-blur">
          {TABS.map((t) => {
            const count = t.key === "team" ? teamCount : t.key === "state" ? view.entries.length : 0;
            return (
              <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cx("press inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-[14px] font-bold transition-colors pointer-coarse:min-h-11", tab === t.key ? "bg-ink text-white shadow-e2" : "text-ink-2 hover:bg-brand-50 hover:text-ink")}>
                <t.icon className="h-4 w-4" aria-hidden />
                {t.label}
                {t.key === "team" && count > 0 && <span className={cx("rounded-full px-1.5 font-mono text-[11.5px]", tab === t.key ? "bg-[var(--color-xp)] text-ink" : "bg-surface-2 text-ink-2")}>{count}</span>}
              </button>
            );
          })}
        </div>

        {tab === "journey" && (
          <div className="min-w-0">
            {sv && (sv.isStudent ? <StudentStage view={view} s={sv} onOpen={setOpen} refresh={refresh} onSent={() => setHeld(true)} onContinue={held && follow ? () => { setHeld(false); lastFollow.current = follow; setStep(follow); if (follow === "final") setTab("state"); } : null} phase={live.stageId === sv.stage.id ? live.phase : ""} /> : <AiStage key={sv.stage.id} view={view} s={sv} live={live} onOpen={setOpen} />)}
            {current === "huddle" && <HuddlePanel view={view} onOpen={setOpen} refresh={refresh} phase={live.stageId === "huddle" ? live.phase : ""} />}
            {current === "final" && <FinalView view={view} onOpen={setOpen} refresh={refresh} />}
          </div>
        )}

        {tab === "state" && <FinalView view={view} onOpen={setOpen} refresh={refresh} />}

        {tab === "team" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel icon={Send} title={view.viewerIsOwner ? "Page a colleague" : `${view.studentName}'s messages with colleagues`} subtitle={view.viewerIsOwner ? "Reach back for clarification, reach forward with a heads-up, ask for a consult, or call something out to everyone. Replies come from the shared record and that colleague's own visit only." : "Read-only. Threads the student opened outside the handoff order; replies came from the shared record and that colleague's own visit only."}>
              <ConsultPanel view={view} refresh={refresh} />
            </Panel>
            <Panel icon={MessagesSquare} tone="bg-[var(--color-mastery)] text-white" title="All messages outside the handoff order" subtitle="Requests, read-backs and check-backs are labelled; a closed loop is marked when the sender confirms the read-back.">
              <ol className="space-y-2.5">
                {view.messages.filter((m) => m.thread !== "huddle" && m.thread !== "plan").map((m, i) => (
                  <li key={m.id} className={cx("rise flex max-w-[94%] items-start gap-2.5", !m.fromIsAi && "ml-auto flex-row-reverse")} style={v({ "--i": i })}>
                    <Avatar name={m.fromName} you={!m.fromIsAi} className="h-8 w-8 text-[11px]" />
                    <div className={cx("min-w-0 rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed text-ink", m.fromIsAi ? "rounded-tl-md bg-surface-2" : "rounded-tr-md bg-[var(--color-mastery-soft)]")}>
                      <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] font-bold text-ink-3">
                        {m.fromName} to {m.toRole || "team"}
                        {m.kind === "callout" && <Badge tone="amber">Call-out</Badge>}
                        {m.meta?.act && <Badge>{m.meta.act.replace("_", " ")}</Badge>}
                        {m.meta?.loop === "closed" && <Badge tone="green">Loop closed</Badge>}
                      </div>
                      {m.text}
                    </div>
                  </li>
                ))}
                {!view.messages.some((m) => m.thread !== "huddle" && m.thread !== "plan") && <p className="text-sm text-ink-3">No messages yet.</p>}
              </ol>
            </Panel>
          </div>
        )}

        {tab === "evaluation" && (
          <div className="space-y-5">
            {view.evaluation ? (
              <>
                <DomainRings evaluation={view.evaluation} />
                <Panel icon={ListChecks} tone="bg-emerald-600 text-white" title={`Teamwork trace: ${view.evaluation.subject}`} subtitle="TeamSTEPPS-aligned behaviours. Each line says whether the behaviour was observed, where the evidence is, the exact words, and what to do next time. A behaviour is only credited when the quoted words were found at the stated place.">
                  <TraceTable evaluation={view.evaluation} />
                </Panel>
              </>
            ) : (
              <p className="flex items-start gap-3 rounded-[22px] border-2 border-dashed border-brand-200 bg-surface/70 px-5 py-5 text-sm text-ink-2">
                <Hourglass className="float-idle mt-0.5 h-5 w-5 shrink-0 text-brand-500" aria-hidden />
                <span>
                  The full trace (visit, note, SBAR, messages with colleagues and the huddle) is written when the huddle closes.
                  {view.handoffs.find((h) => !h.authorIsAi)?.evaluation ? " The review of the SBAR handoff is already available below." : ""}
                </span>
              </p>
            )}
            {!view.evaluation && view.handoffs.filter((h) => !h.authorIsAi && h.evaluation).map((h) => (
              <Panel key={h.id} icon={ListChecks} tone="bg-emerald-600 text-white" title="Review of the SBAR handoff"><TraceTable evaluation={h.evaluation!} /></Panel>
            ))}
            <Panel icon={Bot} tone="bg-surface-2 text-brand-700" title="Colleagues' handoffs as worked examples" subtitle="The same communication behaviours applied to the AI colleagues' SBARs.">
              <div className="space-y-3">
                {view.handoffs.filter((h) => h.authorIsAi).map((h) => {
                  const yes = h.evaluation ? h.evaluation.behaviours.filter((b) => b.observed === "yes").length : 0;
                  return (
                    <details key={h.id} className="group rounded-[18px] bg-surface-2/70 px-3.5 py-2.5 ring-1 ring-inset ring-line">
                      <summary className="flex min-h-9 cursor-pointer list-none flex-wrap items-center gap-2.5 text-[14px] font-bold text-ink [&::-webkit-details-marker]:hidden">
                        <Avatar name={h.authorName} className="h-7 w-7 text-[10.5px]" />
                        <span className="flex-1">{h.authorName} to {h.toName}{h.evaluation ? ` · ${yes} of ${h.evaluation.behaviours.length} behaviours observed` : ""}</span>
                        {h.evaluation && <DomainMeter yes={yes} applicable={h.evaluation.behaviours.length} className="[&>span:last-child]:hidden" />}
                      </summary>
                      <div className="mt-3 space-y-3"><SbarCard handoff={h} />{h.evaluation && <TraceTable evaluation={h.evaluation} />}</div>
                    </details>
                  );
                })}
                {!view.handoffs.some((h) => h.authorIsAi) && <p className="text-sm text-ink-3">No colleague has handed off yet.</p>}
              </div>
            </Panel>
          </div>
        )}

        {open && <ProvenancePanel view={view} entryId={open} onOpen={setOpen} onClose={() => setOpen(null)} />}
        <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-3">
          <span className="font-bold">Status key:</span>
          {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1"><StatusIcon status={k} className="h-3 w-3" />{STATUS_LABEL[k]}</span>
          ))}
        </p>
      </div>
    </LitCtx.Provider>
  );
}
