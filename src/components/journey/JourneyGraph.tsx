"use client";

import { useMemo, useState } from "react";
import { STATUS_LABEL, statusBoard, type EntryStatus, type Relation, type RunView, type StateEntry } from "@/lib/journey/types";
import { STATUS_COLOR, STATUS_ORDER } from "./shared";

// The shared patient state as a graph: one column per encounter (the existing record first, the
// huddle last), one dot per entry coloured by its current status, and every typed relation drawn
// as a curve from the earlier entry to the later one. Built only from the run view the hub already
// has; clicking a dot opens the same provenance panel as everywhere else.
const REL: Record<Relation, { color: string; label: string; dash?: string }> = {
  uses: { color: "var(--color-brand-500)", label: "uses" },
  confirms: { color: "#1baf7a", label: "confirms" },
  contradicts: { color: "#e5484d", label: "contradicts", dash: "4 3" },
  updates: { color: "#2a78d6", label: "updates" },
  answers: { color: "#0e8a96", label: "answers" },
  resolves: { color: "#0e8a96", label: "resolves", dash: "1 3" },
};

const COL_W = 168;
const ROW_H = 15;
const TOP = 58;
const PAD_X = 28;

export default function JourneyGraph({ view, onOpen, lit }: { view: RunView; onOpen: (id: string) => void; lit?: string[] | null }) {
  const [hover, setHover] = useState<string | null>(null);

  const layout = useMemo(() => {
    const cols: { key: string; title: string; sub: string; you: boolean }[] = [{ key: "record", title: "Existing record", sub: "Before the journey", you: false }];
    for (const s of [...view.stages].sort((a, b) => a.stage.order - b.stage.order)) {
      cols.push({ key: s.stage.id, title: `${s.stage.order}. ${s.stage.roleTitle}`, sub: s.isStudent ? (view.viewerIsOwner ? "You" : view.studentName) : `${s.clinicianName} (AI)`, you: s.isStudent });
    }
    if (view.entries.some((e) => e.stageId === "huddle")) cols.push({ key: "huddle", title: "Team huddle", sub: "Reconciled together", you: false });
    const colIndex = new Map(cols.map((c, i) => [c.key, i]));
    const pos = new Map<string, { x: number; y: number; e: StateEntry }>();
    let maxRows = 1;
    const perCol = new Map<number, StateEntry[]>();
    for (const e of view.entries) {
      const ci = colIndex.get(e.stageId) ?? Math.min(cols.length - 1, Math.max(0, e.stageOrder));
      perCol.set(ci, [...(perCol.get(ci) || []), e]);
    }
    for (const [ci, list] of perCol) {
      // Group by status inside a column so the column itself reads as a status bar.
      list.sort((a, b) => STATUS_ORDER.indexOf(a.effectiveStatus) - STATUS_ORDER.indexOf(b.effectiveStatus));
      const perRow = list.length > 22 ? 3 : list.length > 11 ? 2 : 1;
      list.forEach((e, k) => {
        const r = Math.floor(k / perRow);
        const c = k % perRow;
        maxRows = Math.max(maxRows, r + 1);
        pos.set(e.id, { x: PAD_X + ci * COL_W + COL_W / 2 + (c - (perRow - 1) / 2) * 16, y: TOP + r * ROW_H, e });
      });
    }
    const links = view.links.filter((l) => pos.has(l.from) && pos.has(l.to));
    const empty = new Set(cols.map((_, i) => i).filter((i) => !perCol.has(i)));
    const W = PAD_X * 2 + cols.length * COL_W;
    const H = TOP + maxRows * ROW_H + 18;
    return { cols, pos, links, W, H, empty };
  }, [view]);

  const { cols, pos, links, W, H, empty } = layout;
  // Hovering a dot lights it and its neighbours; otherwise a hovered care-plan action lights the entries it rests on.
  const active = hover ? new Set([hover, ...links.filter((l) => l.from === hover || l.to === hover).flatMap((l) => [l.from, l.to])]) : lit?.length ? new Set(lit) : null;
  const hovered = hover ? pos.get(hover)?.e : null;
  const counts = links.reduce<Record<string, number>>((m, l) => ((m[l.relation] = (m[l.relation] || 0) + 1), m), {});
  // Same counting as the run header and the status board (restated open items counted once).
  const statusCounts: Record<string, number> = statusBoard(view.entries, view.links).counts;

  return (
    <div>
      <div className="scroll-quiet overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: Math.min(W, 760) }} className="w-full" role="group" aria-label={`Shared patient state: ${view.entries.length} entries and ${links.length} links across ${cols.length} columns`}>
          {cols.map((c, i) => (
            <g key={c.key}>
              <rect x={PAD_X + i * COL_W + 6} y={4} width={COL_W - 12} height={H - 8} rx={16} fill={c.you ? "var(--color-mastery-soft)" : "var(--color-surface-2)"} stroke={c.you ? "var(--color-mastery)" : "none"} strokeOpacity={0.45} strokeWidth={1.5} />
              <text x={PAD_X + i * COL_W + COL_W / 2} y={24} textAnchor="middle" fontSize={12.5} fontWeight={800} fill="var(--color-ink)" fontFamily="var(--font-display)">
                {c.title.length > 24 ? c.title.slice(0, 23) + "…" : c.title}
              </text>
              <text x={PAD_X + i * COL_W + COL_W / 2} y={39} textAnchor="middle" fontSize={11} fill={c.you ? "var(--color-mastery-ink)" : "var(--color-ink-3)"} fontWeight={c.you ? 700 : 400}>
                {c.sub.length > 26 ? c.sub.slice(0, 25) + "…" : c.sub}
              </text>
              {empty.has(i) && (
                <text x={PAD_X + i * COL_W + COL_W / 2} y={TOP + 24} textAnchor="middle" fontSize={11} fill="var(--color-ink-3)">
                  {c.you ? "Your visit adds here" : "Not seen yet"}
                </text>
              )}
            </g>
          ))}
          {links.map((l, k) => {
            const a = pos.get(l.to)!; // the earlier entry
            const b = pos.get(l.from)!; // the later entry that uses, confirms, contradicts... it
            const r = REL[l.relation];
            const dx = Math.max(30, Math.abs(b.x - a.x) / 2);
            const d = `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
            const on = !active || (active.has(l.from) && active.has(l.to));
            return (
              <path
                key={l.id}
                d={d}
                fill="none"
                stroke={r.color}
                strokeWidth={on && active ? 2 : 1.25}
                strokeOpacity={on ? (active ? 0.95 : 0.5) : 0.08}
                strokeDasharray={r.dash}
                pathLength={r.dash ? undefined : 1}
                className={r.dash ? undefined : "draw-in"}
                style={{ "--len": 1, "--i": Math.min(24, Math.floor(k / 2)) } as React.CSSProperties}
              />
            );
          })}
          {[...pos.values()].map(({ x, y, e }) => {
            const dim = active && !active.has(e.id);
            const glow = !hover && !!lit?.length && active?.has(e.id);
            return (
              <g
                key={e.id}
                role="button"
                tabIndex={0}
                aria-label={`${STATUS_LABEL[e.effectiveStatus]}: ${e.text}`}
                onMouseEnter={() => setHover(e.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(e.id)}
                onBlur={() => setHover(null)}
                onClick={() => onOpen(e.id)}
                onKeyDown={(ev) => (ev.key === "Enter" || ev.key === " ") && (ev.preventDefault(), onOpen(e.id))}
                className="cursor-pointer outline-none"
                opacity={dim ? 0.25 : 1}
              >
                <circle cx={x} cy={y} r={9} fill="transparent" />
                {glow && <circle cx={x} cy={y} r={9.5} fill="var(--color-xp)" opacity={0.85} />}
                <circle className="jr-lit" cx={x} cy={y} r={hover === e.id || glow ? 6.5 : 5} fill={STATUS_COLOR[e.effectiveStatus]} stroke="var(--color-surface)" strokeWidth={1.75} />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 flex min-h-[3.25rem] flex-wrap items-start justify-between gap-x-6 gap-y-2 text-[12px] text-ink-3">
        {hovered ? (
          <p className="max-w-3xl text-[13px] text-ink">
            <span className="font-semibold" style={{ color: STATUS_COLOR[hovered.effectiveStatus] }}>
              {STATUS_LABEL[hovered.effectiveStatus]}
            </span>{" "}
            · {hovered.text} <span className="text-ink-3">· {hovered.contributorName}, {hovered.contributorRole}</span>
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {(STATUS_ORDER as EntryStatus[]).filter((s) => statusCounts[s]).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} aria-hidden />
                  {STATUS_LABEL[s]} <span className="font-mono font-semibold text-ink">{statusCounts[s]}</span>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {(Object.keys(REL) as Relation[]).filter((r) => counts[r]).map((r) => (
                <span key={r} className="inline-flex items-center gap-1.5">
                  <svg width="18" height="6" aria-hidden>
                    <line x1="0" y1="3" x2="18" y2="3" stroke={REL[r].color} strokeWidth="2" strokeDasharray={REL[r].dash} />
                  </svg>
                  {REL[r].label} <span className="font-mono font-semibold text-ink">{counts[r]}</span>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
