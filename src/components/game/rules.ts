// Rank ladder and XP rules: plain data, safe to import from client components (derive.ts is server-only).

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

