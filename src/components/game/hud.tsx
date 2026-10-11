import { Award, Flame, Info, KeyRound, Lock, Mountain, Repeat, Route, Sparkles, Star, Trophy } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/components/ui";
import { XP_RULES, type Achievement, type GameState, type RankInfo, type Streak } from "./derive";

// Game HUD pieces. Server-renderable: every number is in the HTML at first paint (no flash before
// hydration), motion is CSS (count-up via @property, bar-grow, flicker, shimmer) and collapses to the
// final frame under reduced motion. Numbers are always text, never color or length alone.

const v = (o: Record<string, string | number>) => o as CSSProperties;

/** An integer that counts up from 0 in CSS. The real number is also in the text for assistive tech. */
export function Count({ value, className, delay = 0 }: { value: number; className?: string; delay?: number }) {
  const n = Math.max(0, Math.round(value));
  return (
    <span className={cx("tabular", className)}>
      <span className="count-up" aria-hidden style={v({ "--to": n, animationDelay: `${delay}ms`, animationDuration: n > 999 ? "1.4s" : "1s" })} />
      <span className="sr-only">{n}</span>
    </span>
  );
}

/** Rank badge: the rank number inside a violet progress ring with a slow orbit (ambient). */
export function RankRing({ rank, size = 84, label = true }: { rank: RankInfo; size?: number; label?: boolean }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const off = c * (1 - rank.progress);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Rank ${rank.n}, ${rank.title}${rank.next ? `, ${Math.round(rank.progress * 100)}% of the way to rank ${rank.n + 1}` : ""}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-mastery-soft)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-mastery)" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} className="ring-fill" style={v({ "--from": c })} />
        <circle cx="50" cy="50" r="48.5" fill="none" stroke="var(--color-mastery)" strokeOpacity="0.35" strokeWidth="1" className="orbit-dash" />
      </svg>
      <div className="absolute inset-[15%] grid place-items-center rounded-full bg-[var(--color-mastery)] text-white shadow-[inset_0_2px_0_rgb(255_255_255/0.25),0_6px_16px_-6px_var(--color-mastery)]">
        <div className="text-center leading-none">
          {label && <div className="text-[9.5px] font-bold uppercase tracking-[0.08em] opacity-85">Rank</div>}
          <div className="font-display font-black" style={{ fontSize: size * 0.34 }}>
            {rank.n}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Segmented XP bar (one segment per 10%), lime fill with a shimmer, spring growth from `from`. */
