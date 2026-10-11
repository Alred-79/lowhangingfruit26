"use client";

import { ArrowRight, ChevronDown, ClipboardList, GitBranch, Lightbulb, Pin, Target, Users, Waypoints } from "lucide-react";
import { useContext, useMemo, useState } from "react";
import { CountUp } from "@/components/motion";
import { Badge, Button, Textarea, cx } from "@/components/ui";
import { STATUS_LABEL, statusBoard, type Chain, type EntryStatus, type PlanItem, type RunView } from "@/lib/journey/types";
import { Avatar, EntryRow, LitCtx, post, Spinner, STATUS_COLOR, STATUS_ORDER, StatusIcon, v } from "./shared";
import StatusBoardPanel, { StatusMix, type StatePoint } from "./StatusBoard";

const GROUPS: { title: string; kinds: string[] }[] = [
  { title: "Found out from the patient", kinds: ["finding", "goal"] },
  { title: "Exams, tests and records reviewed", kinds: ["result", "record"] },
  { title: "Assessment and interpretation", kinds: ["assessment", "interpretation", "consult"] },
  { title: "Recommendations and plan", kinds: ["recommendation", "referral", "plan_item", "callout", "plan_change"] },
  { title: "Uncertainty, questions and disagreements raised", kinds: ["uncertainty", "open_question", "disagreement"] },
  { title: "Followed up on earlier information", kinds: ["follow_up"] },
];

// ---------- (b) influence chains ----------

const STEP_STYLE: Record<string, { dot: string; tag: string; soft: string }> = {
  discovered: { dot: "bg-slate-500", tag: "text-slate-700", soft: "bg-slate-50" },
  handed_off: { dot: "bg-violet-500", tag: "text-violet-800", soft: "bg-violet-50" },
  asked: { dot: "bg-sky-500", tag: "text-sky-800", soft: "bg-sky-50" },
  new_information: { dot: "bg-orange-500", tag: "text-orange-800", soft: "bg-orange-50" },
  incorporated: { dot: "bg-brand-500", tag: "text-brand-800", soft: "bg-brand-50" },
  plan: { dot: "bg-emerald-500", tag: "text-emerald-800", soft: "bg-emerald-50" },
};

