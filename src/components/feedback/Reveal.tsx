import { Lock, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import type { Achievement, RankInfo, VisitXp } from "@/components/game/derive";
import { AchievementBadge, Count, RankRing, XpRules } from "@/components/game/hud";
import { cx } from "@/components/ui";
import type { Feedback } from "@/lib/types";

// The results reveal: the XP this visit earned (never including the score), the rank bar moving from
// where it stood before the visit to where it stands now, a burst only if a rank was actually crossed,
// and the badges this visit unlocked. All server-rendered final values; motion is CSS.

const v = (o: Record<string, string | number>) => o as CSSProperties;
const BURST = ["var(--color-xp)", "var(--color-flame-2)", "var(--color-mastery)", "var(--color-tier-hidden)", "var(--color-tier-initial)", "var(--color-tier-discoverable)"];

export function Burst({ delay = 500 }: { delay?: number }) {
  return (
    <span className="burst" aria-hidden>
      {Array.from({ length: 14 }, (_, i) => (
        <i key={i} style={v({ "--r": `${(i * 360) / 14}deg`, "--c": BURST[i % BURST.length], "--dist": `${-50 - (i % 3) * 14}px`, "--delay": `${delay + (i % 4) * 30}ms` })} />
      ))}
    </span>
  );
}

export function RewardReveal({ reward }: { reward: { visit: VisitXp; before: RankInfo; after: RankInfo; xpBefore: number; xpAfter: number; unlocked: Achievement[] } }) {
  const { visit, before, after, xpAfter, unlocked } = reward;
  const rankedUp = after.n > before.n;
  // The bar shows progress within the current rank; if the visit crossed a rank it grows from empty.
  const from = rankedUp ? 0 : before.progress / Math.max(0.0001, after.progress);
  return (
    <div className="game-layer relative overflow-hidden rounded-[26px] bg-ink p-5 text-white clay sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-60 spin-slow [background:conic-gradient(from_0deg,transparent,oklch(0.86_0.2_128/0.35),transparent_35%,oklch(0.6_0.22_293/0.35),transparent_70%)]" aria-hidden />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12.5px] font-bold text-[var(--color-xp)]">Visit complete</p>
          <p className="relative mt-0.5 font-display text-[48px] font-black leading-none tracking-[-0.04em]">
            +<Count value={visit.xp} delay={250} /> <span className="text-[22px]">XP</span>
            <Burst delay={900} />
          </p>
        </div>
        <XpRules dark />
      </div>
      <ul className="relative mt-3 flex flex-wrap gap-1.5">
        {visit.parts.map(([k, n], i) => (
          <li key={k} className="pop-spring rounded-full bg-white/12 px-2.5 py-1 text-[12.5px] font-semibold ring-1 ring-white/15" style={v({ "--i": i + 3 })}>
            {k} <span className="font-mono font-bold text-[var(--color-xp)]">+{n}</span>
          </li>
        ))}
      </ul>
      <div className="relative mt-5 flex items-center gap-4">
        <RankRing rank={after} size={70} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-display text-[19px] font-extrabold">
              {rankedUp ? (
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-[var(--color-xp)]" aria-hidden />
                  Rank up: {after.title}
                </span>
              ) : (
                after.title
              )}
            </span>
            <span className="font-mono text-[12.5px] text-white/80">
              {xpAfter} XP{after.next ? ` · ${after.next - xpAfter} to ${after.nextTitle}` : ""}
            </span>
          </div>
          <div className="mt-1.5 h-3.5 overflow-hidden rounded-full bg-white/15 p-[3px]" role="meter" aria-label="Progress to the next rank" aria-valuemin={after.floor} aria-valuemax={after.next ?? xpAfter} aria-valuenow={xpAfter}>
            <div className="shimmer bar-grow h-full rounded-full bg-[var(--color-xp)]" style={v({ width: `${Math.max(4, Math.round(after.progress * 100))}%`, "--from": from, "--delay": "700ms" })} />
          </div>
        </div>
      </div>
      {unlocked.length > 0 && (
        <div className="relative mt-5 rounded-2xl bg-white p-3.5 text-ink">
          <p className="mb-2 text-[12.5px] font-bold text-[var(--color-mastery-ink)]">Unlocked by this visit</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {unlocked.map((a, i) => (
              <AchievementBadge key={a.id} a={a} i={i + 6} size="sm" />
            ))}
          </ul>
        </div>
      )}
      {visit.held && <p className="relative mt-3 text-[12.5px] text-white/75">Your score is held by your instructor; XP never includes it.</p>}
    </div>
  );
}

