import { ArrowRight, ChevronRight, Gauge, Hash, Layers, ListChecks, Scale, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import AppShell from "@/components/AppShell";
import { SkillDots } from "@/components/courses/charts";
import RatingHistory, { type HistorySeries } from "@/components/courses/RatingHistory";
import When from "@/components/courses/When";
import { deriveGame, RANKS, rankFor } from "@/components/game/derive";
import { Count, GameCell, RankRing, XpRules, FlameIcon } from "@/components/game/hud";
import AchievementGallery, { type GalleryItem } from "@/components/history/AchievementGallery";
import ScoreTrend, { type ScorePoint } from "@/components/history/ScoreTrend";
import StoryReel, { type Story } from "@/components/history/StoryReel";
import StreakCalendar, { type CalDay } from "@/components/history/StreakCalendar";
import XpClimb, { RankPath, type ClimbPoint } from "@/components/history/XpClimb";
import { Badge, Card, cx, Empty, LinkButton } from "@/components/ui";
import { skillProfile } from "@/lib/adaptive";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { feedbackUrl, heldAssignmentIds, studentCaseLabels, toDate } from "@/lib/courses";
import { LEVEL_NAMES, LEVEL_RATING } from "@/lib/engine/difficulty";
import { attemptHistory } from "@/lib/engine/feedback";
import { profession, professions } from "@/lib/professions";
import { getRubric } from "@/lib/rubrics";

const START = 1200;
const LO = 900;
const HI = 1700;
const MODE_LABEL: Record<string, string> = { practice: "Practice", adaptive: "Adaptive", homework: "Homework", exam: "Exam", journey: "Care journey" };
const v = (o: Record<string, string | number>) => o as CSSProperties;

// Calendar days in the product timezone, the same rule derive.ts uses for streaks (US Eastern).
const fmtEastern = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
const easternDay = (s: string) => {
  const d = toDate(s);
  return isNaN(d.getTime()) ? s.slice(0, 10) : fmtEastern.format(d);
};
const addDays = (d: string, n: number) => {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const CAL_WEEKS = 12;

/** Difficulty as a rising staircase of five steps; the chosen ones lit. */
function LevelSteps({ level }: { level: number }) {
  return (
    <div className="flex items-end gap-1" role="img" aria-label={`Level ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((l) => (
        <span key={l} className={cx("bar-grow w-2.5 rounded-[4px]", l <= level ? "bg-[var(--color-mastery)]" : "bg-[var(--color-mastery-soft)] ring-1 ring-inset ring-[var(--color-mastery)]/25")} style={v({ height: `${8 + l * 5}px`, "--delay": `${200 + l * 60}ms` })} />
      ))}
    </div>
  );
}

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ profession?: string }> }) {
  const user = await requireUser();
  const asked = (await searchParams).profession;
  // Ratings are kept per role, so a student who practised in another role can switch.
  const rated = all<{ profession_id: string }>("SELECT DISTINCT profession_id FROM skill_ratings WHERE user_id = ?", user.id).map((r) => r.profession_id);
  const own = profession(user.profession_id).id;
  const professionId = asked && (rated.includes(asked) || professions().some((p) => p.id === asked)) ? asked : own;
  const role = profession(professionId);
  const roleTabs = [...new Set([own, ...rated])];

  const profile = skillProfile(user.id, professionId);
  const names = new Map((getRubric("default").domains || []).map((d) => [d.key, d.name]));
  const nameOf = (k: string) => names.get(k) || k.replace(/_/g, " ");
  const order = [...names.keys()];
  const dots = profile.domains
    .map((d) => ({ key: d.domain, name: nameOf(d.domain), rating: d.rating, n: d.n }))
    .sort((a, b) => (order.indexOf(a.key) === -1 ? 99 : order.indexOf(a.key)) - (order.indexOf(b.key) === -1 ? 99 : order.indexOf(b.key)));
  const ticks = [1, 2, 3, 4, 5].map((level) => ({ level, rating: LEVEL_RATING[level] }));

  // ----- Rating history from the event log -----
  const events = all<{ encounter_id: string; domain: string; level: number; outcome: number; before: number; after: number; created_at: string; case_id: string | null }>(
    `SELECT s.encounter_id, s.domain, s.level, s.outcome, s.before, s.after, s.created_at, e.case_id
     FROM skill_events s LEFT JOIN encounters e ON e.id = s.encounter_id
     WHERE s.user_id = ? AND s.profession_id = ? ORDER BY s.id`,
    user.id,
    professionId,
  );
  // Students never see the faculty case title; it usually names the diagnosis.
  const labels = studentCaseLabels([...events.map((e) => e.case_id || ""), ...all<{ case_id: string }>("SELECT DISTINCT case_id FROM encounters WHERE user_id = ?", user.id).map((r) => r.case_id)]);
  const visits: { id: string; level: number; date: string; title: string; after: Map<string, number> }[] = [];
  for (const ev of events) {
    let v = visits[visits.length - 1];
    if (!v || v.id !== ev.encounter_id) visits.push((v = { id: ev.encounter_id, level: ev.level, date: ev.created_at, title: labels.get(ev.case_id || "") || "Visit", after: new Map() }));
    v.after.set(ev.domain, ev.after);
  }
  const day = (s: string) => toDate(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const series: HistorySeries[] = [];
  if (visits.length) {
    const current = new Map<string, number>();
    const overall: HistorySeries = { key: "__all", name: "All domains (average)", points: [{ label: "Start", value: START, lines: ["Everyone starts at 1200"] }] };
    const perDomain = new Map<string, HistorySeries>();
    visits.forEach((v, i) => {
      for (const [d, r] of v.after) {
        current.set(d, r);
        if (!perDomain.has(d)) perDomain.set(d, { key: d, name: nameOf(d), points: [{ label: "Start", value: START, lines: ["Everyone starts at 1200"] }] });
        perDomain.get(d)!.points.push({ label: `Visit ${i + 1}`, value: r, lines: [v.title, `Level ${v.level} · ${day(v.date)}`] });
      }
      const avg = [...current.values()].reduce((s, x) => s + x, 0) / current.size;
      overall.points.push({ label: `Visit ${i + 1}`, value: avg, lines: [v.title, `Level ${v.level} · ${day(v.date)}`] });
    });
    series.push(overall, ...[...perDomain.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)));
  }

  // ----- Attempts per patient -----
  const held = heldAssignmentIds();
  const mine = all<{ id: string; case_id: string; assignment_id: string | null; faculty_score: number | null }>(
    "SELECT e.id, e.case_id, e.assignment_id, e.faculty_score FROM encounters e WHERE e.user_id = ? AND e.status = 'scored' AND e.parent_id IS NULL ORDER BY e.started_at DESC",
    user.id,
  );
  const meta = new Map(mine.map((m) => [m.id, m]));
  const caseIds = [...new Set(mine.map((m) => m.case_id))];
  const perCase = caseIds
    .map((caseId) => {
      // Visits whose feedback an instructor is still holding are left out until it is released.
      const attempts = attemptHistory(user.id, caseId)
        .filter((a) => !held.has(meta.get(a.id)?.assignment_id || ""))
        .map((a) => ({ ...a, percent: meta.get(a.id)?.faculty_score ?? a.percent }));
      return { caseId, title: labels.get(caseId) || "Patient", attempts };
    })
    .filter((c) => c.attempts.length);
  const heldCount = mine.filter((m) => m.assignment_id && held.has(m.assignment_id)).length;
  const weakest = profile.weakest ? nameOf(profile.weakest) : null;

  // ----- The game story (derive.ts: XP never includes a score; held visits count only as finished) -----
  const game = deriveGame(user.id, professionId);
  const logRows = game.log.length
    ? all<{ id: string; case_id: string; status: string }>(`SELECT id, case_id, status FROM encounters WHERE id IN (${game.log.map(() => "?").join(",")})`, ...game.log.map((l) => l.id))
    : [];
  const logMeta = new Map(logRows.map((r) => [r.id, r]));
  const cums = game.log.reduce<number[]>((acc, l) => [...acc, (acc[acc.length - 1] || 0) + l.xp], []);
  const climb: ClimbPoint[] = game.log.map((l, i) => {
    const cum = cums[i];
    const before = rankFor(cum - l.xp);
    const after = rankFor(cum);
    const r = logMeta.get(l.id);
    return {
      id: l.id,
      label: labels.get(r?.case_id || "") || "Visit",
      date: l.at,
      xp: l.xp,
      cum,
      parts: l.parts,
      rank: after.n,
      rankTitle: after.title,
      rankUp: after.n > before.n,
      held: l.held,
      privatePractice: l.privatePractice,
      href: r?.status === "scored" && !l.held ? feedbackUrl(l.id) : null,
    };
  });
  const rankUps = climb.filter((c) => c.rankUp).length;

  // Streak calendar: the last CAL_WEEKS weeks, Sunday-first columns, ending with this week.
  const today = fmtEastern.format(new Date());
  const perDay = new Map<string, number>();
  for (const l of game.log) perDay.set(easternDay(l.at), (perDay.get(easternDay(l.at)) || 0) + 1);
  const gridStart = addDays(today, -new Date(today + "T00:00:00Z").getUTCDay() - (CAL_WEEKS - 1) * 7);
  const cal: CalDay[] = Array.from({ length: CAL_WEEKS * 7 }, (_, i) => {
    const date = addDays(gridStart, i);
    return { date, count: perDay.get(date) || 0, grace: game.streak.grace.includes(date), isToday: date === today, future: date > today };
  });
  const activeDays = cal.filter((d) => d.count > 0).length;

  // Score trend: released results only (perCase already drops held ones), oldest first.
  const trend: ScorePoint[] = perCase
    .flatMap((c) => c.attempts.map((a) => ({ id: a.id, label: c.title, date: a.date, score: a.percent, level: a.level, mode: MODE_LABEL[a.mode] || a.mode, href: feedbackUrl(a.id) })))
    .sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());
  const bestTrend = trend.reduce<ScorePoint | null>((b, p) => (!b || p.score > b.score ? p : b), null);

  // Achievements with the rule that unlocks each, and progress for the counted ones.
  const counts: Record<string, { have: number; need: number; unit: string }> = {
    first: { have: Math.min(1, game.visits), need: 1, unit: "visit" },
    five: { have: Math.min(5, game.visits), need: 5, unit: "visits" },
    ten: { have: Math.min(10, game.visits), need: 10, unit: "visits" },
    streak3: { have: Math.min(3, game.streak.best), need: 3, unit: "days" },
    streak7: { have: Math.min(7, game.streak.best), need: 7, unit: "days" },
  };
  const gallery: GalleryItem[] = [...game.achievements.filter((a) => a.got), ...game.achievements.filter((a) => !a.got)].map((a) => ({ ...a, progress: counts[a.id] }));
  const unlocked = game.achievements.filter((a) => a.got).length;

  // Most improved domain since the 1200 start, for the story reel.
  const improved = series
    .filter((s) => s.key !== "__all")
    .map((s) => ({ name: s.name, short: s.name.split(/[,(]| and /)[0], gain: Math.round(s.points[s.points.length - 1].value - START), n: s.points.length - 1 }))
    .sort((a, b) => b.gain - a.gain)[0];
  const stories: Story[] = [
    {
      id: "visits",
      kicker: "Visits finished, every role",
      big: String(game.visits),
      unit: game.visits === 1 ? "visit" : "visits",
      line: game.visits ? `${game.xp} XP earned in total, ${game.weekXp} of it in the last seven days.` : "Your story starts with your first finished visit.",
      tone: "ink",
      bars: game.log.map((l) => l.xp),
      barsLabel: "XP from each visit, oldest to newest",
    },
    {
      id: "rank",
      kicker: `Rank ${game.rank.n} of ${RANKS.length}`,
      big: game.rank.title,
      line: game.rank.next ? `${game.rank.next - game.xp} XP to ${game.rank.nextTitle}.${rankUps ? ` You have ranked up ${rankUps} time${rankUps === 1 ? "" : "s"}.` : ""}` : "Top rank reached.",
      tone: "mastery",
      bars: climb.map((c) => c.cum),
      barsLabel: "Total XP after each visit",
    },
    { id: "streak", kicker: "Longest streak", big: String(game.streak.best), unit: game.streak.best === 1 ? "day" : "days", line: game.streak.days ? `You are on a ${game.streak.days}-day run right now, across ${activeDays} active days in ${CAL_WEEKS} weeks.` : "A visit today starts a new run.", tone: "flame", bars: cal.filter((d) => !d.future).slice(-21).map((d) => d.count), barsLabel: "Visits per day, last three weeks" },
  ];
  if (improved && improved.gain > 0) stories.push({ id: "improved", kicker: "Most improved skill", big: `+${improved.gain}`, unit: "rating", line: `${improved.short}: up from 1200 across ${improved.n} scored visit${improved.n === 1 ? "" : "s"} as ${role.name}.`, tone: "brand" });
  if (bestTrend) stories.push({ id: "best", kicker: "Best released score", big: `${Math.round(bestTrend.score)}%`, line: `With ${bestTrend.label}. Only results your instructor has released count here.`, tone: "xp", bars: trend.map((t) => Math.round(t.score)), barsLabel: "Released scores, oldest to newest" });

  const hasRatings = profile.domains.length > 0;

  return (
    <AppShell user={user}>
      {/* ---------- Header: title, role switch, the main action ---------- */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="rise font-display text-[34px] font-black leading-[1] tracking-[-0.035em] text-ink sm:text-[46px]">Progress</h1>
          <p className="rise mt-2 max-w-2xl text-[15.5px] leading-relaxed text-ink-2" style={v({ "--i": 1 })}>
            Your skill ratings as <span className="font-bold text-ink">{role.name}</span>, your climb in XP and rank, and how each patient has gone across attempts.
          </p>
          {roleTabs.length > 1 && (
            <div className="rise mt-3 flex flex-wrap items-center gap-1.5 text-[12.5px]" style={v({ "--i": 2 })}>
              <span className="font-semibold text-ink-3">Ratings are kept per role:</span>
              <nav aria-label="Role" className="inline-flex flex-wrap gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-line">
                {roleTabs.map((p) => (
                  <Link
                    key={p}
                    href={`/student/progress?profession=${p}`}
                    aria-current={p === professionId ? "page" : undefined}
                    className={cx("press inline-flex min-h-8 items-center rounded-full px-3 font-bold transition-colors pointer-coarse:min-h-11", p === professionId ? "bg-ink text-white shadow-e2" : "text-ink-2 hover:bg-surface hover:text-ink")}
                  >
                    {profession(p).name}
                  </Link>
                ))}
              </nav>
            </div>
          )}
        </div>
        <LinkButton href="/student" size="lg" className="rise" style={v({ "--i": 2 })}>
          Start an adaptive visit
          <ArrowRight className="h-4 w-4" aria-hidden />
        </LinkButton>
      </div>

      {/* ---------- The climb (XP and rank over visits) + the story reel ---------- */}
      <div className="grid gap-4 lg:grid-cols-12">
        <GameCell tone="brand" className="game-layer lg:col-span-8" i={0}>
          <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2">
            <RankRing rank={game.rank} size={76} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-white/85">Your climb: XP after every finished visit</p>
              <p className="font-display text-[24px] font-black leading-[1.05] tracking-[-0.025em] sm:text-[28px]">
                <span className="whitespace-nowrap">
                  <Count value={game.xp} /> XP
                </span>
                <span className="hidden sm:inline"> · </span>
                <span className="block sm:inline">{game.rank.title}</span>
              </p>
            </div>
            <XpRules dark className="basis-full sm:basis-auto" />
          </div>
          {climb.length ? (
            <div className="mt-3">
              <XpClimb points={climb} ranks={RANKS} />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-white/12 p-5 text-center ring-1 ring-inset ring-white/20">
              <p className="font-display text-[19px] font-extrabold">Your climb starts with your first finished visit</p>
              <p className="mx-auto mt-1 max-w-sm text-[14px] text-white/85">Every visit adds XP for finishing it, its difficulty and the facts you uncover yourself. Never for a score.</p>
            </div>
          )}
          <RankPath ranks={RANKS} xp={game.xp} />
          <p className="mt-2 text-right text-[12.5px] font-semibold text-white/85">{game.rank.next ? `${game.rank.next - game.xp} XP to rank ${game.rank.n + 1}, ${game.rank.nextTitle}` : "Top rank"}</p>
        </GameCell>
        <div className="game-layer lg:col-span-4">
          <StoryReel stories={stories} />
        </div>
      </div>

      {/* ---------- Streak calendar + adaptive level ---------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <GameCell tone="flame" className="game-layer lg:col-span-5" i={4}>
          <div className="flex items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              <FlameIcon className={cx("h-14 w-11", game.streak.days > 0 && "flicker")} lit={game.streak.days > 0} />
              <div>
                <p className="font-display text-[56px] font-black leading-[0.85] tracking-[-0.04em]">
                  <Count value={game.streak.days} />
                </p>
                <p className="mt-1 text-[13.5px] font-bold">day streak</p>
              </div>
            </div>
            <dl className="text-right">
              <dt className="text-[12px] font-bold">Longest run</dt>
              <dd className="font-display text-[24px] font-black leading-none">{game.streak.best}</dd>
              <dt className="mt-1.5 text-[12px] font-bold">Active days</dt>
              <dd className="font-display text-[24px] font-black leading-none">{activeDays}</dd>
            </dl>
          </div>
          <h2 className="mt-4 font-display text-[16px] font-extrabold">The last {CAL_WEEKS} weeks</h2>
          <div className="mt-2">
            <StreakCalendar days={cal} />
          </div>
        </GameCell>

        <Card className="rise flex flex-col p-5 sm:p-6 lg:col-span-7" style={v({ "--i": 5 })}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--color-mastery-ink)]">
                <Gauge className="h-4 w-4" aria-hidden />
                Next adaptive level
              </p>
              <p className="mt-1 font-display text-[34px] font-black leading-none tracking-[-0.03em] text-ink">
                {profile.level} {LEVEL_NAMES[profile.level]}
              </p>
              <p className="mt-1.5 text-[13px] text-ink-3">{profile.sessions ? `Expected score about ${Math.round(profile.expectedAtLevel * 100)}%` : "Starting level for new students"}</p>
            </div>
            <LevelSteps level={profile.level} />
          </div>
          <dl className="mt-4 grid gap-2.5 sm:grid-cols-3">
            <div className="rounded-2xl bg-[var(--color-mastery-soft)] p-3">
              <dt className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-mastery-ink)]">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                Overall rating
              </dt>
              <dd className="font-display text-[26px] font-black leading-tight text-ink">{Math.round(profile.overall)}</dd>
              <dd className="text-[12px] text-ink-2">
                Level {profile.level} plays at {LEVEL_RATING[profile.level]}
              </dd>
            </div>
            <div className="rounded-2xl bg-[var(--color-tier-initial-soft)] p-3">
              <dt className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-tier-initial-ink)]">
                <Hash className="h-3.5 w-3.5" aria-hidden />
                Scored visits
              </dt>
              <dd className="font-display text-[26px] font-black leading-tight text-ink">{profile.sessions}</dd>
              <dd className="text-[12px] text-ink-2">In this role, counted toward your ratings</dd>
            </div>
            <div className="rounded-2xl bg-[var(--color-tier-hidden-soft)] p-3">
              <dt className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--color-tier-hidden-ink)]">
                <Target className="h-3.5 w-3.5" aria-hidden />
                Weakest domain
              </dt>
              <dd className="font-display text-[20px] font-black leading-tight text-ink">{weakest ? weakest.split(/[,(]| and /)[0] : "–"}</dd>
              <dd className="text-[12px] text-ink-2">{weakest || "Shown after your first scored visit"}</dd>
            </div>
          </dl>

          {/* How the level is chosen: three steps at a glance, the exact rule one click away. */}
          <ol className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              { Icon: Scale, t: "Score vs expected", d: "Each scored visit is compared with what your rating predicted at that level." },
              { Icon: TrendingUp, t: "Ratings move", d: "Better than expected moves a domain up, worse moves it down." },
              { Icon: Layers, t: "Next level near 70%", d: "Your next adaptive visit plays where you should score about 70%." },
            ].map(({ Icon, t, d }, i) => (
              <li key={t} className="rise flex gap-2.5 rounded-2xl bg-surface-2 p-3" style={v({ "--i": 6 + i })}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-600 font-display text-[14px] font-black text-white clay">{i + 1}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[13px] font-bold text-ink">
                    <Icon className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                    {t}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{d}</span>
                </span>
              </li>
            ))}
          </ol>
          <details className="group mt-3 rounded-2xl ring-1 ring-line open:bg-surface-2/60">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-3.5 text-[13.5px] font-bold text-brand-700">
              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-open:rotate-90" aria-hidden />
              How the adaptive level is chosen (no language model involved)
            </summary>
            <p className="pop-in max-w-3xl px-3.5 pb-3.5 text-[14px] leading-relaxed text-ink-2">
              After every scored visit, your rating in each rubric domain moves up if you scored better than expected for that visit&apos;s level and down if you scored worse, with bigger moves while you have few visits. Your next adaptive session is set at the level where your expected score is closest to 70%, and the patient&apos;s behaviour is tuned to exercise your weakest domain.
            </p>
          </details>
        </Card>
      </div>

      {/* ---------- Skill map: mastery radar linked to each domain's rating history ---------- */}
      {!hasRatings ? (
        <div className="rise mt-4" style={v({ "--i": 8 })}>
          <Empty icon={<TrendingUp className="h-6 w-6" aria-hidden />} title="Your skill map starts with your first scored visit">
            You have no scored visits as {role.name} yet. Finish a visit from{" "}
            <Link href="/student" className="font-medium text-brand-700 underline">
              Home
            </Link>{" "}
            or{" "}
            <Link href="/student/practice" className="font-medium text-brand-700 underline">
              Practice
            </Link>{" "}
            and your ratings will appear here.
          </Empty>
        </div>
      ) : (
        <Card className="rise mt-4 p-5 sm:p-6" style={v({ "--i": 8 })}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-[22px] font-black tracking-[-0.02em] text-ink">Skill map</h2>
              <p className="mt-0.5 max-w-2xl text-[13.5px] text-ink-3">Mastery in each rubric domain, and your rating after every scored visit against the rating each difficulty level plays at.</p>
            </div>
            <span className="rounded-full bg-[var(--color-mastery-soft)] px-2.5 py-1 text-[12px] font-bold text-[var(--color-mastery-ink)]">{dots.length} domains</span>
          </div>
          {series.length > 0 ? <RatingHistory series={series} ticks={ticks} lo={950} hi={1450} mastery={game.mastery} /> : <p className="text-sm text-ink-3">No history yet.</p>}
          <details className="group mt-5 rounded-2xl ring-1 ring-line open:bg-surface-2/40">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-3.5 text-[13.5px] font-bold text-brand-700">
              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-open:rotate-90" aria-hidden />
              Skill rating by rubric domain, against the level lines
            </summary>
            <div className="px-3.5 pb-4">
              <p className="mb-3 max-w-3xl text-[13px] text-ink-3">Each dot is your current rating. The vertical lines mark the rating each difficulty level plays at; a dot to the right of a line means you are expected to do well at that level.</p>
              <SkillDots items={dots} ticks={ticks} lo={LO} hi={HI} />
            </div>
          </details>
        </Card>
      )}

      {/* ---------- Score trend (released only) + achievements ---------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card className="rise p-5 sm:p-6 lg:col-span-5" style={v({ "--i": 9 })}>
          <h2 className="font-display text-[20px] font-black tracking-[-0.02em] text-ink">Score trend</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">Every released result, oldest to newest; feedback your instructor is holding is left out. Tap a bar to open it.</p>
          {trend.length ? (
            <>
              <dl className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ["Latest", `${Math.round(trend[trend.length - 1].score)}%`],
                  ["Best", `${Math.round(bestTrend!.score)}%`],
                  ["Results", String(trend.length)],
                ].map(([k, val]) => (
                  <div key={k} className="rounded-2xl bg-brand-50 p-2.5">
                    <dt className="text-[11.5px] font-bold text-brand-800">{k}</dt>
                    <dd className="font-display text-[22px] font-black leading-none text-ink">{val}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3">
                <ScoreTrend points={trend} />
              </div>
            </>
          ) : (
            <p className="mt-4 rounded-2xl bg-surface-2 p-4 text-[14px] text-ink-2">No released results yet. Your scores appear here once a visit is scored and its feedback is visible to you.</p>
          )}
        </Card>
        <Card className="rise p-5 sm:p-6 lg:col-span-7" style={v({ "--i": 10 })}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-[20px] font-black tracking-[-0.02em] text-ink">Achievements</h2>
              <p className="mt-0.5 text-[13px] text-ink-3">Earned from what you have actually done. Locked ones show what unlocks them.</p>
            </div>
            <span className="inline-flex items-baseline gap-0.5 rounded-full bg-ink px-3 py-1 font-display text-[18px] font-black text-white">
              {unlocked}
              <span className="text-[13px] text-white/75">/{game.achievements.length}</span>
            </span>
          </div>
          <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line" role="meter" aria-label="Achievements unlocked" aria-valuemin={0} aria-valuemax={game.achievements.length} aria-valuenow={unlocked}>
            <div className="shimmer bar-grow h-full rounded-full bg-[var(--color-mastery)]" style={{ width: `${Math.max(3, (unlocked / Math.max(1, game.achievements.length)) * 100)}%` }} />
          </div>
          <AchievementGallery items={gallery} />
        </Card>
      </div>

      {/* ---------- Attempts by patient: a visual track per patient, the full table one click away ---------- */}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-[24px] font-black tracking-[-0.025em] text-ink">Attempts by patient</h2>
        {perCase.length > 0 && <p className="text-[13px] text-ink-3">{perCase.length} patients · each attempt and what changed</p>}
      </div>
      {heldCount > 0 && <p className="mb-2 mt-1 text-xs text-ink-3">{heldCount} submitted visit{heldCount === 1 ? " is" : "s are"} not shown because your instructor has not released the feedback yet.</p>}
      {perCase.length === 0 ? (
        <div className="mt-3">
          <Empty icon={<ListChecks className="h-6 w-6" aria-hidden />}>Nothing scored yet. Each patient you practise with will appear here with every attempt and what changed between them.</Empty>
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          {perCase.map((c, ci) => {
            const scores = c.attempts.map((a) => a.percent);
            const best = Math.max(...scores);
            const change = scores.length > 1 ? Math.round(scores[scores.length - 1] - scores[0]) : null;
            const lastA = c.attempts[c.attempts.length - 1];
            const prevA = c.attempts.length > 1 ? c.attempts[c.attempts.length - 2] : null;
            const gainedLast = prevA ? lastA.elicitedIds.filter((id) => !prevA.elicitedIds.includes(id)).length : 0;
            return (
              <Card key={c.caseId} className="rise overflow-hidden" style={v({ "--i": Math.min(10, 11 + ci) })}>
                <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-3 pt-4">
                  <div className="min-w-0">
                    <h3 className="font-display text-[18px] font-extrabold leading-tight text-ink">{c.title}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
                      <span>
                        {c.attempts.length} attempt{c.attempts.length === 1 ? "" : "s"} · best {Math.round(best)}%
                      </span>
                      {change !== null && (
                        <span className={cx("rounded-full px-2 py-0.5 font-mono text-[12px] font-bold", change > 0 ? "bg-[var(--color-xp-soft)] text-[var(--color-xp-ink)]" : change < 0 ? "bg-[var(--color-tier-hidden-soft)] text-[var(--color-tier-hidden-ink)]" : "bg-surface-2 text-ink-2")}>
                          {change > 0 ? "up" : change < 0 ? "down" : "no change"}
                          {change ? ` ${Math.abs(change)} points` : ""} from first to latest
                        </span>
                      )}
                    </p>
                  </div>
                  {prevA && (
                    <ul className="flex flex-wrap gap-1.5 text-[12px] font-semibold" aria-label="Latest attempt at a glance">
                      <li className="rounded-full bg-[var(--color-tier-initial-soft)] px-2.5 py-1 text-[var(--color-tier-initial-ink)]">+{gainedLast} new findings</li>
                      <li className={cx("rounded-full px-2.5 py-1", lastA.missedCritical ? "bg-[var(--color-tier-hidden-soft)] text-[var(--color-tier-hidden-ink)]" : "bg-[var(--color-xp-soft)] text-[var(--color-xp-ink)]")}>{lastA.missedCritical ? `${lastA.missedCritical} critical missed` : "No critical missed"}</li>
                    </ul>
                  )}
                </div>

                {/* The attempt track: one score medallion per attempt, joined by the change between them. */}
                <ol className="scroll-quiet flex items-center gap-0 overflow-x-auto px-5 pb-4" aria-label={`Score by attempt, 0 to 100%: ${c.attempts.map((a, i) => `attempt ${i + 1} ${Math.round(a.percent)}%`).join(", ")}`}>
                  {c.attempts.map((a, i) => {
                    const d = i > 0 ? Math.round(a.percent - c.attempts[i - 1].percent) : null;
                    const pct = Math.max(0, Math.min(100, a.percent));
                    return (
                      <li key={a.id} className="flex shrink-0 items-center">
                        {d !== null && (
                          <span className="flex w-16 flex-col items-center sm:w-24" aria-hidden>
                            <span className={cx("font-mono text-[12px] font-bold", d > 0 ? "text-[var(--color-xp-ink)]" : d < 0 ? "text-[var(--color-tier-hidden-ink)]" : "text-ink-3")}>{d > 0 ? `+${d}` : d === 0 ? "±0" : `−${Math.abs(d)}`}</span>
                            <span className={cx("mt-0.5 h-1 w-full rounded-full", d > 0 ? "bg-[var(--color-xp)]" : d < 0 ? "bg-[var(--color-tier-hidden)]" : "bg-line")} />
                          </span>
                        )}
                        <Link href={feedbackUrl(a.id)} className="press lift group flex flex-col items-center rounded-2xl px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label={`Attempt ${i + 1}: ${Math.round(a.percent)}%, level ${a.level}. Open feedback`}>
                          <span className="relative grid h-14 w-14 place-items-center">
                            <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
                              <circle cx="18" cy="18" r="15.5" fill="white" stroke="var(--color-brand-100)" strokeWidth="4" />
                              <circle cx="18" cy="18" r="15.5" fill="none" stroke={i === c.attempts.length - 1 ? "var(--color-brand-600)" : "var(--color-brand-400)"} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 97.4} 97.4`} className="ring-fill" style={v({ "--from": 97.4 })} />
                            </svg>
                            <span className="relative font-display text-[15px] font-black text-ink">{Math.round(a.percent)}</span>
                          </span>
                          <span className="mt-1 text-[11.5px] font-bold text-ink-2">Attempt {i + 1}</span>
                          <span className="text-[11px] text-ink-3">L{a.level}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>

                <details className="group border-t border-line/70">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-5 text-[13.5px] font-bold text-brand-700 hover:bg-brand-50/50">
                    <ChevronRight className="h-4 w-4 transition-transform duration-200 group-open:rotate-90" aria-hidden />
                    Attempt by attempt: score, setup and what changed
                  </summary>
                  <div className="scroll-quiet overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="bg-surface-2">
                        <tr className="text-left text-xs text-ink-3">
                          <th className="px-4 py-2 font-medium">Attempt</th>
                          <th className="px-3 py-2 text-right font-medium">Score</th>
                          <th className="px-3 py-2 font-medium">Setup</th>
                          <th className="px-3 py-2 font-medium">What changed from the attempt before</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/70">
                        {c.attempts.map((a, i) => {
                          const prev = i > 0 ? c.attempts[i - 1] : null;
                          const delta = prev ? Math.round(a.percent - prev.percent) : null;
                          const gained = prev ? a.elicitedIds.filter((id) => !prev.elicitedIds.includes(id)).length : 0;
                          const lost = prev ? prev.elicitedIds.filter((id) => !a.elicitedIds.includes(id)).length : 0;
                          const up = prev ? a.domains.filter((d) => { const p = prev.domains.find((x) => x.key === d.key); return p && p.score !== null && d.score !== null && d.score > p.score; }) : [];
                          const down = prev ? a.domains.filter((d) => { const p = prev.domains.find((x) => x.key === d.key); return p && p.score !== null && d.score !== null && d.score < p.score; }) : [];
                          return (
                            <tr key={a.id} className="align-top">
                              <td className="whitespace-nowrap px-4 py-2.5 text-ink">
                                <div className="font-semibold">Attempt {i + 1}</div>
                                <div className="text-xs text-ink-3">
                                  <When at={a.date} time={false} />
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                                <div className="font-mono font-bold tabular-nums text-ink">{Math.round(a.percent)}%</div>
                                {delta !== null && <div className="text-xs tabular-nums text-ink-2">{delta > 0 ? `+${delta}` : delta === 0 ? "no change" : `−${Math.abs(delta)}`}</div>}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-ink-2">
                                <div className="flex flex-wrap items-center gap-1">
                                  <Badge tone="teal">Level {a.level}</Badge>
                                  <Badge>{MODE_LABEL[a.mode] || a.mode}</Badge>
                                </div>
                                {a.variation && <div className="mt-1">Patient variation: {a.variation}</div>}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-ink-2">
                                {!prev ? (
                                  <span className="text-ink-3">
                                    First attempt. {a.elicitedIds.length} findings gathered{a.missedCritical ? `, ${a.missedCritical} critical missed` : ""}.
                                  </span>
                                ) : (
                                  <ul className="space-y-0.5">
                                    {prev.level !== a.level && (
                                      <li>
                                        Difficulty went from level {prev.level} to level {a.level}.
                                      </li>
                                    )}
                                    <li>
                                      {gained > 0 ? `Gathered ${gained} finding${gained === 1 ? "" : "s"} you missed last time` : "No new findings gathered"}
                                      {lost > 0 && `; missed ${lost} you had found before`}.
                                    </li>
                                    <li>{a.missedCritical === 0 ? "No critical findings missed." : `${a.missedCritical} critical finding${a.missedCritical === 1 ? "" : "s"} still missed${prev.missedCritical !== a.missedCritical ? ` (was ${prev.missedCritical})` : ""}.`}</li>
                                    {up.length > 0 && <li>Higher: {up.map((d) => d.name).join(", ")}.</li>}
                                    {down.length > 0 && <li>Lower: {down.map((d) => d.name).join(", ")}.</li>}
                                  </ul>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                                <Link href={feedbackUrl(a.id)} className="inline-flex min-h-8 items-center rounded-full px-2.5 text-xs font-bold text-brand-700 hover:bg-brand-50 pointer-coarse:min-h-11">
                                  Feedback
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
