import { Sparkles } from "lucide-react";
import AppShell from "@/components/AppShell";
import MakePatient from "@/components/courses/MakePatient";
import PracticeLibrary, { type PracticeCase } from "@/components/courses/PracticeLibrary";
import StartVisit from "@/components/courses/StartVisit";
import TrustLabel from "@/components/TrustLabel";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { heldAssignmentIds, publishedCaseCards } from "@/lib/courses";
import { profession, professions } from "@/lib/professions";

export default async function PracticePage() {
  const user = await requireUser();
  const held = heldAssignmentIds();
  const mine = all<{ id: string; case_id: string; status: string; score: number | null; faculty_score: number | null; assignment_id: string | null; journey_run_id: string | null }>(
    "SELECT id, case_id, status, score, faculty_score, assignment_id, journey_run_id FROM encounters WHERE user_id = ? AND status != 'abandoned' ORDER BY started_at",
    user.id,
  );
  // Only the portrait path is read from the profile here: no title, summary or clinical content.
  const portraits = new Map(all<{ id: string; portrait: string | null }>("SELECT id, json_extract(profile, '$.patient.portrait') AS portrait FROM cases WHERE status = 'published'").map((r) => [r.id, r.portrait]));
  const cases: PracticeCase[] = publishedCaseCards().map((c) => {
    const encs = mine.filter((e) => e.case_id === c.id);
    const done = encs.filter((e) => e.status === "scored" || e.status === "submitted");
    // Results the instructor is still holding stay hidden here too.
    const visible = done.filter((e) => !e.assignment_id || !held.has(e.assignment_id));
    const scores = visible.map((e) => e.faculty_score ?? e.score).filter((x): x is number => x !== null);
    return {
      ...c,
      portrait: portraits.get(c.id) || null,
      attempts: done.length,
      best: scores.length ? Math.max(...scores) : null,
      lastId: visible.length ? visible[visible.length - 1].id : null,
      // Only free-practice visits resume from here; assignment and journey visits resume from their own pages.
      activeId: [...encs].reverse().find((e) => (e.status === "active" || e.status === "paused") && !e.assignment_id && !e.journey_run_id)?.id || null,
    };
  });
  // Private patients this student asked for. Only a safe label is read from the case.
  const own = all<{ id: string; name: string | null; age: number | null; type: string | null; n: number }>(
    `SELECT c.id, json_extract(c.profile, '$.patient.name') AS name, json_extract(c.profile, '$.patient.age') AS age, json_extract(c.profile, '$.encounterType') AS type,
            (SELECT COUNT(*) FROM encounters e WHERE e.case_id = c.id AND e.user_id = c.owner_id AND e.status = 'scored') AS n
     FROM cases c WHERE c.owner_id = ? AND c.status = 'draft' AND c.origin = 'ai_draft' ORDER BY c.created_at DESC LIMIT 12`,
    user.id,
  );
  return (
    <AppShell user={user}>
      <PageHeader title="Practice" subtitle="Any published patient, as many times as you like. Practice visits are not graded, and each one updates your skill ratings." />
      {user.role === "student" && (
        <section aria-labelledby="make-own" className="mb-7 overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="grid lg:grid-cols-[16rem_minmax(0,1fr)]">
            <div className="border-b border-line bg-surface-2 p-5 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2 text-[13px] font-medium text-brand-700">
                <Sparkles className="h-4 w-4" aria-hidden />
                About 80 seconds
              </div>
              <h2 id="make-own" className="mt-1.5 font-display text-[19px] font-semibold leading-snug text-ink">
                Make your own practice patient
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">Describe who you want to practise with, or the skill you want to work on, and a private patient is written for you.</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <TrustLabel kind="private" />
                <TrustLabel kind="ai-draft" />
              </div>
            </div>
            <div className="space-y-4 p-5">
              <MakePatient roleName={profession(user.profession_id).name} />
              {own.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[13px] font-semibold text-ink-2">Your patients</h3>
                  <ul className="divide-y divide-line/70 rounded-xl border border-line">
                    {own.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-[14px]">
                        <span>
                          <span className="font-semibold text-ink">
                            {(c.name || "Patient").split(" ")[0]}
                            {c.age ? `, ${c.age}` : ""}
                          </span>
                          <span className="ml-2 text-ink-3">
                            {c.type} · {c.n} scored visit{c.n === 1 ? "" : "s"}
                          </span>
                        </span>
                        <span className="flex gap-2">
                          {c.n > 0 && <StartVisit body={{ caseId: c.id, mode: "practice", followUp: true }} label="Follow-up visit" variant="secondary" size="sm" />}
                          <StartVisit body={{ caseId: c.id, mode: "practice", perturb: c.n > 0 }} label={c.n > 0 ? "Start over" : "Start visit"} size="sm" />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
      <PracticeLibrary cases={cases} professionNames={Object.fromEntries(professions().map((p) => [p.id, p.name]))} myProfession={user.role === "student" ? user.profession_id : null} />
    </AppShell>
  );
}