function ChainFlow({ chain, onOpen, stages }: { chain: Chain; onOpen: (id: string) => void; stages: number }) {
  return (
    <div className="rounded-[20px] bg-surface p-3.5 ring-1 ring-inset ring-line">
      <div className="mb-2.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
        <Badge tone="teal">Spans {chain.stagesSpanned} points in the journey</Badge>
        <span className="font-semibold">{chain.steps.length} steps</span>
      </div>
      <ol className="flex flex-wrap items-stretch gap-y-2.5">
        {chain.steps.map((s, i) => {
          const st = STEP_STYLE[s.kind];
          const body = (
            <>
              <div className={cx("flex items-center gap-1.5 text-[12px] font-extrabold", st.tag)}>
                <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", st.dot)} aria-hidden />
                {s.label}
              </div>
              <div className={cx("mt-1 text-[13px] leading-snug text-ink", s.kind === "asked" ? "line-clamp-[9]" : "line-clamp-5")} title={s.detail}>{s.kind === "asked" ? `“${s.detail}”` : s.detail}</div>
              <div className="mt-1.5 text-[11.5px] font-semibold text-ink-3">{s.who}{s.stageOrder > 0 && s.stageOrder <= stages ? ` · encounter ${s.stageOrder}` : ""}</div>
            </>
          );
          return (
            <li key={i} className="flex items-stretch">
              {i > 0 && <ArrowRight className="mx-1 h-4 w-4 shrink-0 self-center text-brand-400" aria-hidden />}
              {s.entryId ? (
                <button onClick={() => onOpen(s.entryId!)} className={cx("lift press w-52 shrink-0 rounded-2xl p-3 text-left ring-1 ring-inset ring-black/5", st.soft)}>{body}</button>
              ) : (
                <div className={cx("w-52 shrink-0 rounded-2xl p-3 ring-1 ring-inset ring-black/5", st.soft)}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------- (f) how the state evolved ----------

function Evolution({ rows, at, setAt }: { rows: (StatePoint & { counts: Record<EntryStatus, number>; total: number })[]; at: number; setAt: (i: number) => void }) {
  const [hover, setHover] = useState<{ row: number; status: EntryStatus } | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {STATUS_ORDER.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_COLOR[s] }} />{STATUS_LABEL[s]}</span>
        ))}
      </div>
      <div className="space-y-1">
        {rows.map((r, ri) => (
          <div key={r.order} className={cx("grid items-center gap-x-3 rounded-xl px-2 py-1.5 transition-colors sm:grid-cols-[13rem_1fr]", ri === at && "bg-brand-50 ring-1 ring-inset ring-brand-200")}>
            <button type="button" onClick={() => setAt(ri)} className="text-left leading-tight pointer-coarse:min-h-11" aria-pressed={ri === at} aria-label={`Rewind the board to ${r.label}`}>
              <div className="text-[13.5px] font-bold text-ink">{r.label}</div>
              <div className="text-[11.5px] text-ink-3">{r.sub}</div>
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-6" style={{ width: `${(r.total / max) * 88}%`, gap: 2 }}>
                {STATUS_ORDER.filter((s) => r.counts[s] > 0).map((s, si) => (
                  <div
                    key={s}
                    onMouseEnter={() => setHover({ row: ri, status: s })}
                    onMouseLeave={() => setHover(null)}
                    className="jr-seg relative flex min-w-[3px] items-center justify-center rounded-[4px] text-[11px] font-semibold text-white"
                    style={v({ flexGrow: r.counts[s], flexBasis: 0, background: STATUS_COLOR[s], opacity: hover && !(hover.row === ri && hover.status === s) ? 0.55 : 1, "--i": si + ri })}
                  >
                    {r.counts[s] / r.total > 0.07 && r.total / max > 0.3 ? <span className="rounded-sm bg-slate-900/45 px-1 leading-4">{r.counts[s]}</span> : null}
                    {hover?.row === ri && hover.status === s && (
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] font-medium text-white shadow">
                        {r.counts[s]} {STATUS_LABEL[s].toLowerCase()} · {r.label.toLowerCase()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <span className="font-mono text-xs font-semibold tabular-nums text-ink-2">{r.total}</span>
            </div>
          </div>
        ))}
      </div>
      <details className="mt-3 text-xs text-ink-2">
        <summary className="cursor-pointer font-bold text-brand-700">Show as a table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-ink-3">
                <th className="py-1 pr-2 font-medium">Point in the journey</th>
                {STATUS_ORDER.map((s) => <th key={s} className="px-1 py-1 font-medium">{STATUS_LABEL[s]}</th>)}
                <th className="px-1 py-1 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.order} className="border-b border-line/60">
                  <td className="py-1 pr-2">{r.label}</td>
                  {STATUS_ORDER.map((s) => <td key={s} className="px-1 py-1 tabular-nums">{r.counts[s]}</td>)}
                  <td className="px-1 py-1 tabular-nums">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

// ---------- (d) care plan ----------

function PlanItemRow({ view, item, n, onOpen, refresh, lit, pinned, onLight, onPin }: { view: RunView; item: PlanItem; n: number; onOpen: (id: string) => void; refresh: () => void; lit: boolean; pinned: boolean; onLight: (on: boolean) => void; onPin: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const byId = new Map(view.entries.map((e) => [e.id, e]));
  const reply = [...view.messages].reverse().find((m) => m.thread === "plan" && m.meta?.itemId === item.id && m.fromIsAi);
  async function send() {
    setBusy(true);
    setErr("");
    const r = await post(`/api/journeys/runs/${view.id}/plan`, { itemId: item.id, text });
    setBusy(false);
    if (r.error) return setErr(r.error);
    setEditing(false);
    setText("");
    refresh();
  }
  return (
    <li
      className={cx("jr-lit rounded-2xl p-3.5 ring-1 ring-inset", lit ? "bg-[var(--color-xp-soft)] ring-[var(--color-xp-ink)]/40" : "bg-surface ring-line/80")}
      onMouseEnter={() => onLight(true)}
      onMouseLeave={() => onLight(false)}
      onFocus={() => onLight(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && onLight(false)}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-xl font-display text-[14px] font-black clay", lit ? "bg-ink text-[var(--color-xp)]" : "bg-brand-600 text-white")} aria-hidden>{n}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:justify-between">
            <button type="button" onClick={onPin} aria-pressed={pinned} title="Pin: keep the entries this action rests on lit" className="w-full min-w-0 rounded-lg sm:w-auto sm:flex-1 text-left text-[14.5px] font-bold leading-snug text-ink">
              {item.action}
              {pinned && <Pin className="ml-1.5 inline h-3.5 w-3.5 -rotate-45 text-brand-600" aria-label="pinned" />}
            </button>
            {item.professions.length > 1 && <Badge tone="teal"><Users className="h-3 w-3" aria-hidden />Combines {item.professions.length} professions</Badge>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
            <span className="font-semibold text-ink-3">Owner:</span>
            {item.ownerRoles.map((o) => <Badge key={o} tone="blue">{o}</Badge>)}
            {item.timeframe && <span className="rounded-full bg-surface-2 px-2 py-0.5 font-semibold text-ink-2">{item.timeframe}</span>}
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{item.rationale}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11.5px] font-bold text-ink-3">Rests on:</span>
            {item.restsOn.map((id) => {
              const e = byId.get(id);
              if (!e) return null;
              return (
                <button key={id} onClick={() => onOpen(id)} title={e.text} className={cx("jr-lit inline-flex min-h-7 max-w-[16rem] items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium text-ink ring-1 ring-inset pointer-coarse:min-h-11", lit ? "jr-glow bg-surface ring-transparent" : "bg-surface ring-line hover:bg-brand-50")}>
                  <StatusIcon status={e.effectiveStatus} className="h-3 w-3 shrink-0" />
                  <span className="truncate">{e.stageId === "record" ? "Record" : e.contributorRole}: {e.text}</span>
                </button>
              );
            })}
          </div>
          {item.revisions?.map((r, i) => (
            <p key={i} className="mt-2 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-[12px] text-emerald-900 ring-1 ring-inset ring-emerald-200">Changed in the huddle by {r.by}. Was: &ldquo;{r.from}&rdquo;</p>
          ))}
          {reply && !editing && (
            <p className="mt-2 flex gap-2 rounded-xl bg-surface-2 px-2.5 py-1.5 text-[12.5px] text-ink-2">
              <Avatar name={reply.fromName} className="h-5 w-5 text-[8.5px]" />
              <span><span className="font-bold text-ink">{reply.fromName}:</span> {reply.text}</span>
            </p>
          )}
          {view.viewerIsOwner &&
            (editing ? (
              <div className="mt-2 space-y-2">
                <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="What would you change about this item, and why? The colleague who owns it will answer." />
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={send} disabled={busy || !text.trim()}>Propose change</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                  {busy && <Spinner label="The team is considering it" />}
                  {err && <span className="text-xs font-semibold text-rose-700">{err}</span>}
                </div>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="mt-2 min-h-8 rounded-full px-2 text-xs font-bold text-brand-700 hover:bg-brand-50 pointer-coarse:min-h-11">Propose a change to this item</button>
            ))}
        </div>
      </div>
    </li>
  );
}

/** A dot per entry, one column per contributor: the cited entries glow, the rest dim. The live "graph" beside the plan. */
function EvidenceRail({ view, lit, action, onOpen }: { view: RunView; lit: string[] | null; action: string | null; onOpen: (id: string) => void }) {
  const cols = [{ id: "record", title: "Record" }, ...[...view.stages].sort((a, b) => a.stage.order - b.stage.order).map((s) => ({ id: s.stage.id, title: `${s.stage.order}` })), ...(view.entries.some((e) => e.stageId === "huddle") ? [{ id: "huddle", title: "Huddle" }] : [])];
  const set = lit ? new Set(lit) : null;
  const cited = lit ? view.entries.filter((e) => set!.has(e.id)) : [];
  return (
    <div className="rounded-[20px] bg-ink p-4 text-white shadow-e2">
      <p className="inline-flex items-center gap-2 font-display text-[14px] font-extrabold"><Lightbulb className="h-4 w-4 text-[var(--color-xp)]" aria-hidden />What this action rests on</p>
      <div className="mt-3 flex items-end gap-2" aria-hidden>
        {cols.map((c) => {
          const list = view.entries.filter((e) => e.stageId === c.id);
          return (
            <div key={c.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex flex-wrap-reverse justify-center gap-[3px]">
                {list.map((e) => (
                  <span key={e.id} className={cx("jr-lit h-2.5 w-2.5 rounded-full", set && (set.has(e.id) ? "scale-125 ring-2 ring-[var(--color-xp)]" : "opacity-25"))} style={{ background: STATUS_COLOR[e.effectiveStatus] }} />
                ))}
              </div>
              <span className="text-[10.5px] font-bold text-white/70">{c.title}</span>
            </div>
          );
        })}
      </div>
      {action ? (
        <>
          <p className="mt-3 line-clamp-3 text-[12.5px] font-semibold text-white/85">{action}</p>
          <div className="mt-2 space-y-1 rounded-2xl bg-surface p-1">
            {cited.map((e) => <EntryRow key={e.id} entry={e} onOpen={onOpen} dense lit />)}
          </div>
        </>
      ) : (
        <p className="mt-3 text-[12.5px] leading-relaxed text-white/80">Hover or focus an action to light up the entries it rests on, here and in the shared-state graph. Select an action to pin it.</p>
      )}
    </div>
  );
}

const NAV: [string, string, typeof ClipboardList][] = [
  ["#plan", "Coordinated care plan", ClipboardList],
  ["#contrib", "Who contributed what", Users],
  ["#chains", "How information travelled", Waypoints],
  ["#status", "Established, uncertain, disputed, unanswered", Target],
  ["#evolve", "How the state evolved", GitBranch],
];

function Section({ id, title, subtitle, icon: Icon, tone, children }: { id: string; title: string; subtitle: string; icon: typeof ClipboardList; tone: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-[24px] border border-line/80 bg-surface shadow-e1">
      <header className="flex items-start gap-3 px-5 pb-3 pt-5">
        <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-2xl clay", tone)}><Icon className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <h2 className="font-display text-[21px] font-black leading-tight tracking-[-0.025em] text-ink">{title}</h2>
          <p className="mt-0.5 max-w-3xl text-[13px] leading-relaxed text-ink-3">{subtitle}</p>
        </div>
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}

/** The integrated patient representation. Every item on it opens its provenance. */
export default function FinalView({ view, onOpen, refresh }: { view: RunView; onOpen: (id: string) => void; refresh: () => void }) {
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const [readAll, setReadAll] = useState(false);
  const [chainAt, setChainAt] = useState(0);
  const [openC, setOpenC] = useState<Record<string, boolean>>({});
  const [hoverItem, setHoverItem] = useState<string | null>(null);
  const [pinItem, setPinItem] = useState<string | null>(null);
  const ctx = useContext(LitCtx);
  // One function computes the status of every entry for the header, this board and the evolution chart.
  const sb = statusBoard(view.entries, view.links);
  const unresolved = sb.unresolved;
  const syn = view.synthesis;
  const contributors = [{ id: "record", title: "Existing record", name: "Before the journey", isStudent: false }, ...view.stages.map((s) => ({ id: s.stage.id, title: s.stage.roleTitle, name: `${s.clinicianName} · ${s.stage.simTime}`, isStudent: s.isStudent })), ...(view.entries.some((e) => e.stageId === "huddle") ? [{ id: "huddle", title: "Team huddle", name: "Whole team", isStudent: false }] : [])];

  // Points of the journey at which the state can be rewound (the same points as the evolution chart).
  const rows = useMemo(() => {
    const points: StatePoint[] = [{ order: 0, label: "Existing record", sub: "Before the journey" }, ...view.stages.filter((s) => view.entries.some((e) => e.stageId === s.stage.id)).map((s) => ({ order: s.stage.order, label: `After encounter ${s.stage.order}`, sub: `${s.stage.roleTitle} · ${s.stage.simTime}` }))];
    if (view.entries.some((e) => e.stageId === "huddle")) points.push({ order: view.stages.length + 1, label: "After the team huddle", sub: "Reconciliation" });
    // The same function that fills the header and the board, asked for the state as it stood at each point.
    return points.map((p) => {
      const b = statusBoard(view.entries, view.links, p.order);
      return { ...p, counts: b.counts, total: b.total };
    });
  }, [view]);
  const [atRaw, setAt] = useState<number | null>(null);
  const at = atRaw === null ? rows.length - 1 : Math.min(atRaw, rows.length - 1);
  // "Now" is the live board (no cut-off), exactly as before; earlier points use the same function with a cut-off.
  const board = at >= rows.length - 1 ? sb : statusBoard(view.entries, view.links, rows[at].order);

  const items = syn ? syn.problems.flatMap((p) => p.items) : [];
  const activeItem = items.find((i) => i.id === (hoverItem || pinItem)) || null;
  const lit = activeItem ? activeItem.restsOn : null;
  // The hub's graph and level path light up too (when this view sits inside the hub).
  const light = (ids: string[] | null) => ctx?.setLit(ids);
  const number = new Map(items.map((it, i) => [it.id, i + 1]));
  const setHover = (id: string | null) => {
    setHoverItem(id);
    const it = items.find((i) => i.id === (id || pinItem));
    light(it ? it.restsOn : null);
  };

  return (
    <div className="space-y-5">
      <nav aria-label="Sections of the integrated view" className="scroll-quiet -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {NAV.map(([h, l, I]) => (
          <a key={h} href={h} className="press inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 text-[12.5px] font-bold text-ink-2 shadow-e1 ring-1 ring-inset ring-line hover:bg-brand-50 hover:text-brand-800 pointer-coarse:min-h-11">
            <I className="h-3.5 w-3.5 text-brand-600" aria-hidden />
            {l}
          </a>
        ))}
      </nav>

      {/* Hero: the patient in one place, with the numbers of the shared state. */}
      <section className="rise relative overflow-hidden rounded-[26px] bg-ink p-5 text-white clay sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full spin-slow [background:conic-gradient(from_0deg,transparent,oklch(0.86_0.2_128/0.22),transparent_45%)]" aria-hidden />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <Avatar name={view.patient.name} className="h-12 w-12 text-[16px]" />
              <h2 className="font-display text-[22px] font-black leading-tight tracking-[-0.03em] sm:text-[26px]">{view.patient.name}, {view.patient.age} · one patient, {view.stages.length} encounters, one shared state</h2>
            </div>
            <p className={cx("mt-3 max-w-[68ch] text-[14.5px] leading-relaxed text-white/85", !readAll && "line-clamp-4")}>{syn?.patientSummary || "The integrated summary and care plan are written after the team huddle. Everything below is live and grows after each encounter."}</p>
            {syn && syn.patientSummary.length > 360 && (
              <button onClick={() => setReadAll((x) => !x)} aria-expanded={readAll} className="mt-1 inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[12.5px] font-bold text-[var(--color-xp)] hover:bg-white/10 pointer-coarse:min-h-11">
                <ChevronDown className={cx("h-3.5 w-3.5 transition-transform", readAll && "rotate-180")} aria-hidden />
                {readAll ? "Show less" : "Read the whole summary"}
              </button>
            )}
            {syn && syn.summaryCites.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11.5px] font-bold text-white/70">Rests on:</span>
                {syn.summaryCites.slice(0, 8).map((id) => {
                  const e = view.entries.find((x) => x.id === id);
                  return e ? <button key={id} onClick={() => onOpen(id)} className="inline-flex min-h-7 max-w-[14rem] items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[11.5px] text-white ring-1 ring-inset ring-white/20 hover:bg-white/20 pointer-coarse:min-h-11"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLOR[e.effectiveStatus] }} aria-hidden /><span className="truncate">{e.text}</span></button> : null;
                })}
              </div>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-2 self-start sm:grid-cols-4 lg:w-[25rem]">
            {([
              [sb.total, "items in the shared state", "bg-white/10"],
              [view.links.length, "recorded relations", "bg-white/10"],
              [view.chains.length, "cross-encounter chains", "bg-white/10"],
              [unresolved, "uncertain, disputed or unanswered", unresolved ? "bg-[var(--color-flame-2)] text-ink" : "bg-[var(--color-xp)] text-ink"],
            ] as [number, string, string][]).map(([num, l, cls], i) => (
              <div key={l} className={cx("pop-spring rounded-2xl px-3 py-2.5", cls)} style={v({ "--i": i })}>
                <dd className="font-display text-[30px] font-black leading-none tracking-[-0.04em] tabular"><CountUp value={num} delay={150 + i * 80} /></dd>
                <dt className="mt-1 text-[11.5px] font-semibold leading-tight opacity-90">{l}</dt>
              </div>
            ))}
          </dl>
        </div>
        <StatusMix counts={sb.counts} total={sb.total} className="relative mt-5" />
        <div className="relative mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-white/85">
          {STATUS_ORDER.filter((s) => sb.counts[s]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} aria-hidden />{STATUS_LABEL[s]} <span className="font-mono font-bold text-white">{sb.counts[s]}</span></span>
          ))}
        </div>
      </section>

      {/* The team, as a strip of pillars: what each encounter used, added, flagged and handed on. */}
      <section aria-label="What each encounter used, contributed, identified and communicated" className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
        {view.pillars.map((p, i) => {
          const maxP = Math.max(1, ...view.pillars.map((x) => Math.max(x.used, x.contributed, x.identified)));
          const bars: [string, string, number, string, string][] = [
            ["Used", "Earlier entries this professional drew on", p.used, `${p.used} earlier ${p.used === 1 ? "entry" : "entries"}`, "bg-brand-500"],
            ["Contributed", "New entries this professional added", p.contributed, `${p.contributed} new`, "bg-[var(--color-xp-ink)]"],
            ["Identified", "Uncertainties, questions and disagreements raised", p.identified, `${p.identified} open ${p.identified === 1 ? "point" : "points"}`, "bg-amber-500"],
          ];
          return (
            <div key={p.stageId} className={cx("rise rounded-[20px] p-4 ring-1 ring-inset", p.isStudent ? "bg-[var(--color-mastery-soft)] ring-[var(--color-mastery)]/40" : "bg-surface ring-line")} style={v({ "--i": i })}>
              <div className="flex items-center gap-2.5">
                <Avatar name={p.name} you={p.isStudent} className="h-9 w-9 text-[12.5px]" />
                <div className="min-w-0">
                  <div className="truncate font-display text-[14.5px] font-extrabold text-ink">{i + 1}. {p.role}</div>
                  <div className="flex items-center gap-1.5 truncate text-[12px] text-ink-3">{p.isStudent && view.viewerIsOwner ? "you" : p.name} {p.isStudent && !view.viewerIsOwner && <Badge tone="teal">learner</Badge>}</div>
                </div>
              </div>
              <dl className="mt-3 space-y-1.5">
                {bars.map(([k, t, val, txt, c]) => (
                  <div key={k} title={t}>
                    <div className="flex justify-between text-[11.5px]"><dt className="font-bold text-ink-2">{k}</dt><dd className="font-mono font-semibold text-ink">{txt}</dd></div>
                    <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-black/5" aria-hidden><div className={cx("bar-grow h-full rounded-full", c)} style={v({ width: `${(val / maxP) * 100}%`, "--delay": `${200 + i * 80}ms` })} /></div>
                  </div>
                ))}
                <div className="flex justify-between pt-0.5 text-[11.5px]" title="Handoff written to the next professional">
                  <dt className="font-bold text-ink-2">Communicated</dt>
                  <dd className={cx("rounded-full px-2 font-bold", p.communicated ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-ink-2")}>{p.communicated ? "SBAR handoff" : "Not yet"}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </section>

      <Section id="plan" icon={ClipboardList} tone="bg-[var(--color-xp)] text-ink" title="Coordinated care plan" subtitle="Organised by the patient's problems and goals, not by profession. Every action names its owners and the entries it rests on. Hover or focus an action to light up those entries.">
        {!syn ? (
          <p className="rounded-2xl border-2 border-dashed border-brand-200 px-4 py-6 text-center text-sm text-ink-3">The plan is written when the team huddle closes.</p>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-4">
              {syn.problems.map((p, pi) => (
                <div key={p.id} className="rise overflow-hidden rounded-[22px] bg-surface-2 ring-1 ring-inset ring-line" style={v({ "--i": pi })}>
                  <div className="px-4 pb-3 pt-4">
                    <h3 className="font-display text-[17px] font-black leading-snug tracking-[-0.02em] text-ink">{p.title}</h3>
                    {p.patientGoal && (
                      <p className="mt-2 flex items-start gap-2 rounded-xl bg-surface px-3 py-2 text-[13px] text-ink ring-1 ring-inset ring-line">
                        <Target className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-flame)]" aria-hidden />
                        <span><span className="font-bold">What the patient wants:</span> {p.patientGoal}</span>
                      </p>
                    )}
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{p.summary}</p>
                  </div>
                  <ol className="space-y-2 px-2 pb-2">
                    {p.items.map((it) => (
                      <PlanItemRow
                        key={it.id}
                        view={view}
                        item={it}
                        n={number.get(it.id) || 0}
                        onOpen={onOpen}
                        refresh={refresh}
                        lit={activeItem?.id === it.id}
                        pinned={pinItem === it.id}
                        onLight={(on) => setHover(on ? it.id : null)}
                        onPin={() => {
                          const next = pinItem === it.id ? null : it.id;
                          setPinItem(next);
                          light(next ? it.restsOn : hoverItem ? items.find((x) => x.id === hoverItem)?.restsOn || null : null);
                        }}
                      />
                    ))}
                  </ol>
                </div>
              ))}
              <p className="text-[11.5px] text-ink-3">
                Written by a model from the shared state only. Each action was checked: it must cite entries that exist and contain no value absent from the record{syn.droppedItems ? `; ${syn.droppedItems} proposed action${syn.droppedItems === 1 ? "" : "s"} failed that check and ${syn.droppedItems === 1 ? "was" : "were"} left out` : ""}.
              </p>
            </div>
            <aside className="hidden xl:block">
              <div className="sticky top-4">
                <EvidenceRail view={view} lit={lit} action={activeItem?.action || null} onOpen={onOpen} />
              </div>
            </aside>
          </div>
        )}
      </Section>

      <Section id="contrib" icon={Users} tone="bg-brand-600 text-white" title="What each profession contributed" subtitle="Grouped by who added it. Select any line for its full provenance.">
        <div className="grid gap-3 lg:grid-cols-2">
          {contributors.map((c) => {
            const mine = view.entries.filter((e) => e.stageId === c.id);
            if (!mine.length) return null;
            const expanded = showAll[c.id];
            const counts = STATUS_ORDER.reduce((m, s) => ((m[s] = mine.filter((e) => e.effectiveStatus === s).length), m), {} as Record<EntryStatus, number>);
            return (
              <div key={c.id} className={cx("rounded-[20px] ring-1 ring-inset", c.isStudent ? "ring-[var(--color-mastery)]/40" : "ring-line")}>
                <div className={cx("rounded-t-[20px] px-3.5 py-3", c.isStudent ? "bg-[var(--color-mastery-soft)]" : "bg-surface-2")}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={c.id === "record" ? "Record" : c.id === "huddle" ? "Team Huddle" : c.name} you={c.isStudent} className="h-8 w-8 text-[11.5px]" />
                      <div className="min-w-0">
                        <div className="truncate font-display text-[14.5px] font-extrabold text-ink">{c.title}</div>
                        <div className="truncate text-[11.5px] text-ink-3">{c.name} · {mine.length} entries</div>
                      </div>
                    </div>
                    {c.id !== "record" && c.id !== "huddle" && <Badge tone={c.isStudent ? "teal" : "slate"}>{c.isStudent ? "Student" : "AI colleague"}</Badge>}
                  </div>
                  <StatusMix counts={counts} total={mine.length} className="mt-2.5" />
                </div>
                {!openC[c.id] ? (
                  <div className="flex flex-wrap items-center gap-1.5 p-3">
                    {(c.id === "record" || c.id === "huddle" ? [] : GROUPS)
                      .map((g) => [g.title, mine.filter((e) => g.kinds.includes(e.kind)).length] as const)
                      .filter(([, k]) => k)
                      .map(([t, k]) => (
                        <span key={t} className="rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] font-semibold text-ink-2">{t} <span className="font-mono font-bold text-ink">{k}</span></span>
                      ))}
                    <button type="button" aria-expanded={false} onClick={() => setOpenC((o) => ({ ...o, [c.id]: true }))} className="press inline-flex min-h-9 items-center gap-1 rounded-full bg-brand-600 px-3 text-xs font-bold text-white hover:bg-brand-500 pointer-coarse:min-h-11">
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                      Show the {mine.length} entries
                    </button>
                  </div>
                ) : (
                <div className="p-1.5">
                  <button type="button" aria-expanded onClick={() => setOpenC((o) => ({ ...o, [c.id]: false }))} className="mb-1 ml-1 inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-xs font-bold text-brand-700 hover:bg-brand-50 pointer-coarse:min-h-11">
                    <ChevronDown className="h-3.5 w-3.5 rotate-180" aria-hidden />
                    Collapse
                  </button>
                  {c.id === "record" || c.id === "huddle"
                    ? mine.slice(0, expanded ? 99 : 6).map((e) => <EntryRow key={e.id} entry={e} onOpen={onOpen} showWho={false} dense lit={!!lit?.includes(e.id)} />)
                    : GROUPS.map((g) => {
                        const gi = mine.filter((e) => g.kinds.includes(e.kind));
                        if (!gi.length) return null;
                        return (
                          <div key={g.title} className="mb-1.5">
                            <div className="px-2.5 pt-1.5 text-[12px] font-extrabold text-ink-2">{g.title} <span className="font-mono text-ink-3">{gi.length}</span></div>
                            {gi.slice(0, expanded ? 99 : 4).map((e) => <EntryRow key={e.id} entry={e} onOpen={onOpen} showWho={false} dense lit={!!lit?.includes(e.id)} />)}
                            {!expanded && gi.length > 4 && <div className="px-2.5 text-[11.5px] text-ink-3">and {gi.length - 4} more</div>}
                          </div>
                        );
                      })}
                  {(mine.length > 6 || c.id !== "record") && (
                    <button onClick={() => setShowAll((s) => ({ ...s, [c.id]: !expanded }))} className="press m-1 min-h-9 rounded-full bg-brand-50 px-3 text-xs font-bold text-brand-800 ring-1 ring-inset ring-brand-200 hover:bg-brand-100 pointer-coarse:min-h-11">{expanded ? "Show fewer" : "Show all"}</button>
                  )}
                </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="chains" icon={Waypoints} tone="bg-[var(--color-mastery)] text-white" title="How earlier information affected later decisions" subtitle="Built only from recorded relations: what was found, who picked it up, the question they asked because of it, what that uncovered, and who built on that.">
        {view.chains.length ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] font-semibold text-ink-2">
              {[["discovered", "Recorded"], ["handed_off", "Handed off"], ["asked", "Asked because of it"], ["new_information", "New information"], ["incorporated", "Built on"], ["plan", "Care plan"]].map(([k, l]) => (
                <span key={k} className="inline-flex items-center gap-1.5"><span className={cx("h-2.5 w-2.5 rounded-full", STEP_STYLE[k].dot)} aria-hidden />{l}</span>
              ))}
            </div>
            {view.chains.length > 1 && (
              <div role="group" aria-label="Choose a chain" className="flex flex-wrap gap-2">
                {view.chains.map((c, i) => (
                  <button key={c.id} type="button" aria-pressed={chainAt === i} onClick={() => setChainAt(i)} className={cx("press inline-flex min-h-10 max-w-full items-center gap-2 rounded-full pl-1.5 pr-3 text-left text-[13px] font-bold transition-colors pointer-coarse:min-h-11", chainAt === i ? "bg-ink text-white shadow-e2" : "bg-surface text-ink-2 ring-1 ring-inset ring-line hover:ring-brand-300")}>
                    <span className={cx("grid h-7 min-w-7 place-items-center rounded-full px-1.5 font-mono text-[12px]", chainAt === i ? "bg-[var(--color-xp)] text-ink" : "bg-surface-2 text-ink-2")}>{c.steps.length}</span>
                    <span className="truncate">{c.title || `Chain ${i + 1}`}</span>
                  </button>
                ))}
              </div>
            )}
            {view.chains[Math.min(chainAt, view.chains.length - 1)] && <ChainFlow key={view.chains[Math.min(chainAt, view.chains.length - 1)].id} chain={view.chains[Math.min(chainAt, view.chains.length - 1)]} onOpen={onOpen} stages={view.stages.length} />}
          </div>
        ) : (
          <p className="text-sm text-ink-3">No later encounter has drawn on an earlier entry yet. Chains appear as soon as a professional asks about something a colleague recorded.</p>
        )}
      </Section>

      <Section id="status" icon={Target} tone="bg-[var(--color-flame-2)] text-ink" title="What is established, and what is not" subtitle={`The team's confidence in each of the ${sb.total} items in the shared state: ${sb.counts.uncertain} uncertain, ${sb.counts.disputed} disputed and ${sb.counts.open_question} unanswered make the ${sb.unresolved} shown at the top.${sb.restated ? ` ${sb.restated} open item${sb.restated === 1 ? " was" : "s were"} restated by a later entry and ${sb.restated === 1 ? "is" : "are"} counted once, under the later entry.` : ""} Status changes are made by adding linked entries, so the earlier view is never lost.`}>
        <StatusBoardPanel view={view} onOpen={onOpen} points={rows} at={at} setAt={setAt} board={board} />
      </Section>

      <Section id="evolve" icon={GitBranch} tone="bg-ink text-white" title="How the shared state evolved" subtitle="Entries in the shared state after each encounter, by status at that point in the journey. Select a point to rewind the board above to it.">
        <Evolution rows={rows} at={at} setAt={setAt} />
      </Section>
    </div>
  );
}