/** Elicited versus missed as a collection board: collected cards face up, the rest still to find. */
export function CollectionBoard({ f, prevElicited, deflected, hasPrev }: { f: Feedback; prevElicited: Set<string>; deflected: Record<string, number>; hasPrev: boolean }) {
  const order = { critical: 0, important: 1, minor: 2 } as const;
  const tone = {
    critical: { card: "bg-[var(--color-tier-hidden-soft)] ring-[var(--color-tier-hidden)]", chip: "bg-[var(--color-tier-hidden)] text-white" },
    important: { card: "bg-[var(--color-tier-reluctant-soft)] ring-[var(--color-tier-reluctant)]", chip: "bg-[var(--color-tier-reluctant)] text-ink" },
    minor: { card: "bg-[var(--color-tier-initial-soft)] ring-[var(--color-tier-initial)]", chip: "bg-[var(--color-tier-initial)] text-white" },
  } as const;
  const got = [...f.elicited].sort((a, b) => order[a.importance] - order[b.importance]);
  const miss = [...f.missed].sort((a, b) => order[a.importance] - order[b.importance]);
  const total = got.length + miss.length;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-[44px] font-black leading-none tracking-[-0.04em] text-ink">
            <Count value={got.length} />
            <span className="text-[22px] text-ink-3"> / {total}</span>
          </p>
          <p className="mt-1 text-[13px] font-semibold text-ink-2">findings collected</p>
        </div>
        <div className="h-3 min-w-48 flex-1 overflow-hidden rounded-full bg-surface-2" role="meter" aria-label="Findings collected" aria-valuemin={0} aria-valuemax={total} aria-valuenow={got.length}>
          <div className="bar-grow h-full rounded-full bg-[var(--color-xp)]" style={{ width: `${total ? (got.length / total) * 100 : 0}%` }} />
        </div>
      </div>
      <p className="mt-2 text-[12.5px] text-ink-3">From the disclosure record, not from a model&apos;s impression. Color shows importance: critical, important, minor.</p>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <section aria-label={`Findings you elicited (${got.length})`}>
          <h3 className="mb-2 font-display text-[16px] font-extrabold text-ink">Findings you elicited ({got.length})</h3>
          {got.length === 0 && <p className="text-[13.5px] text-ink-3">None.</p>}
          <ul className="grid gap-2 sm:grid-cols-2">
            {got.map((e, i) => (
              <li key={e.id} data-fact-turn={e.turn} className={cx("collect-card rise relative rounded-2xl p-3 text-[13px] leading-snug ring-1 ring-inset", tone[e.importance].card)} style={v({ "--i": Math.min(i, 10) })}>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className={cx("rounded-full px-1.5 py-0.5 text-[10.5px] font-bold capitalize", tone[e.importance].chip)}>{e.importance}</span>
                  <a href={`#t${e.turn}`} className="rounded bg-ink px-1 font-mono text-[11px] font-semibold text-white hover:bg-brand-700">
                    T{e.turn}
                  </a>
                  {hasPrev && !prevElicited.has(e.id) && <span className="ml-auto rounded-full bg-[var(--color-xp)] px-1.5 text-[10.5px] font-bold text-ink">new</span>}
                </div>
                <span className="text-ink">{e.chart}</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-label={`Findings you missed (${miss.length})`}>
          <h3 className="mb-2 font-display text-[16px] font-extrabold text-ink">Findings you missed ({miss.length})</h3>
          <p className="-mt-1 mb-2 text-[12.5px] text-ink-3">Most important first.</p>
          {miss.length === 0 && <p className="text-[13.5px] text-ink-3">Nothing missed.</p>}
          <ul className="grid gap-2 sm:grid-cols-2">
            {miss.map((m, i) => (
              <li key={m.id} className="rise rounded-2xl border-2 border-dashed border-line-strong/50 bg-surface p-3 text-[13px] leading-snug" style={v({ "--i": Math.min(i, 10) })}>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-ink-3" aria-hidden />
                  <span className={cx("rounded-full px-1.5 py-0.5 text-[10.5px] font-bold capitalize", tone[m.importance].chip)}>{m.importance}</span>
                </div>
                <span className="text-ink">
                  <span className="font-bold">{m.topic}:</span> {m.chart}
                </span>
                {deflected[m.id] ? <span className="mt-1 block text-[12px] font-semibold text-[var(--color-tier-reluctant-ink)]">(you asked; the patient was not ready to say)</span> : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
