import "server-only";
import { skillProfile } from "@/lib/adaptive";
import { heldAssignmentIds } from "@/lib/courses";
import { all, parse } from "@/lib/db";
import type { CaseProfile, EncounterConfig, EncounterState } from "@/lib/types";

/*
 * The game layer, derived. Everything here is computed on the server from rows the app already
 * stores (encounters, assignments, skill_ratings). Nothing is written, nothing new is stored, and
 * grades are never changed: the score shown anywhere is always faculty_score ?? score.
 *
 * Honesty rules (07-second-pass-plan.md, section 4):
 * - XP is effort, mastery is rubric evidence; they are never mixed. XP never includes a score, so
 *   it cannot reveal a grade (including one the instructor has held) and cannot reward speed or
 *   accuracy for its own sake (gamification-fit ethics veto).
 * - Private practice (no assignment, no journey) counts for the student's own XP and streak, but
 *   never for any class-facing number (see classBoard).
 */

export const RANKS = [
  { at: 0, title: "Newcomer" },
  { at: 300, title: "Listener" },
  { at: 700, title: "History-taker" },
  { at: 1200, title: "Interviewer" },
  { at: 1800, title: "Trusted interviewer" },
  { at: 2500, title: "Skilled clinician" },
  { at: 3300, title: "Senior clinician" },
  { at: 4200, title: "Expert interviewer" },
  { at: 5200, title: "Master clinician" },
  { at: 6300, title: "Legend" },
];

/** How XP is earned, in words: shown in the UI next to every XP number. */
export const XP_RULES = [
  ["Finish a visit", "+100"],
  ["Each difficulty level above 1", "+40"],
  ["Each fact you uncovered yourself", "+5 (up to 30 facts)"],
  ["A follow-up visit with a patient you have seen", "+25"],
] as const;

export interface RankInfo {
  n: number;
  title: string;
  floor: number;
  next: number | null;
  nextTitle: string | null;
  /** 0-1 progress from this rank's floor to the next. */
  progress: number;
}

export function rankFor(xp: number): RankInfo {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].at) i++;
  const next = RANKS[i + 1] || null;
  return { n: i + 1, title: RANKS[i].title, floor: RANKS[i].at, next: next?.at ?? null, nextTitle: next?.title ?? null, progress: next ? (xp - RANKS[i].at) / (next.at - RANKS[i].at) : 1 };
}

export interface VisitXp {
  id: string;
  at: string;
  xp: number;
  parts: [string, number][];
  held: boolean;
  privatePractice: boolean;
}

type Row = { id: string; case_id: string; status: string; score: number | null; faculty_score: number | null; ended_at: string | null; started_at: string; config: string; state: string; assignment_id: string | null; journey_run_id: string | null };

function visitXp(r: Row, held: Set<string>): VisitXp {
  const cfg = parse<Partial<EncounterConfig>>(r.config, {});
  const st = parse<Partial<EncounterState>>(r.state, {});
  const isHeld = !!r.assignment_id && held.has(r.assignment_id);
  const level = Math.max(1, Math.min(5, Math.round(cfg.knobs?.level ?? 1)));
  const uncovered = Object.values(st.disclosed || {}).filter((d) => d && d.how !== "record").length;
  const parts: [string, number][] = [["Visit finished", 100]];
  if (level > 1) parts.push([`Difficulty level ${level}`, 40 * (level - 1)]);
  if (uncovered > 0) parts.push([`${Math.min(30, uncovered)} facts uncovered`, 5 * Math.min(30, uncovered)]);
  if ((cfg.visitNumber || 1) > 1) parts.push(["Follow-up visit", 25]);
  return { id: r.id, at: r.ended_at || r.started_at, xp: parts.reduce((n, [, v]) => n + v, 0), parts, held: isHeld, privatePractice: !r.assignment_id && !r.journey_run_id };
}

