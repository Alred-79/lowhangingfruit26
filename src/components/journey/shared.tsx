"use client";

import { Bot, Check, ChevronDown, CircleCheck, CircleDashed, CircleHelp, Clock, Link2, MessageCircle, Minus, Quote, Scale, ShieldCheck, UserRound, X, type LucideIcon } from "lucide-react";
import { createContext, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Badge, cx } from "@/components/ui";
import { BEHAVIOURS, KIND_LABEL, SBAR_FIELDS, SOURCE_LABEL, STATUS_LABEL, type EntryStatus, type Handoff, type RunView, type StateEntry, type TraceEvaluation } from "@/lib/journey/types";
import "./journey.css";

// Status colours: one fixed categorical order, validated for colour-vision separation on the light surface.
export const STATUS_ORDER: EntryStatus[] = ["established", "patient_reported", "resolved", "uncertain", "disputed", "open_question"];
export const STATUS_COLOR: Record<EntryStatus, string> = {
  established: "#2a78d6",
  patient_reported: "#eb6834",
  resolved: "#1baf7a",
  uncertain: "#eda100",
  disputed: "#e87ba4",
  open_question: "#008300",
};
/** Each status also has an icon, so it never rests on colour alone (dataviz: status = icon + label). */
export const STATUS_ICON: Record<EntryStatus, LucideIcon> = {
  established: ShieldCheck,
  patient_reported: MessageCircle,
  resolved: CircleCheck,
  uncertain: CircleDashed,
  disputed: Scale,
  open_question: CircleHelp,
};
/** A pale wash of the status colour for tiles, with ink text on top (AA). */
export const statusSoft = (s: EntryStatus, pct = 13) => `color-mix(in oklch, ${STATUS_COLOR[s]} ${pct}%, white)`;

export const v = (o: Record<string, string | number>) => o as CSSProperties;

/** Entry ids that a hovered or focused care-plan action rests on; the graph and lists light them up. */
export const LitCtx = createContext<{ lit: string[] | null; setLit: (ids: string[] | null) => void } | null>(null);

export function StatusIcon({ status, className = "h-3.5 w-3.5" }: { status: EntryStatus; className?: string }) {
  const I = STATUS_ICON[status];
  return <I className={className} style={{ color: STATUS_COLOR[status] }} strokeWidth={2.4} aria-hidden />;
}

