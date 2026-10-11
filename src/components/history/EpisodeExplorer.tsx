"use client";

import { ArrowUpRight, Eraser, MessageSquareQuote, PlayCircle, UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import When from "@/components/courses/When";
import TrustLabel from "@/components/TrustLabel";
import { cx } from "@/components/ui";
import { useWidth } from "./useWidth";
import "./history.css";

/** What the episodes page sends to the browser: only what the old table already rendered. */
export interface EpisodeItem {
  id: string;
  startedAt: string;
  status: string;
  mode: string;
  patient: string;
  participant: string;
  role: string;
  visitNumber: number;
  turns: number;
  score: number | null;
  recorded: boolean;
  match?: string;
  /** Faculty only; always empty for students. */
  caseTitle: string;
  openHref: string;
  /** The signed-in user took part (shown as "You"). */
  mine: boolean;
}

// Mode hues: a fixed-order categorical set, validated with the dataviz validator (light surface:
// lightness band, chroma floor, CVD and normal-vision separation, 3:1 contrast all pass). The mode is
// always printed beside its color too (chips, legend, row pill), never color alone.
const MODES: { id: string; label: string; color: string; soft: string; ink: string }[] = [
  { id: "practice", label: "Practice", color: "#11a39b", soft: "var(--color-tier-initial-soft)", ink: "var(--color-tier-initial-ink)" },
  { id: "adaptive", label: "Adaptive", color: "#2a78e8", soft: "var(--color-tier-discoverable-soft)", ink: "var(--color-tier-discoverable-ink)" },
  { id: "homework", label: "Homework", color: "#cc7a00", soft: "var(--color-tier-reluctant-soft)", ink: "var(--color-tier-reluctant-ink)" },
  { id: "exam", label: "Exam", color: "#8b5cf6", soft: "var(--color-mastery-soft)", ink: "var(--color-mastery-ink)" },
  { id: "journey", label: "Care journey", color: "#e23a7c", soft: "var(--color-tier-hidden-soft)", ink: "var(--color-tier-hidden-ink)" },
];
const OTHER = { id: "", label: "Other", color: "var(--color-ink-3)", soft: "var(--color-surface-2)", ink: "var(--color-ink-2)" };
const modeOf = (m: string) => MODES.find((x) => x.id === m) || { ...OTHER, id: m, label: m || "Other" };
const statusGroup = (s: string) => (s === "scored" ? "scored" : s === "active" || s === "paused" ? "active" : s === "submitted" ? "submitted" : "other");
const STATUS_LABEL: Record<string, string> = { scored: "Scored", active: "In progress", submitted: "Submitted", other: "Other" };
const parse = (s: string) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z").getTime();

type Facets = { mode: string; trust: string; status: string; patient: string };
const ALL: Facets = { mode: "all", trust: "all", status: "all", patient: "all" };
const keyOf: Record<keyof Facets, (e: EpisodeItem) => string> = {
  mode: (e) => e.mode,
  trust: (e) => (e.recorded ? "recorded" : "private"),
  status: (e) => statusGroup(e.status),
  patient: (e) => e.patient,
};
const match = (e: EpisodeItem, f: Facets, skip?: keyof Facets) => (Object.keys(f) as (keyof Facets)[]).every((k) => k === skip || f[k] === "all" || keyOf[k](e) === f[k]);

function Chips({ label, facet, options, value, onChange }: { label: string; facet: string; options: { id: string; label: string; count: number; swatch?: string; hollow?: boolean }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-full text-[12px] font-bold text-ink-3 sm:w-auto sm:min-w-16">{label}</span>
      <div role="group" aria-label={`Filter by ${facet}`} className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              disabled={!on && o.count === 0}
              onClick={() => onChange(on && o.id !== "all" ? "all" : o.id)}
              className={cx(
                "press inline-flex min-h-9 items-center gap-1.5 rounded-full pl-3 pr-1.5 text-[12.5px] font-bold transition-[background-color,color,box-shadow,opacity] duration-200 disabled:cursor-not-allowed disabled:opacity-45 pointer-coarse:min-h-11",
                on ? "bg-ink text-white shadow-e2" : "bg-surface text-ink-2 ring-1 ring-inset ring-line hover:ring-brand-300",
              )}
            >
              {o.swatch && <span className="h-3 w-3 shrink-0 rounded-full" style={o.hollow ? { boxShadow: `inset 0 0 0 2.5px ${o.swatch}`, background: "white" } : { background: o.swatch }} aria-hidden />}
              <span className="max-w-[12rem] truncate">{o.label}</span>
              <span key={o.count} className={cx("pop-spring grid h-6 min-w-6 place-items-center rounded-full px-1.5 font-mono text-[11.5px]", on ? "bg-[var(--color-xp)] text-ink" : "bg-surface-2 text-ink-2")}>
                {o.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Timeline of visits: time across, score up (unscored visits ride the top lane), color = mode, hollow = private. */
function Timeline({ items, shown }: { items: EpisodeItem[]; shown: Set<string> }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const H = 230;
  const m = { top: 34, right: 18, bottom: 26, left: 34 };
  const W = Math.max(width, 280);
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;
  const times = items.map((e) => parse(e.startedAt)).filter((t) => !isNaN(t));
  const t0 = Math.min(...times) - 12 * 3600e3;
  const t1 = Math.max(...times) + 12 * 3600e3;
  const xAt = (t: number) => m.left + ((t - t0) / Math.max(1, t1 - t0)) * iw;
  const yAt = (s: number) => m.top + ih - (Math.max(0, Math.min(100, s)) / 100) * ih;
  const laneY = 14;
  const days = Math.max(1, Math.round((t1 - t0) / 864e5));
  const tickEvery = Math.max(1, Math.ceil(days / Math.max(2, Math.floor(iw / 70))));
  const ticks: number[] = [];
  const start = new Date(t0);
  start.setHours(0, 0, 0, 0);
  for (let t = start.getTime() + 864e5; t < t1; t += 864e5 * tickEvery) ticks.push(t);
  const newest = items.reduce<EpisodeItem | null>((a, e) => (!a || parse(e.startedAt) > parse(a.startedAt) ? e : a), null);
  const pos = (e: EpisodeItem, i: number) => {
    const x = xAt(parse(e.startedAt));
    const scored = statusGroup(e.status) === "scored" && e.score !== null;
    // Unscored visits on the same lane are nudged apart so they never sit on top of each other.
    return { x, y: scored ? yAt(e.score!) : laneY + ((i % 2) * 2 - 1) * 4 };
  };
  const h = items.find((e) => e.id === hover) || null;
  const hp = h ? pos(h, items.indexOf(h)) : null;

  return (
    <div ref={ref} className="relative">
      {width > 0 ? (
        <svg width={W} height={H} className="block overflow-visible" aria-label={`Timeline of ${items.length} visits: time across, score up. Each dot is a link to the visit.`} role="group">
          <rect x={m.left} y={2} width={iw} height={24} rx={12} fill="var(--color-surface-2)" />
          <text x={m.left + 10} y={laneY} dy="0.34em" fontSize={10.5} fontWeight={700} fill="var(--color-ink-3)">
            no score yet
          </text>
          {[0, 50, 100].map((g) => (
            <g key={g}>
              <line x1={m.left} x2={W - m.right} y1={yAt(g)} y2={yAt(g)} stroke={g ? "var(--color-slate-200)" : "var(--color-slate-300)"} strokeDasharray={g === 50 ? "3 4" : undefined} />
              <text x={m.left - 6} y={yAt(g)} dy="0.34em" textAnchor="end" fontSize={11} fill="var(--color-ink-3)">
                {g}
              </text>
            </g>
          ))}
          {ticks.map((t) => (
            <text key={t} x={xAt(t)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--color-ink-3)" suppressHydrationWarning>
              {new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}
            </text>
          ))}
          {items.map((e, i) => {
            const { x, y } = pos(e, i);
            const md = modeOf(e.mode);
            const on = shown.has(e.id);
            return (
              <a
                key={e.id}
                href={e.openHref}
                className="hist-dot-link"
                tabIndex={on ? 0 : -1}
                aria-hidden={on ? undefined : true}
                aria-label={`${e.patient}, ${md.label}, ${e.recorded ? "Recorded for instructor" : "Private practice"}, ${e.score !== null && statusGroup(e.status) === "scored" ? `${Math.round(e.score)}%` : STATUS_LABEL[statusGroup(e.status)]}. Open`}
                onMouseEnter={() => setHover(e.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(e.id)}
                onBlur={() => setHover(null)}
              >
                <g className="hist-drop" style={{ "--i": i } as CSSProperties}>
                  <circle cx={x} cy={y} r={14} fill="transparent" />
                  <circle cx={x} cy={y} r={7} className="hist-dot hist-focus" data-off={!on} fill={e.recorded ? md.color : "white"} stroke={e.recorded ? "white" : md.color} strokeWidth={e.recorded ? 2 : 3} />
                </g>
              </a>
            );
          })}
          {newest && shown.has(newest.id) && <circle cx={pos(newest, items.indexOf(newest)).x} cy={pos(newest, items.indexOf(newest)).y} r={7} fill={modeOf(newest.mode).color} className="hist-ping" pointerEvents="none" />}
        </svg>
      ) : (
        <div style={{ height: H }} />
      )}
      {h && hp && width > 0 && (
        <div className="pop-in pointer-events-none absolute z-10 w-max max-w-[16rem] rounded-xl bg-ink px-3 py-2 text-[12px] text-white shadow-e3" style={{ top: Math.max(0, hp.y + 12), ...(hp.x > W / 2 ? { right: W - hp.x + 10 } : { left: hp.x + 10 }) }}>
          <div className="font-display text-[15px] font-black">{h.patient}</div>
          <div className="text-white/85">
            {modeOf(h.mode).label} · {h.recorded ? "Recorded for instructor" : "Private practice"}
          </div>
          <div className="text-white/85">
            <When at={h.startedAt} /> · {h.turns} turns · {h.score !== null && statusGroup(h.status) === "scored" ? `${Math.round(h.score)}%` : STATUS_LABEL[statusGroup(h.status)]}
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreMedal({ e }: { e: EpisodeItem }) {
  const g = statusGroup(e.status);
  if (g !== "scored" || e.score === null)
    return (
      <span className={cx("inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold", g === "active" ? "bg-[var(--color-xp-soft)] text-[var(--color-xp-ink)]" : "bg-surface-2 text-ink-2")}>
        {g === "active" && <span className="live-dot h-2 w-2 rounded-full bg-[var(--color-xp-ink)]" aria-hidden />}
        {g === "active" ? "in progress" : e.status}
      </span>
    );
  const pct = Math.max(0, Math.min(100, e.score));
  return (
    <span className="relative grid h-12 w-12 place-items-center" role="img" aria-label={`Score ${Math.round(e.score)}%`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-brand-100)" strokeWidth="4" />
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-brand-600)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 94.2} 94.2`} className="ring-fill" style={{ "--from": 94.2 } as CSSProperties} />
      </svg>
      <span className="relative font-display text-[14px] font-black text-ink">{Math.round(e.score)}</span>
    </span>
  );
}

/**
 * The visit history: a timeline you can read at a glance, filter chips with live counts (each count
 * is what you would get by picking that chip, given the other filters), and designed rows that keep
 * every link of the old table (patient and participant filters, open/resume).
 */
export default function EpisodeExplorer({ items, faculty }: { items: EpisodeItem[]; faculty: boolean }) {
  const [f, setF] = useState<Facets>(ALL);
  const shownList = useMemo(() => items.filter((e) => match(e, f)), [items, f]);
  const shown = useMemo(() => new Set(shownList.map((e) => e.id)), [shownList]);
  const count = (k: keyof Facets, val: string) => items.filter((e) => match(e, f, k) && (val === "all" || keyOf[k](e) === val)).length;
  const set = (k: keyof Facets) => (val: string) => setF((x) => ({ ...x, [k]: val }));

  const modes = [...MODES.filter((md) => items.some((e) => e.mode === md.id)), ...[...new Set(items.map((e) => e.mode))].filter((x) => !MODES.some((md) => md.id === x)).map((x) => modeOf(x))];
  const statuses = ["scored", "active", "submitted", "other"].filter((s) => items.some((e) => statusGroup(e.status) === s));
  const patients = [...new Map(items.map((e) => [e.patient, items.filter((x) => x.patient === e.patient).length])).entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const filtered = f.mode !== "all" || f.trust !== "all" || f.status !== "all" || f.patient !== "all";

  return (
    <div>
      <div className="rise rounded-[26px] border border-line/80 bg-surface p-4 shadow-e2 sm:p-5" style={{ "--i": 3 } as CSSProperties}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-[20px] font-black tracking-[-0.02em] text-ink">Visit timeline</h2>
            <p className="text-[13px] text-ink-3">Time runs across, the score goes up. Color is the visit type; a filled dot is recorded for your instructor, a hollow one is private practice.</p>
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-semibold text-ink-2" aria-label="Legend">
            {modes.map((md) => (
              <li key={md.id} className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full" style={{ background: md.color }} aria-hidden />
                {md.label}
              </li>
            ))}
            {items.some((e) => !e.recorded) && (
              <li className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-white" style={{ boxShadow: "inset 0 0 0 2.5px var(--color-ink-3)" }} aria-hidden />
                Private
              </li>
            )}
          </ul>
        </div>
        <div className="mt-3">
          <Timeline items={items} shown={shown} />
        </div>

        <div className="mt-4 space-y-2.5 border-t border-line/70 pt-4">
          <Chips label="Type" facet="visit type" value={f.mode} onChange={set("mode")} options={[{ id: "all", label: "All", count: count("mode", "all") }, ...modes.map((md) => ({ id: md.id, label: md.label, count: count("mode", md.id), swatch: md.color }))]} />
          <Chips
            label="Privacy"
            facet="who can see it"
            value={f.trust}
            onChange={set("trust")}
            options={[
              { id: "all", label: "All", count: count("trust", "all") },
              { id: "recorded", label: "Recorded for instructor", count: count("trust", "recorded"), swatch: "var(--color-ink-2)" },
              ...(faculty && !items.some((e) => !e.recorded) ? [] : [{ id: "private", label: "Private practice", count: count("trust", "private"), swatch: "var(--color-ink-2)", hollow: true }]),
            ]}
          />
          <Chips label="Status" facet="status" value={f.status} onChange={set("status")} options={[{ id: "all", label: "All", count: count("status", "all") }, ...statuses.map((s) => ({ id: s, label: STATUS_LABEL[s], count: count("status", s) }))]} />
          {patients.length > 1 && <Chips label="Patient" facet="patient" value={f.patient} onChange={set("patient")} options={[{ id: "all", label: "All", count: count("patient", "all") }, ...patients.map(([p]) => ({ id: p, label: p, count: count("patient", p) }))]} />}
        </div>
      </div>

      <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] text-ink-2" aria-live="polite">
          Showing <span className="font-display text-[18px] font-black text-ink">{shownList.length}</span> of {items.length}
          {filtered && " after filters"}
        </p>
        {filtered && (
          <button type="button" onClick={() => setF(ALL)} className="press inline-flex min-h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-[12.5px] font-bold text-ink-2 ring-1 ring-line hover:text-ink pointer-coarse:min-h-11">
            <Eraser className="h-3.5 w-3.5" aria-hidden />
            Clear filters
          </button>
        )}
      </div>

      {shownList.length === 0 ? (
        <div className="rounded-[20px] border-2 border-dashed border-brand-200 bg-surface/70 px-5 py-8 text-center text-[14px] text-ink-3">No visits match these filters.</div>
      ) : (
        <ul className="space-y-2.5">
          {shownList.map((e, i) => {
            const md = modeOf(e.mode);
            const active = statusGroup(e.status) === "active";
            return (
              <li key={e.id} className="hist-row-in lift grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-[20px] border border-line/80 bg-surface p-3.5 shadow-e1 sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center sm:p-4" style={{ "--i": i } as CSSProperties}>
                <span className="row-span-2 grid h-14 w-14 shrink-0 place-content-center rounded-2xl text-center sm:row-span-1" style={{ background: md.soft, color: md.ink }} aria-hidden>
                  <span className="font-display text-[22px] font-black leading-none" suppressHydrationWarning>
                    {new Date(parse(e.startedAt)).toLocaleDateString("en-US", { day: "numeric", timeZone: "America/New_York" })}
                  </span>
                  <span className="text-[11px] font-bold uppercase" suppressHydrationWarning>
                    {new Date(parse(e.startedAt)).toLocaleDateString("en-US", { month: "short", timeZone: "America/New_York" })}
                  </span>
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link href={`/episodes?patient=${encodeURIComponent(e.patient)}`} className="font-display text-[17px] font-extrabold leading-tight text-ink hover:text-brand-700 hover:underline">
                      {e.patient}
                    </Link>
                    {e.visitNumber > 1 && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11.5px] font-bold text-brand-800">visit {e.visitNumber}</span>}
                  </div>
                  {faculty && e.caseTitle && <div className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{e.caseTitle}</div>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ background: md.soft, color: md.ink }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: md.color }} aria-hidden />
                      {md.label}
                    </span>
                    <TrustLabel kind={e.recorded ? "recorded" : "private"} />
                    <span className="text-[12px] text-ink-3">
                      <When at={e.startedAt} />
                    </span>
                  </div>
                  {e.match && (
                    <p className="mt-2 flex gap-2 rounded-xl bg-[var(--color-tier-reluctant-soft)] px-2.5 py-1.5 text-[12.5px] leading-snug text-ink">
                      <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-tier-reluctant-ink)]" aria-hidden />
                      <span>{e.match}</span>
                    </p>
                  )}
                </div>
                <div className="col-start-2 min-w-0 text-[13px] sm:col-start-auto">
                  <Link href={`/episodes?participant=${encodeURIComponent(e.participant)}`} className="inline-flex items-center gap-1.5 font-bold text-ink hover:text-brand-700 hover:underline">
                    <UserRound className="h-3.5 w-3.5 text-ink-3" aria-hidden />
                    {e.participant}
                    {e.mine && <span className="rounded-full bg-[var(--color-xp)] px-1.5 text-[10.5px] font-black text-ink">You</span>}
                  </Link>
                  <div className="text-[12.5px] text-ink-3">{e.role}</div>
                  <div className="mt-1.5 flex items-center gap-2" title={`${e.turns} turns`}>
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                      <span className="bar-grow block h-full rounded-full bg-brand-400" style={{ width: `${Math.min(100, (e.turns / 20) * 100)}%` }} />
                    </span>
                    <span className="font-mono text-[11.5px] font-bold text-ink-2">{e.turns} turns</span>
                  </div>
                </div>
                <div className="col-start-2 flex items-center justify-between gap-3 sm:col-start-auto sm:justify-end">
                  <ScoreMedal e={e} />
                  <Link href={e.openHref} className={cx("press inline-flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-[13.5px] font-bold clay pointer-coarse:min-h-11", active ? "bg-brand-600 text-white" : "bg-ink text-white")}>
                    {active && e.openHref.endsWith(e.id) ? <PlayCircle className="h-4 w-4" aria-hidden /> : null}
                    Open
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