// Streak days are calendar days in one product timezone (the deployment serves Rutgers, US Eastern).
// Stored times are UTC ("YYYY-MM-DD HH:MM:SS" from SQLite datetime('now')); a visit at 9 pm Eastern
// belongs to that Eastern day, not to the next UTC day.
const TZ = "America/New_York";
const fmtDay = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const day = (s: string) => {
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? s.slice(0, 10) : fmtDay.format(d);
};
const todayDay = () => fmtDay.format(new Date());
const addDays = (d: string, n: number) => {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

export interface Streak {
  days: number;
  /** A visit was finished today (UTC). */
  today: boolean;
  /** Bridged single missed days inside the current streak (forgiving streaks: one per 7 days). */
  grace: string[];
  best: number;
  week: { date: string; label: string; done: boolean; grace: boolean; isToday: boolean }[];
}

export function streakFrom(dates: string[], todayIso = todayDay()): Streak {
  const done = new Set(dates.map(day));
  const today = done.has(todayIso);
  let cursor = today ? todayIso : addDays(todayIso, -1);
  let days = 0;
  const grace: string[] = [];
  if (done.has(cursor)) {
    while (true) {
      if (done.has(cursor)) {
        days++;
        cursor = addDays(cursor, -1);
        continue;
      }
      // One missed day is bridged when the day before it was active, at most once per 7 streak days.
      const before = addDays(cursor, -1);
      if (done.has(before) && grace.length < 1 + Math.floor(days / 7)) {
        grace.push(cursor);
        cursor = before;
        continue;
      }
      break;
    }
  }
  // Best run ever (plain consecutive days), for the achievement.
  const sorted = [...done].sort();
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  const names = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(todayIso, i - 6);
    return { date, label: names[new Date(date + "T00:00:00Z").getUTCDay()], done: done.has(date), grace: grace.includes(date), isToday: date === todayIso };
  });
  return { days, today, grace, best: Math.max(best, days), week };
}

const DOMAIN_SHORT: Record<string, string> = {
  opening_and_purpose: "Opening",
  information_gathering: "Gathering",
  rapport_respect_empathy: "Empathy",
  listening_and_response_to_cues: "Listening",
  explanation_and_shared_decisions: "Explaining",
  clinical_reasoning_and_synthesis: "Reasoning",
  professionalism_safety_closure: "Closing",
};
export const domainLabel = (key: string) => DOMAIN_SHORT[key] || key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()).slice(0, 14);

/** Elo rating mapped onto 0-100 for display (LEVEL_RATING runs 1000-1600; 900 and 1700 are the ends). */
export const masteryPct = (rating: number) => Math.round(Math.max(0, Math.min(100, ((rating - 900) / 800) * 100)));

export interface Achievement {
  id: string;
  title: string;
  detail: string;
  got: boolean;
  /** Icon key for the badge (mapped to lucide icons in the client). */
  icon: "spark" | "five" | "ten" | "flame" | "blaze" | "star" | "key" | "mountain" | "route" | "repeat";
  tone: "xp" | "flame" | "mastery" | "tier";
}

export interface GameState {
  xp: number;
  rank: RankInfo;
  streak: Streak;
  visits: number;
  mastery: { key: string; label: string; value: number; n: number }[];
  achievements: Achievement[];
  log: VisitXp[];
  weekXp: number;
}

/** Everything the student-facing game layer shows, from stored rows. */
export function deriveGame(userId: string, professionId: string): GameState {
  const rows = all<Row>(
    `SELECT id, case_id, status, score, faculty_score, ended_at, started_at, config, state, assignment_id, journey_run_id
     FROM encounters WHERE user_id = ? AND status IN ('submitted','scored') AND parent_id IS NULL ORDER BY COALESCE(ended_at, started_at)`,
    userId,
  );
  const held = heldAssignmentIds();
  const log = rows.map((r) => visitXp(r, held));
  const xp = log.reduce((n, v) => n + v.xp, 0);
  const streak = streakFrom(rows.map((r) => r.ended_at || r.started_at));
  const weekStart = addDays(todayDay(), -6);
  const weekXp = log.filter((v) => day(v.at) >= weekStart).reduce((n, v) => n + v.xp, 0);

  const profile = skillProfile(userId, professionId);
  const mastery = profile.domains.map((d) => ({ key: d.domain, label: domainLabel(d.domain), value: masteryPct(d.rating), n: d.n }));

  const achievements = achievementsOf(rows, held, streak.best);

  return { xp, rank: rankFor(xp), streak, visits: rows.length, mastery, achievements, log, weekXp };
}


/** Achievements from stored visits only. Case snapshots are read here, on the server, for the tier of
 *  facts the student actually uncovered; nothing from them leaves this function but booleans. */
