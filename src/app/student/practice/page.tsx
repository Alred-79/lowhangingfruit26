import { Clock3, Lock, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import AppShell from "@/components/AppShell";
import MakePatient from "@/components/courses/MakePatient";
import PracticeLibrary, { type PracticeCase } from "@/components/courses/PracticeLibrary";
import StartVisit from "@/components/courses/StartVisit";
import { Count, GameCell } from "@/components/game/hud";
import TrustLabel from "@/components/TrustLabel";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { heldAssignmentIds, publishedCaseCards } from "@/lib/courses";
import { profession, professions } from "@/lib/professions";

const v = (o: Record<string, string | number>) => o as CSSProperties;

/** "Patients met" as a big ring: how many of the patients for you have at least one finished visit. */
function MetRing({ met, total }: { met: number; total: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const p = total ? met / total : 0;
  return (
    <div className="relative h-[116px] w-[116px] shrink-0 sm:h-[132px] sm:w-[132px]" role="img" aria-label={`${met} of ${total} patients met`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(255 255 255 / 0.16)" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-xp)" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} className="ring-fill" style={v({ "--from": c })} />
        <circle cx="50" cy="50" r="49" fill="none" stroke="var(--color-xp)" strokeOpacity="0.45" strokeWidth="1" className="orbit-dash" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <div>
          <p className="font-display text-[32px] font-black tracking-[-0.04em] sm:text-[38px]">
            <Count value={met} />
            <span className="text-[20px] text-white/75">/{total}</span>
          </p>
          <p className="mt-1 text-[11.5px] font-bold text-white/85">patients met</p>
        </div>
      </div>
    </div>
  );
}

export default async function PracticePage() {
  const user = await requireUser();
  const held = heldAssignmentIds();
  const mine = all<{
    id: string;
    case_id: string;
    status: string;
    score: number | null;
    faculty_score: number | null;
    assignment_id: string | null;
    journey_run_id: string | null;
  }>("SELECT id, case_id, status, score, faculty_score, assignment_id, journey_run_id FROM encounters WHERE user_id = ? AND status != 'abandoned' ORDER BY started_at", user.id);
  // Only display-safe fields are read from the profile here: the portrait path and the time limit (to
  // preview a level's timer). No title, summary or clinical content. Origin marks the "Sample" patients.
  const extra = new Map(
    all<{
      id: string;
      portrait: string | null;
      origin: string;
      tl: number | null;
    }>("SELECT id, json_extract(profile, '$.patient.portrait') AS portrait, origin, json_extract(profile, '$.scenario.timeLimitMin') AS tl FROM cases WHERE status = 'published'").map((r) => [r.id, r]),
  );
  const cases: PracticeCase[] = publishedCaseCards().map((c) => {
    const encs = mine.filter((e) => e.case_id === c.id);
    const done = encs.filter((e) => e.status === "scored" || e.status === "submitted");
    // Results the instructor is still holding stay hidden here too.
    const visible = done.filter((e) => !e.assignment_id || !held.has(e.assignment_id));
    const scores = visible.map((e) => e.faculty_score ?? e.score).filter((x): x is number => x !== null);
    const x = extra.get(c.id);
    return {
      ...c,
      portrait: x?.portrait || null,
      sample: x?.origin === "sample",
      timeLimitMin: typeof x?.tl === "number" && x.tl > 0 ? x.tl : null,
      attempts: done.length,
      best: scores.length ? Math.max(...scores) : null,
      lastId: visible.length ? visible[visible.length - 1].id : null,
      // Only free-practice visits resume from here; assignment and journey visits resume from their own pages.
      activeId: [...encs].reverse().find((e) => (e.status === "active" || e.status === "paused") && !e.assignment_id && !e.journey_run_id)?.id || null,
    };
  });
  // Private patients this student asked for. Only a safe label is read from the case.
  const own = all<{
    id: string;
    name: string | null;
    age: number | null;
    type: string | null;
    n: number;
  }>(
    `SELECT c.id, json_extract(c.profile, '$.patient.name') AS name, json_extract(c.profile, '$.patient.age') AS age, json_extract(c.profile, '$.encounterType') AS type,
            (SELECT COUNT(*) FROM encounters e WHERE e.case_id = c.id AND e.user_id = c.owner_id AND e.status = 'scored') AS n
     FROM cases c WHERE c.owner_id = ? AND c.status = 'draft' AND c.origin = 'ai_draft' ORDER BY c.created_at DESC LIMIT 12`,
    user.id,
  );

  const isStudent = user.role === "student";
  const role = profession(user.profession_id);
  // Display-only figures for the hero, from the same rows as the cards (held results already excluded from best).
  const forYou = isStudent && user.profession_id ? cases.filter((c) => c.professions.includes(user.profession_id as string)) : cases;
  const met = forYou.filter((c) => c.attempts > 0).length;
  const inProgress = cases.filter((c) => c.activeId).length;
  const visits = forYou.reduce((n, c) => n + c.attempts, 0);
  const bests = forYou.map((c) => c.best).filter((b): b is number => b !== null);
  const top = bests.length ? Math.round(Math.max(...bests)) : null;

  return (
    <AppShell user={user}>
      {/* ---------- Hero: the library as a collection ---------- */}
      <GameCell tone="brand" i={0} className="mb-4">
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full spin-slow [background:conic-gradient(from_0deg,transparent,rgb(255_255_255/0.16),transparent_40%)]" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
          <div className="min-w-0 max-w-2xl flex-1 basis-80">
            {isStudent && <p className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-[12.5px] font-bold text-white ring-1 ring-white/25">You are practising as {role.name}</p>}
            <h1 className="mt-2 font-display text-[clamp(2.6rem,6vw,4.25rem)] font-black leading-[0.92] tracking-[-0.04em]">Practice</h1>
            <p className="mt-3 max-w-xl text-[15.5px] leading-relaxed text-white/90">Any published patient, as many times as you like. Practice visits are not graded, and each one updates your skill ratings.</p>
          </div>
          <div className="game-layer flex items-center gap-4 sm:gap-5">
            <MetRing met={met} total={forYou.length} />
            <dl className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 sm:flex-none sm:gap-2">
              <div className="rounded-2xl bg-white/12 px-3.5 py-2 ring-1 ring-inset ring-white/15">
                <dt className="text-[11.5px] font-bold text-white/80">Visits finished</dt>
                <dd className="font-display text-[24px] font-black leading-none">
                  <Count value={visits} />
                </dd>
              </div>
              <div className="rounded-2xl bg-white/12 px-3.5 py-2 ring-1 ring-inset ring-white/15">
                <dt className="text-[11.5px] font-bold text-white/80">Best score</dt>
                <dd className="font-display text-[24px] font-black leading-none">{top === null ? "–" : `${top}%`}</dd>
              </div>
              <div className={inProgress ? "rounded-2xl bg-[var(--color-flame-2)] px-3.5 py-2 text-ink" : "rounded-2xl bg-white/12 px-3.5 py-2 ring-1 ring-inset ring-white/15"}>
                <dt className={inProgress ? "flex items-center gap-1.5 text-[11.5px] font-bold" : "text-[11.5px] font-bold text-white/80"}>
                  {inProgress > 0 && <span className="breathe h-2 w-2 rounded-full bg-[var(--color-live)]" aria-hidden />}
                  Visits in progress
                </dt>
                <dd className="font-display text-[24px] font-black leading-none">{inProgress}</dd>
              </div>
            </dl>
          </div>
        </div>
      </GameCell>

      {/* On phones the library comes first (the main job); from lg the generator sits above it. */}
      <div className="flex flex-col">
        {/* ---------- Make your own (students only) ---------- */}
        {isStudent && (
          <section aria-labelledby="make-own" className="rise order-2 mt-4 overflow-hidden lg:order-1 lg:mb-4 lg:mt-0 rounded-[26px] bg-ink text-white clay" style={v({ "--i": 1 })}>
            <div className="grid lg:grid-cols-[19rem_minmax(0,1fr)]">
              <div className="relative overflow-hidden p-5 sm:p-6">
                <div className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-[var(--color-mastery)]/35 blur-2xl" aria-hidden />
                <p className="relative inline-flex items-center gap-1.5 rounded-full bg-[var(--color-xp)] px-2.5 py-1 text-[12.5px] font-black text-ink">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden />
                  About 80 seconds
                </p>
                <h2 id="make-own" className="relative mt-3 font-display text-[26px] font-black leading-[1.02] tracking-[-0.03em]">
                  Make your own practice patient
                </h2>
                <p className="relative mt-2 text-[14px] leading-relaxed text-white/85">Describe who you want to practise with, or the skill you want to work on, and a private patient is written for you.</p>
                <div className="relative mt-4 flex flex-wrap gap-1.5">
                  <TrustLabel kind="private" />
                  <TrustLabel kind="ai-draft" />
                </div>
                <Sparkles className="float-idle absolute right-5 top-5 h-7 w-7 text-[var(--color-xp)]" aria-hidden />
              </div>
              <div className="border-t border-white/10 bg-white/[0.04] p-5 sm:p-6 lg:border-l lg:border-t-0">
                <MakePatient roleName={role.name} />
              </div>
            </div>
            {own.length > 0 && (
              <div className="border-t border-white/10 p-5 sm:p-6">
                <h3 className="flex items-center gap-2 font-display text-[18px] font-extrabold tracking-[-0.02em]">
                  <Lock className="h-4 w-4 text-[var(--color-xp)]" aria-hidden />
                  Your patients
                  <span className="rounded-full bg-white/12 px-2 py-0.5 font-mono text-[12px]">{own.length}</span>
                </h3>
                <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {own.map((c, i) => {
                    const first = (c.name || "Patient").split(" ")[0];
                    return (
                      <li key={c.id} className="pop-spring flex flex-col gap-3 rounded-[20px] bg-white/[0.07] p-3.5 ring-1 ring-inset ring-white/12" style={v({ "--i": i })}>
                        <div className="flex items-center gap-3">
                          <span
                            className="float-idle grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[var(--color-mastery)] to-brand-500 font-display text-[18px] font-black text-white"
                            style={v({ "--i": i })}
                            aria-hidden
                          >
                            {first.slice(0, 1)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-display text-[17px] font-extrabold leading-tight">
                              {first}
                              {c.age ? `, ${c.age}` : ""}
                            </p>
                            <p className="line-clamp-1 text-[12.5px] text-white/80">
                              {c.type} · {c.n} scored visit
                              {c.n === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {c.n > 0 && (
                            <StartVisit
                              body={{
                                caseId: c.id,
                                mode: "practice",
                                followUp: true,
                              }}
                              label="Follow-up visit"
                              variant="secondary"
                              size="sm"
                            />
                          )}
                          <StartVisit
                            body={{
                              caseId: c.id,
                              mode: "practice",
                              perturb: c.n > 0,
                            }}
                            label={c.n > 0 ? "Start over" : "Start visit"}
                            size="sm"
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        )}

        <section aria-label="Patient library" className="order-1 lg:order-2">
          <PracticeLibrary cases={cases} professionNames={Object.fromEntries(professions().map((p) => [p.id, p.name]))} myProfession={isStudent ? user.profession_id : null} />
        </section>
      </div>
    </AppShell>
  );
}
