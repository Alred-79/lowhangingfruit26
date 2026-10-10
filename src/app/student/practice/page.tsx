import AppShell from "@/components/AppShell";
import PracticeLibrary, { type PracticeCase } from "@/components/courses/PracticeLibrary";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { heldAssignmentIds, publishedCaseCards } from "@/lib/courses";
import { professions } from "@/lib/professions";

export default async function PracticePage() {
  const user = await requireUser();
  const held = heldAssignmentIds();
  const mine = all<{ id: string; case_id: string; status: string; score: number | null; faculty_score: number | null; assignment_id: string | null; journey_run_id: string | null }>(
    "SELECT id, case_id, status, score, faculty_score, assignment_id, journey_run_id FROM encounters WHERE user_id = ? AND status != 'abandoned' ORDER BY started_at",
    user.id,
  );
  const cases: PracticeCase[] = publishedCaseCards().map((c) => {
    const encs = mine.filter((e) => e.case_id === c.id);
    const done = encs.filter((e) => e.status === "scored" || e.status === "submitted");
    // Results the instructor is still holding stay hidden here too.
    const visible = done.filter((e) => !e.assignment_id || !held.has(e.assignment_id));
    const scores = visible.map((e) => e.faculty_score ?? e.score).filter((x): x is number => x !== null);
    return {
      ...c,
      attempts: done.length,
      best: scores.length ? Math.max(...scores) : null,
      lastId: visible.length ? visible[visible.length - 1].id : null,
      // Only free-practice visits resume from here; assignment and journey visits resume from their own pages.
      activeId: [...encs].reverse().find((e) => (e.status === "active" || e.status === "paused") && !e.assignment_id && !e.journey_run_id)?.id || null,
    };
  });
  return (
    <AppShell user={user}>
      <PageHeader title="Practice" subtitle="Any published patient, as many times as you like. Practice visits are not graded, and each one updates your skill ratings." />
      <PracticeLibrary cases={cases} professionNames={Object.fromEntries(professions().map((p) => [p.id, p.name]))} myProfession={user.role === "student" ? user.profession_id : null} />
    </AppShell>
  );
}