function achievementsOf(rows: Row[], held: Set<string>, bestStreak: number): Achievement[] {
  const visible = rows.filter((r) => r.status === "scored" && !(r.assignment_id && held.has(r.assignment_id)));
  const best = Math.max(0, ...visible.map((r) => r.faculty_score ?? r.score ?? 0));
  const cfgs = rows.map((r) => parse<Partial<EncounterConfig>>(r.config, {}));
  let trust = false;
  for (const r of rows) {
    const st = parse<Partial<EncounterState>>(r.state, {});
    const mine = Object.entries(st.disclosed || {}).filter(([, d]) => d && d.how !== "record").map(([id]) => id);
    if (!mine.length) continue;
    const snap = parse<Partial<CaseProfile>>(all<{ case_snapshot: string }>("SELECT case_snapshot FROM encounters WHERE id = ?", r.id)[0]?.case_snapshot, {});
    if ((snap.facts || []).some((f) => mine.includes(f.id) && (f.tier === "reluctant" || f.tier === "hidden"))) {
      trust = true;
      break;
    }
  }
  const n = rows.length;
  return [
    { id: "first", title: "First patient", detail: "Finish your first visit", got: n >= 1, icon: "spark", tone: "xp" },
    { id: "five", title: "Five visits", detail: "Finish five visits", got: n >= 5, icon: "five", tone: "xp" },
    { id: "ten", title: "Ten visits", detail: "Finish ten visits", got: n >= 10, icon: "ten", tone: "xp" },
    { id: "streak3", title: "On a roll", detail: "Practise three days in a row", got: bestStreak >= 3, icon: "flame", tone: "flame" },
    { id: "streak7", title: "Week-long streak", detail: "Practise seven days in a row", got: bestStreak >= 7, icon: "blaze", tone: "flame" },
    { id: "trust", title: "Trust earned", detail: "Uncover a fact the patient only shares once they trust you", got: trust, icon: "key", tone: "tier" },
    { id: "score85", title: "Top marks", detail: "Score 85 or more on a visit with released feedback", got: best >= 85, icon: "star", tone: "mastery" },
    { id: "hard", title: "Hard mode", detail: "Finish a visit at difficulty level 4 or 5", got: cfgs.some((c) => (c.knobs?.level ?? 0) >= 4), icon: "mountain", tone: "mastery" },
    { id: "followup", title: "They remembered you", detail: "Finish a follow-up visit with a patient you have seen", got: cfgs.some((c) => (c.visitNumber || 1) > 1), icon: "repeat", tone: "tier" },
    { id: "journey", title: "Team player", detail: "Finish your encounter in a care journey", got: rows.some((r) => !!r.journey_run_id), icon: "route", tone: "tier" },
  ];
}

/** XP for one visit, the rank before and after it, and the badges this visit unlocked: the results reveal. */
export function visitReward(userId: string, encounterId: string): { visit: VisitXp; before: RankInfo; after: RankInfo; xpBefore: number; xpAfter: number; unlocked: Achievement[] } | null {
  const rows = all<Row>(
    `SELECT id, case_id, status, score, faculty_score, ended_at, started_at, config, state, assignment_id, journey_run_id
     FROM encounters WHERE user_id = ? AND status IN ('submitted','scored') AND parent_id IS NULL ORDER BY COALESCE(ended_at, started_at)`,
    userId,
  );
  const held = heldAssignmentIds();
  let xpBefore = 0;
  for (const r of rows) {
    const v = visitXp(r, held);
    if (r.id === encounterId) {
      const k = rows.indexOf(r);
      const prior = rows.slice(0, k);
      const through = rows.slice(0, k + 1);
      const was = achievementsOf(prior, held, streakFrom(prior.map((x) => x.ended_at || x.started_at)).best);
      const now = achievementsOf(through, held, streakFrom(through.map((x) => x.ended_at || x.started_at)).best);
      const unlocked = now.filter((a) => a.got && !was.find((b) => b.id === a.id)?.got);
      return { visit: v, before: rankFor(xpBefore), after: rankFor(xpBefore + v.xp), xpBefore, xpAfter: xpBefore + v.xp, unlocked };
    }
    xpBefore += v.xp;
  }
  return null;
}