export function StatusBadge({ status }: { status: EntryStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-bold text-ink ring-1 ring-inset ring-black/5" style={{ background: statusSoft(status, 16) }}>
      <StatusIcon status={status} className="h-3 w-3" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function WhoBadge({ ai }: { ai: boolean }) {
  return (
    <Badge tone={ai ? "slate" : "teal"}>
      {ai ? <Bot className="h-3 w-3" aria-hidden /> : <UserRound className="h-3 w-3" aria-hidden />}
      {ai ? "AI colleague" : "Student"}
    </Badge>
  );
}

const AVATAR_TONES = ["bg-brand-600 text-white", "bg-[var(--color-mastery)] text-white", "bg-[var(--color-xp)] text-ink", "bg-gradient-to-br from-[var(--color-flame-2)] to-[var(--color-flame)] text-ink", "bg-ink text-white", "bg-[var(--jr-b)] text-white"];
/** Initials in a coloured tile. The tone follows the name, so one person keeps one colour on every screen. */
export function Avatar({ name, className, you }: { name: string; className?: string; you?: boolean }) {
  const clean = name.replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\s+/i, "").replace(/,.*$/, "");
  const ini = clean.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
  const tone = you ? "bg-[var(--color-mastery)] text-white" : AVATAR_TONES[[...clean].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-full font-display font-extrabold tracking-[-0.02em] clay", tone, className || "h-8 w-8 text-[12px]")} aria-hidden>
      {ini}
    </span>
  );
}

export interface Live {
  stageId: string | null;
  lines: { turn: number; speaker: string; text: string; streaming?: boolean }[];
  phase: string;
}

const MIN_GAP_MS = 2500;
const POLL_MS = 8000;

/**
 * Loads a run and keeps it current. While the server is working (a colleague's visit, state
 * extraction, the final write-up) it listens to the live stream and polls slowly as a fallback;
 * when the run is waiting on the learner it makes no requests at all.
 *
 * `refresh()` is the only way the run is fetched: one request in flight at a time, at least
 * MIN_GAP_MS between background fetches, and a call made while one is in flight is folded into a
 * single follow-up. `refresh(true)` (after the learner did something) skips the gap, not the queue.
 */
export function useRun(runId: string, opts: { opened?: string } = {}) {
  const [view, setView] = useState<RunView | null>(null);
  const [error, setError] = useState("");
  const [live, setLive] = useState<Live>({ stageId: null, lines: [], phase: "" });
  const seq = useRef<{ n: number; epoch: string } | null>(null);
  const opened = opts.opened;
  const flight = useRef<{ busy: boolean; last: number; again: boolean; urgent: boolean; timer: ReturnType<typeof setTimeout> | null; waiters: ((v: RunView | null) => void)[] }>({ busy: false, last: 0, again: false, urgent: false, timer: null, waiters: [] });

  const refresh = useCallback(
    (now?: boolean): Promise<RunView | null> => {
      const f = flight.current;
      return new Promise<RunView | null>((resolve) => {
        f.waiters.push(resolve);
        const go = async () => {
          f.timer = null;
          if (f.busy) return void (f.again = true);
          f.busy = true;
          f.again = false;
          f.urgent = false;
          const waiters = f.waiters.splice(0);
          let out: RunView | null = null;
          try {
            const res = await fetch(`/api/journeys/runs/${runId}${opened ? `?opened=${encodeURIComponent(opened)}` : ""}`, { cache: "no-store" });
            const j = await res.json();
            if (j.error) setError(j.error);
            else {
              setView(j);
              setError("");
              out = j as RunView;
            }
          } catch {
            setError("Could not load the care journey.");
          }
          f.busy = false;
          f.last = Date.now();
          waiters.forEach((w) => w(out));
          if (f.again || f.waiters.length) schedule(f.urgent);
        };
        const schedule = (immediate: boolean) => {
          if (f.busy) return void (f.again = true);
          const wait = immediate ? 0 : Math.max(0, f.last + MIN_GAP_MS - Date.now());
          if (f.timer) {
            if (!immediate) return; // a fetch is already scheduled
            clearTimeout(f.timer);
          }
          f.timer = setTimeout(go, wait);
        };
        if (now) f.urgent = true;
        schedule(!!now || f.last === 0);
      });
    },
    [runId, opened],
  );

  useEffect(() => {
    const f = flight.current;
    refresh(true);
    return () => {
      if (f.timer) clearTimeout(f.timer);
      f.timer = null;
    };
  }, [refresh]);

  const waiting = !!view && (view.busy || view.next.kind === "wait" || view.next.kind === "finish");
  useEffect(() => {
    if (!waiting) return;
    const at = seq.current;
    const es = new EventSource(`/api/journeys/runs/${runId}/stream${at ? `?after=${at.n}&epoch=${at.epoch}` : ""}`);
    es.onmessage = (m) => {
      const e = JSON.parse(m.data);
      // Drop anything already seen (the browser reconnects the stream on its own with the original URL).
      if (seq.current && e.epoch === seq.current.epoch && e.seq <= seq.current.n) return;
      seq.current = { n: e.seq || 0, epoch: e.epoch || "" };
      if (e.type === "stage_start") setLive({ stageId: e.stageId, lines: [], phase: "" });
      else if (e.type === "clinician") setLive((l) => ({ stageId: e.stageId, phase: "", lines: [...(l.stageId === e.stageId ? l.lines : []), { turn: e.turn, speaker: "clinician", text: e.text }] }));
      else if (e.type === "patient_delta")
        setLive((l) => {
          const lines = [...l.lines];
          const last = lines[lines.length - 1];
          if (last?.streaming && last.turn === e.turn) lines[lines.length - 1] = { ...last, text: last.text + e.text };
          else lines.push({ turn: e.turn, speaker: "patient", text: e.text, streaming: true });
          return { ...l, stageId: e.stageId, lines };
        });
      else if (e.type === "patient")
        setLive((l) => {
          const lines = l.lines.filter((x) => !(x.streaming && x.turn === e.turn));
          return { ...l, lines: [...lines, { turn: e.turn, speaker: "patient", text: e.text }] };
        });
      else if (e.type === "action") setLive((l) => ({ ...l, lines: [...l.lines, { turn: e.turn, speaker: "chart", text: e.text }] }));
      else if (e.type === "phase") setLive((l) => ({ ...l, stageId: e.stageId, phase: e.label }));
      // Replayed history never triggers a fetch; only news does, and refresh() rate-limits itself.
      else if (!e.replay && (e.type === "stage_done" || e.type === "idle" || e.type === "error" || e.type === "updated")) refresh();
    };
    const poll = setInterval(() => refresh(), POLL_MS);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [waiting, runId, refresh]);

  return { view, error, live, refresh };
}

export async function post<T = Record<string, unknown>>(url: string, body: unknown): Promise<T & { error?: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await res.json();
  } catch {
    return { error: "The request did not go through. Check your connection and try again." } as T & { error?: string };
  }
}

export function stageLabel(view: RunView, e: { stageId: string; stageOrder: number }) {
  if (e.stageId === "record") return "Existing record";
  if (e.stageId === "huddle") return "Team huddle";
  const s = view.stages.find((x) => x.stage.id === e.stageId);
  return s ? `Encounter ${s.stage.order}: ${s.stage.roleTitle}` : `Encounter ${e.stageOrder}`;
}

/** One line of the shared state. Clicking opens its provenance. When a care-plan action cites it, it lights up. */
export function EntryRow({ entry, onOpen, showWho = true, dense, lit }: { entry: StateEntry; onOpen?: (id: string) => void; showWho?: boolean; dense?: boolean; lit?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(entry.id)}
      className={cx("jr-lit group flex w-full items-start gap-2.5 rounded-xl px-2.5 text-left transition-colors hover:bg-brand-50/70 pointer-coarse:min-h-11", dense ? "py-1.5" : "py-2", lit && "jr-glow bg-[var(--color-xp-soft)]")}
    >
      <span className="mt-[3px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full" style={{ background: statusSoft(entry.effectiveStatus, 22) }} title={STATUS_LABEL[entry.effectiveStatus]}>
        <StatusIcon status={entry.effectiveStatus} className="h-3 w-3" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx("text-[13.5px] leading-snug text-ink", entry.text.length > 260 && "line-clamp-3")} title={entry.text.length > 260 ? "Select to read the whole entry" : undefined}>{entry.text}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-3">
          <span>{KIND_LABEL[entry.kind] || entry.kind}</span>
          <span className="font-semibold" style={{ color: "var(--color-ink-2)" }}>{STATUS_LABEL[entry.effectiveStatus]}</span>
          {showWho && entry.stageId !== "record" && <span>{entry.contributorName}</span>}
          {entry.meta?.unverifiedValues?.length ? <span className="font-semibold text-amber-800">value not in case file</span> : null}
          {entry.evidence && entry.evidence.verified === false ? <span className="font-semibold text-amber-800">evidence not verified</span> : null}
          <Link2 className="h-3 w-3 text-brand-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
        </span>
      </span>
    </button>
  );
}