export function XpBar({ rank, xp, className, dark = false, from = 0 }: { rank: RankInfo; xp: number; className?: string; dark?: boolean; from?: number }) {
  const pct = Math.round(rank.progress * 100);
  const toGo = rank.next ? rank.next - xp : 0;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={cx("whitespace-nowrap font-mono text-[13px] font-semibold", dark ? "text-white" : "text-ink")}>
          <Count value={xp} /> XP
        </span>
        <span className={cx("text-right text-[12.5px] font-medium", dark ? "text-white/80" : "text-ink-3")}>{rank.next ? `${toGo} XP to ${rank.nextTitle}` : "Top rank"}</span>
      </div>
      <div
        role="meter"
        aria-label="XP toward the next rank"
        aria-valuemin={rank.floor}
        aria-valuemax={rank.next ?? xp}
        aria-valuenow={xp}
        className={cx("relative mt-1.5 h-4 overflow-hidden rounded-full p-[3px]", dark ? "bg-white/15" : "bg-ink/90")}
      >
        <div className="shimmer bar-grow h-full rounded-full bg-[var(--color-xp)]" style={v({ width: `${Math.max(4, pct)}%`, "--from": from })} />
        <div className="pointer-events-none absolute inset-[3px] flex justify-between" aria-hidden>
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="h-full w-[2px] bg-ink/90" style={{ marginLeft: i === 0 ? "10%" : 0 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FlameIcon({ className = "", lit = true }: { className?: string; lit?: boolean }) {
  return (
    <svg viewBox="0 0 32 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="flame-g" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={lit ? "#ff4d1f" : "#b9bdd6"} />
          <stop offset="1" stopColor={lit ? "#ffc23d" : "#dfe1f0"} />
        </linearGradient>
      </defs>
      <path d="M16 1c2 7 9 10 9 20a9 9 0 0 1-18 0c0-5 3-7 4-11 1 3 2 4 4 5 0-6-1-9 1-14Z" fill="url(#flame-g)" />
      <path d="M16 22c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-5 0 2 1 2 2 3 0-2-1-4 0-6Z" fill={lit ? "#fff3c4" : "#f1f2f8"} />
    </svg>
  );
}

/** Streak: a flickering flame, the day count, and the last seven days (grace days marked). */
export function StreakPanel({ streak, compact = false }: { streak: Streak; compact?: boolean }) {
  const alive = streak.days > 0;
  return (
    <div>
      <div className="flex items-end gap-3">
        <FlameIcon className={cx(compact ? "h-10 w-8" : "h-16 w-12", alive && "flicker")} lit={alive} />
        <div>
          <div className={cx("font-display font-black leading-[0.85] tracking-[-0.04em]", compact ? "text-[34px]" : "text-[64px]")}>
            <Count value={streak.days} />
          </div>
          <div className="mt-1 text-[13.5px] font-bold">{streak.days === 1 ? "day streak" : "day streak"}</div>
        </div>
      </div>
      <ol className="mt-4 grid grid-cols-7 gap-1.5" aria-label="The last seven days">
        {streak.week.map((d, i) => (
          <li key={d.date} className="text-center">
            <div className="text-[11px] font-bold opacity-80">{d.label}</div>
            <div
              className={cx(
                "pop-spring mx-auto mt-1 grid h-8 w-full max-w-9 place-items-center rounded-lg text-[11px] font-bold",
                d.done ? "bg-ink text-[var(--color-flame-2)]" : d.grace ? "border-2 border-dashed border-ink/50 text-ink" : "bg-white/45 text-ink/60",
                d.isToday && !d.done && "ring-2 ring-ink ring-offset-1 ring-offset-transparent",
              )}
              style={v({ "--i": i })}
              title={d.done ? `${d.date}: visit finished` : d.grace ? `${d.date}: grace day (one missed day is bridged per week of streak)` : d.date}
            >
              {d.done ? <Flame className="h-3.5 w-3.5" aria-hidden /> : d.grace ? "G" : ""}
              <span className="sr-only">{d.done ? "practised" : d.grace ? "grace day" : d.isToday ? "today, not yet" : "no visit"}</span>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[13px] font-semibold">
        {!alive ? "A visit today starts a new run." : streak.today ? "Today is in. Nice work." : `A visit today makes it ${streak.days + 1}.`}
        {streak.best > 1 && <span className="font-medium opacity-80"> Longest run: {streak.best} days.</span>}
      </p>
    </div>
  );
}

/** Mastery radar from the Elo skill profile (0-100 display scale). Values are labelled; list fallback below 3 domains. */
export function MasteryRadar({ data, size = 260 }: { data: { key: string; label: string; value: number; n: number }[]; size?: number }) {
  if (data.length < 3) {
    return (
      <ul className="space-y-2">
        {data.map((d) => (
          <li key={d.key}>
            <div className="flex justify-between text-[13px] font-semibold text-ink">
              <span>{d.label}</span>
              <span className="font-mono">{d.value}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-[var(--color-mastery-soft)]">
              <div className="bar-grow h-full rounded-full bg-[var(--color-mastery)]" style={{ width: `${d.value}%` }} />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  const cx0 = 50;
  const cy0 = 50;
  const R = 34;
  const pt = (i: number, f: number) => {
    const a = -Math.PI / 2 + (i / data.length) * Math.PI * 2;
    return [cx0 + Math.cos(a) * R * f, cy0 + Math.sin(a) * R * f] as const;
  };
  const poly = data.map((d, i) => pt(i, Math.max(0.04, d.value / 100)).map((n) => n.toFixed(2)).join(",")).join(" ");
  const weakest = [...data].sort((a, b) => a.value - b.value)[0];
  return (
    <figure>
      <svg viewBox="0 0 100 100" style={{ maxWidth: size }} className="mx-auto w-full overflow-visible" role="img" aria-label={`Mastery by skill: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={data.map((_, i) => pt(i, f).map((n) => n.toFixed(2)).join(",")).join(" ")} fill={f === 1 ? "var(--color-mastery-soft)" : "none"} stroke="var(--color-mastery)" strokeOpacity={0.18} strokeWidth={0.5} />
        ))}
        {data.map((_, i) => {
          const [x, y] = pt(i, 1);
          return <line key={i} x1={cx0} y1={cy0} x2={x} y2={y} stroke="var(--color-mastery)" strokeOpacity={0.15} strokeWidth={0.5} />;
        })}
        <g className="pop-spring" style={{ transformOrigin: "50px 50px" }}>
          <polygon points={poly} fill="var(--color-mastery)" fillOpacity={0.28} stroke="var(--color-mastery)" strokeWidth={1.4} strokeLinejoin="round" />
          {data.map((d, i) => {
            const [x, y] = pt(i, Math.max(0.04, d.value / 100));
            return <circle key={d.key} cx={x} cy={y} r={d.key === weakest.key ? 2.6 : 1.9} fill={d.key === weakest.key ? "var(--color-tier-hidden)" : "var(--color-xp)"} stroke="var(--color-ink)" strokeWidth={0.6} />;
          })}
        </g>
        {data.map((d, i) => {
          const [x, y] = pt(i, 1.32);
          return (
            <text key={d.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="4.6" fontWeight={700} fill="var(--color-ink-2)">
              {d.label}
              <tspan x={x} dy="5.2" fontFamily="var(--font-mono)" fontSize="4.6" fill="var(--color-ink)">
                {d.value}
              </tspan>
            </text>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex items-center justify-center gap-2 text-[12.5px] text-ink-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-tier-hidden)] ring-1 ring-ink" aria-hidden />
        Focus next: <span className="font-bold text-ink">{weakest.label}</span>
      </figcaption>
    </figure>
  );
}

const ICONS = { spark: Sparkles, five: Award, ten: Trophy, flame: Flame, blaze: Flame, star: Star, key: KeyRound, mountain: Mountain, route: Route, repeat: Repeat };
const TONE: Record<Achievement["tone"], string> = {
  xp: "bg-[var(--color-xp)] text-ink",
  flame: "bg-gradient-to-b from-[var(--color-flame-2)] to-[var(--color-flame)] text-ink",
  mastery: "bg-[var(--color-mastery)] text-white",
  tier: "bg-[var(--color-tier-initial)] text-white",
};

export function AchievementBadge({ a, i = 0, size = "md" }: { a: Achievement; i?: number; size?: "md" | "sm" }) {
  const Icon = a.got ? ICONS[a.icon] : Lock;
  return (
    <li className={cx("pop-spring flex items-center gap-3", !a.got && "opacity-70")} style={v({ "--i": i })}>
      <span className={cx("relative grid shrink-0 place-items-center rounded-2xl", size === "md" ? "h-12 w-12" : "h-10 w-10", a.got ? cx(TONE[a.tone], "clay shimmer") : "bg-slate-200 text-slate-500")} style={v({ "--sd": `${i * 0.7}s` })}>
        <Icon className={size === "md" ? "h-6 w-6" : "h-5 w-5"} strokeWidth={2.2} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-bold leading-tight text-ink">{a.title}</span>
        <span className="block text-[12.5px] leading-snug text-ink-3">{a.got ? "Unlocked" : a.detail}</span>
      </span>
    </li>
  );
}

/** "How XP works": the honesty disclosure next to every XP number. */
export function XpRules({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <details className={cx("group text-[12.5px]", className)}>
      <summary className={cx("inline-flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-full px-2.5 font-semibold pointer-coarse:min-h-11", dark ? "text-white/85 hover:bg-white/10" : "text-ink-2 hover:bg-brand-50")}>
        <Info className="h-3.5 w-3.5" aria-hidden />
        How XP works
      </summary>
      <div className={cx("pop-in mt-2 rounded-2xl p-3", dark ? "bg-white/10 text-white" : "bg-surface text-ink shadow-e2 ring-1 ring-line")}>
        <ul className="space-y-1">
          {XP_RULES.map(([k, val]) => (
            <li key={k} className="flex justify-between gap-4">
              <span>{k}</span>
              <span className="font-mono font-semibold">{val}</span>
            </li>
          ))}
        </ul>
        <p className={cx("mt-2 leading-relaxed", dark ? "text-white/75" : "text-ink-3")}>XP counts practice, not marks: it never includes or changes a score. Mastery comes from your rubric results. Private practice counts only for you.</p>
      </div>
    </details>
  );
}

/** Quest pips: one per patient (or step), filled when done. */
export function QuestPips({ done, total, dark = false }: { done: number; total: number; dark?: boolean }) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label={`${done} of ${total} done`}>
      {Array.from({ length: total }, (_, i) => (
        <li
          key={i}
          className={cx("pop-spring grid h-9 w-9 place-items-center rounded-xl font-display text-[15px] font-black", i < done ? "bg-[var(--color-xp)] text-ink clay" : dark ? "border-2 border-white/40 text-white/80" : "border-2 border-ink/25 text-ink-3")}
          style={v({ "--i": i })}
        >
          {i + 1}
        </li>
      ))}
    </ol>
  );
}

/** The compact game strip for the app shell (students). */
export function ShellHud({ game }: { game: GameState }) {
  return (
    <div className="game-layer flex items-center gap-3 rounded-2xl bg-surface/80 p-2.5 shadow-e1 ring-1 ring-line backdrop-blur">
      <RankRing rank={game.rank} size={46} label={false} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-bold text-ink">{game.rank.title}</div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="shimmer bar-grow h-full rounded-full bg-[var(--color-xp)]" style={{ width: `${Math.max(4, Math.round(game.rank.progress * 100))}%` }} />
        </div>
        <div className="mt-1 font-mono text-[11.5px] text-ink-3">{game.xp} XP</div>
      </div>
      <div className="flex flex-col items-center" title={`${game.streak.days}-day streak`}>
        <FlameIcon className={cx("h-7 w-6", game.streak.days > 0 && "flicker")} lit={game.streak.days > 0} />
        <span className="font-display text-[15px] font-black leading-none text-ink">{game.streak.days}</span>
        <span className="sr-only">day streak</span>
      </div>
    </div>
  );
}

export function GameCell({ tone, children, className, i = 0 }: { tone: "brand" | "xp" | "flame" | "mastery" | "ink"; children: ReactNode; className?: string; i?: number }) {
  const t = {
    brand: "bg-brand-600 text-white",
    xp: "bg-[var(--color-xp)] text-ink",
    flame: "bg-gradient-to-br from-[var(--color-flame-2)] to-[var(--color-flame)] text-ink",
    mastery: "bg-[var(--color-mastery)] text-white",
    ink: "bg-ink text-white",
  }[tone];
  return (
    <section className={cx("rise relative overflow-hidden rounded-[26px] p-5 clay sm:p-6", t, className)} style={v({ "--i": i })}>
      {children}
    </section>
  );
}

export { FlameIcon };