const REL_OUT: Record<string, string> = { uses: "Builds on", confirms: "Confirms", contradicts: "Disagrees with", updates: "Updates", answers: "Answers", resolves: "Resolves" };
const REL_IN: Record<string, string> = { uses: "Used by", confirms: "Confirmed by", contradicts: "Disputed by", updates: "Updated by", answers: "Answered by", resolves: "Resolved by" };

function evidenceWhere(e: StateEntry) {
  const ev = e.evidence;
  if (!ev) return "";
  if (ev.where === "visit") return `Visit transcript${ev.turn ? `, turn ${ev.turn}` : ""}${ev.speaker ? ` (${ev.speaker})` : ""}`;
  return { note: "Clinician's written note", record: "Existing record", consult: "Message between colleagues", huddle: "Team huddle", sbar: "SBAR handoff" }[ev.where] || ev.where;
}

/** Full provenance of one entry: who, role, AI or student, encounter, time, status, source, evidence and relation history. */
export function ProvenancePanel({ view, entryId, onOpen, onClose }: { view: RunView; entryId: string; onOpen: (id: string) => void; onClose: () => void }) {
  const e = view.entries.find((x) => x.id === entryId);
  useEffect(() => {
    const k = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  if (!e) return null;
  const byId = new Map(view.entries.map((x) => [x.id, x]));
  const out = view.links.filter((l) => l.from === e.id && byId.has(l.to));
  const inn = view.links.filter((l) => l.to === e.id && byId.has(l.from));
  const rows: [string, React.ReactNode][] = [
    ["Status", <span key="s" className="flex flex-wrap items-center gap-2"><StatusBadge status={e.effectiveStatus} />{e.effectiveStatus !== e.status && <span className="text-xs text-ink-3">recorded as {STATUS_LABEL[e.status].toLowerCase()}; changed by a later entry (see history)</span>}</span>],
    ["Type", KIND_LABEL[e.kind] || e.kind],
    ["Source", SOURCE_LABEL[e.source] || e.source],
    ["Contributed by", <span key="c" className="flex flex-wrap items-center gap-2">{e.contributorName}{e.stageId !== "record" && <WhoBadge ai={e.contributorIsAi} />}</span>],
    ["Professional role", e.contributorRole],
    ["Encounter", stageLabel(view, e)],
    ["Simulated time", e.simTime],
    ["Recorded", new Date(e.createdAt.replace(" ", "T") + "Z").toLocaleString()],
  ];
  return (
    <div className="scrim-in fixed inset-0 z-50 flex justify-end bg-ink/35 backdrop-blur-[2px]" onClick={onClose}>
      <aside role="dialog" aria-modal="true" className="sheet-in scroll-quiet h-full w-full max-w-md overflow-y-auto bg-surface shadow-e3" onClick={(ev) => ev.stopPropagation()} aria-label="Provenance">
        <div className="relative overflow-hidden px-6 pb-5 pt-5" style={{ background: statusSoft(e.effectiveStatus, 18) }}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="inline-flex items-center gap-2 font-display text-[13.5px] font-extrabold text-ink">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-surface clay">
                <StatusIcon status={e.effectiveStatus} className="h-4 w-4" />
              </span>
              Where this came from
            </h2>
            <button onClick={onClose} className="press min-h-9 rounded-full bg-surface px-3.5 text-[13px] font-bold text-ink shadow-e1 hover:bg-brand-50 pointer-coarse:min-h-11">Close</button>
          </div>
          <p className={cx("mt-3 font-display font-bold tracking-[-0.01em] text-ink", e.text.length > 260 ? "text-[15px] leading-relaxed" : "text-[19px] leading-snug")}>{e.text}</p>
        </div>
        <div className="px-6 pb-6">
          <dl className="mt-3 divide-y divide-line/70 text-[13.5px]">
            {rows.map(([k, val]) => (
              <div key={k} className="grid grid-cols-[8.5rem_1fr] gap-2 py-2">
                <dt className="text-ink-3">{k}</dt>
                <dd className="font-medium text-ink">{val}</dd>
              </div>
            ))}
          </dl>
          {e.evidence && (
            <div className="mt-4 rounded-2xl bg-surface-2 p-3.5">
              <h3 className="inline-flex items-center gap-1.5 font-display text-[13px] font-extrabold text-ink"><Quote className="h-3.5 w-3.5 text-brand-600" aria-hidden />Evidence</h3>
              <p className="mt-1 text-xs text-ink-3">{evidenceWhere(e)}{e.evidence.verified === false ? " · the cited words could not be found, so this entry was downgraded" : e.evidence.quote ? " · quote verified against the source" : ""}</p>
              {e.evidence.quote && !(e.evidence.where === "record" && e.text.includes(e.evidence.quote)) && <blockquote className="mt-2 rounded-xl bg-surface px-3.5 py-2.5 text-[14px] italic leading-relaxed text-ink ring-1 ring-inset ring-brand-200">&ldquo;{e.evidence.quote}&rdquo;</blockquote>}
            </div>
          )}
          {(e.meta?.unverifiedValues?.length || e.meta?.flags?.length || e.meta?.owner) && (
            <div className="mt-3 space-y-1.5 text-xs">
              {e.meta?.unverifiedValues?.length ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900 ring-1 ring-inset ring-amber-200">Contains a value that is not in the approved case file ({e.meta.unverifiedValues.join(", ")}). Treat it as the clinician&apos;s suggestion, not a verified fact.</p> : null}
              {e.meta?.owner ? <p className="text-ink-2">Owner of the follow-up: {e.meta.owner}</p> : null}
              {e.meta?.flags?.filter(Boolean).map((f) => <p key={f} className="text-ink-3">{f}</p>)}
            </div>
          )}
          <div className="mt-5">
            <h3 className="font-display text-[13px] font-extrabold text-ink">Relation history</h3>
            {!out.length && !inn.length && <p className="mt-1 text-sm text-ink-3">No other entry is linked to this one yet.</p>}
            <ol className="relative mt-2 space-y-2 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-0.5 before:rounded-full before:bg-brand-100">
              {out.map((l) => {
                const t = byId.get(l.to)!;
                return (
                  <li key={`o${l.id}`} className="relative pl-8">
                    <span className="absolute left-0 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-white ring-4 ring-surface"><StatusIcon status={t.effectiveStatus} className="h-3 w-3 !text-white" /></span>
                    <button onClick={() => onOpen(t.id)} className="press w-full rounded-xl px-3 py-2 text-left ring-1 ring-inset ring-line hover:bg-brand-50 hover:ring-brand-300">
                      <span className="text-[11.5px] font-extrabold text-brand-700">{REL_OUT[l.relation]}</span>
                      <span className="block text-[13.5px] text-ink">{t.text}</span>
                      <span className="text-[11.5px] text-ink-3">{t.contributorName} · {stageLabel(view, t)}</span>
                      {l.evidence?.quote && <span className="mt-0.5 block text-[11.5px] italic text-ink-3">&ldquo;{l.evidence.quote.slice(0, 220)}&rdquo;</span>}
                    </button>
                  </li>
                );
              })}
              {inn.map((l) => {
                const f = byId.get(l.from)!;
                return (
                  <li key={`i${l.id}`} className="relative pl-8">
                    <span className="absolute left-0 top-2.5 grid h-6 w-6 place-items-center rounded-full bg-surface ring-4 ring-surface" style={{ boxShadow: `inset 0 0 0 2px ${STATUS_COLOR[f.effectiveStatus]}` }}><StatusIcon status={f.effectiveStatus} className="h-3 w-3" /></span>
                    <button onClick={() => onOpen(f.id)} className="press w-full rounded-xl px-3 py-2 text-left ring-1 ring-inset ring-line hover:bg-brand-50 hover:ring-brand-300">
                      <span className="text-[11.5px] font-extrabold text-ink-2">{REL_IN[l.relation]}</span>
                      <span className="block text-[13.5px] text-ink">{f.text}</span>
                      <span className="text-[11.5px] text-ink-3">{f.contributorName} · {stageLabel(view, f)} · {f.simTime}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
          <p className="mt-5 text-[11.5px] text-ink-3">Entry {e.id}. Entries are never edited; later information is added as new entries linked to this one.</p>
        </div>
      </aside>
    </div>
  );
}

/** The four SBAR sections, each with its own hue and letter (identity is the letter; the colour only echoes it). */
export const SBAR_HUE: Record<string, { tile: string; soft: string; ink: string }> = {
  situation: { tile: "var(--jr-s)", soft: "var(--jr-s-soft)", ink: "var(--jr-s-ink)" },
  background: { tile: "var(--jr-b)", soft: "var(--jr-b-soft)", ink: "var(--jr-b-ink)" },
  assessment: { tile: "var(--jr-a)", soft: "var(--jr-a-soft)", ink: "var(--jr-a-ink)" },
  recommendation: { tile: "var(--jr-r)", soft: "var(--jr-r-soft)", ink: "var(--jr-r-ink)" },
};

export function SbarLetter({ k, label, className = "h-9 w-9 text-[18px]" }: { k: string; label: string; className?: string }) {
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-xl font-display font-black text-white clay", className)} style={{ background: SBAR_HUE[k].tile }} aria-hidden>
      {label[0]}
    </span>
  );
}

export function SbarCard({ handoff, title }: { handoff: Handoff; title?: string }) {
  return (
    <div className="@container overflow-hidden rounded-[22px] border border-line/80 bg-surface shadow-e1">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={handoff.authorName} you={!handoff.authorIsAi} className="h-9 w-9 text-[13px]" />
          <div className="min-w-0">
            <div className="font-display text-[15px] font-extrabold tracking-[-0.01em] text-ink">{title || `SBAR handoff from ${handoff.authorName}`}</div>
            <div className="text-xs text-ink-3">{handoff.authorRole} to {handoff.toName}</div>
          </div>
        </div>
        <WhoBadge ai={handoff.authorIsAi} />
      </div>
      <dl className="grid gap-1.5 p-1.5 pt-0 @2xl:grid-cols-2">
        {SBAR_FIELDS.map((f) => {
          const h = SBAR_HUE[f.key];
          const text = handoff.sbar[f.key];
          return (
            <div key={f.key} className="flex gap-3 rounded-2xl p-3" style={{ background: h.soft }}>
              <SbarLetter k={f.key} label={f.label} />
              <div className="min-w-0 flex-1">
                <dt className="font-display text-[13px] font-extrabold tracking-[-0.01em]" style={{ color: h.ink }}>{f.label}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{text || <span className="italic text-ink-3">Left blank</span>}</dd>
              </div>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

const OBS = {
  yes: { label: "Observed", Icon: Check, tile: "bg-emerald-600 text-white", pill: "bg-emerald-100 text-emerald-900" },
  no: { label: "Not observed", Icon: X, tile: "bg-rose-600 text-white", pill: "bg-rose-100 text-rose-900" },
  na: { label: "No opportunity", Icon: Minus, tile: "bg-slate-300 text-ink", pill: "bg-slate-100 text-slate-700" },
};

/** A domain's observed share as a short bar with the count in words (numbers always as text). */
export function DomainMeter({ yes, applicable, className }: { yes: number; applicable: number; className?: string }) {
  const pct = applicable ? yes / applicable : 0;
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <span className="relative h-2 w-20 overflow-hidden rounded-full bg-slate-200" aria-hidden>
        <span className="bar-grow absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${Math.round(pct * 100)}%` }} />
      </span>
      <span className="text-xs font-semibold text-ink-2">{yes} of {applicable} behaviours observed</span>
    </span>
  );
}

/** The explainable behavioural trace as a visual checklist: behaviour, observed or not, where the evidence is, the words, and what to do next. */
export function TraceTable({ evaluation, compact }: { evaluation: TraceEvaluation; compact?: boolean }) {
  const domains = [...new Set(BEHAVIOURS.map((b) => b.domain))];
  return (
    <div className="space-y-5">
      {evaluation.summary && !compact && <p className="max-w-3xl rounded-2xl bg-brand-50 px-4 py-3 text-[14px] leading-relaxed text-ink ring-1 ring-inset ring-brand-100">{evaluation.summary}</p>}
      {domains.map((d) => {
        const items = BEHAVIOURS.filter((b) => b.domain === d).map((b) => ({ def: b, r: evaluation.behaviours.find((x) => x.key === b.key) })).filter((x) => x.r);
        if (!items.length) return null;
        const yes = items.filter((x) => x.r!.observed === "yes").length;
        const applicable = items.filter((x) => x.r!.observed !== "na").length;
        return (
          <section key={d}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-display text-[15px] font-extrabold tracking-[-0.01em] text-ink">{d}</h4>
              <DomainMeter yes={yes} applicable={applicable} />
            </div>
            <ul className="grid gap-1.5 xl:grid-cols-2">
              {items.map(({ def, r }, i) => {
                const o = OBS[r!.observed];
                return (
                  <li key={def.key} className="rise grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-2xl bg-surface px-3 py-2.5 ring-1 ring-inset ring-line/80" style={v({ "--i": i })}>
                    <span className={cx("mt-0.5 grid h-8 w-8 place-items-center rounded-full clay", o.tile)}>
                      <o.Icon className="h-4 w-4" strokeWidth={3} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-bold text-ink">{def.label}</span>
                        <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-bold", o.pill)}>{o.label}</span>
                      </div>
                      <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-2">{r!.feedback}</p>
                      {(r!.location || r!.quote) && (
                        <details className="group mt-1">
                          <summary className="inline-flex min-h-7 cursor-pointer list-none items-center gap-1 text-[12px] font-bold text-brand-700 pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
                            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
                            Evidence{r!.location ? `: ${r!.location.replace("->", "→")}` : ""}
                          </summary>
                          {r!.quote && <blockquote className="mt-1 rounded-xl bg-surface-2 px-3 py-2 text-[13px] italic text-ink-2">&ldquo;{r!.quote}&rdquo;</blockquote>}
                        </details>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** A spinner with a label. With `hint` it also says roughly how long the step takes and counts the seconds so far. */
export function Spinner({ label, hint }: { label: string; hint?: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!hint) return;
    const t = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [hint]);
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-[13.5px] font-medium text-ink-2" role="status">
      <span className="relative h-5 w-5 shrink-0" aria-hidden>
        <span className="absolute inset-0 rounded-full border-[3px] border-brand-100" />
        <span className="jr-spin absolute inset-0 rounded-full border-[3px] border-transparent border-t-brand-600 border-r-[var(--color-xp)]" />
      </span>
      {label}
      {hint && (
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-3 ring-1 ring-inset ring-line">
          <Clock className="h-3 w-3" aria-hidden />
          {hint} · <span className="font-mono tabular">{secs < 60 ? `${secs} s` : `${Math.floor(secs / 60)} min ${secs % 60} s`}</span> so far
        </span>
      )}
    </span>
  );
}

export function Transcript({ lines, clinician, patient }: { lines: { turn: number; speaker: string; text: string }[]; clinician: string; patient: string }) {
  return (
    <ol className="space-y-2.5">
      {lines.map((m, i) =>
        m.speaker === "chart" ? (
          <li key={i} className="mx-auto max-w-[92%] whitespace-pre-wrap rounded-xl border border-dashed border-brand-200 bg-brand-50/60 px-3 py-1.5 text-center text-xs text-ink-2">
            <span className="font-bold text-brand-700">Chart · </span>
            {m.text.replace(/^Requested: /, "Requested: ")}
          </li>
        ) : (
          <li key={i} className={cx("flex max-w-[92%] items-end gap-2", m.speaker === "clinician" ? "" : "ml-auto flex-row-reverse")}>
            <Avatar name={m.speaker === "clinician" ? clinician : patient} className="h-7 w-7 text-[10.5px]" />
            <div className={cx("min-w-0 rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed", m.speaker === "clinician" ? "rounded-bl-md bg-brand-50 text-ink ring-1 ring-inset ring-brand-100" : "rounded-br-md bg-surface-2 text-ink ring-1 ring-inset ring-line")}>
              <div className="mb-0.5 text-[11px] font-bold text-ink-3">{m.speaker === "clinician" ? clinician : patient} · turn {m.turn}</div>
              <div className="whitespace-pre-wrap">{m.text}</div>
            </div>
          </li>
        ),
      )}
    </ol>
  );
}

/** A list of entries that shows the first few and discloses the rest (no walls of rows). */
export function EntryList({ entries, onOpen, showWho = true, limit = 6 }: { entries: StateEntry[]; onOpen: (id: string) => void; showWho?: boolean; limit?: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? entries : entries.slice(0, limit);
  return (
    <div>
      {shown.map((e) => <EntryRow key={e.id} entry={e} onOpen={onOpen} showWho={showWho} dense />)}
      {entries.length > limit && (
        <button type="button" aria-expanded={all} onClick={() => setAll((x) => !x)} className="press m-1 inline-flex min-h-9 items-center gap-1 rounded-full bg-brand-50 px-3 text-xs font-bold text-brand-800 ring-1 ring-inset ring-brand-200 hover:bg-brand-100 pointer-coarse:min-h-11">
          <ChevronDown className={cx("h-3.5 w-3.5 transition-transform", all && "rotate-180")} aria-hidden />
          {all ? "Show fewer" : `Show all ${entries.length}`}
        </button>
      )}
    </div>
  );
}
