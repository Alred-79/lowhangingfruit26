import AppShell from "@/components/AppShell";
import { Route } from "lucide-react";
import { Badge, Card, Empty, LinkButton, PageHeader } from "@/components/ui";
import { isFaculty, requireUser } from "@/lib/auth";
import { studentJourneyLabel } from "@/lib/courses/label";
import { all, parse } from "@/lib/db";
import type { JourneySpec } from "@/lib/journey/types";
import type { CaseProfile } from "@/lib/types";

export default async function StudentJourneys() {
  const user = await requireUser();
  const journeys = all<{ id: string; title: string; spec: string; profile: string }>("SELECT j.id, j.title, j.spec, c.profile FROM journeys j JOIN cases c ON c.id = j.case_id WHERE j.status = 'published' ORDER BY j.created_at");
  const runs = all<{ id: string; journey_id: string; status: string; student_stage_id: string; created_at: string }>("SELECT id, journey_id, status, student_stage_id, created_at FROM journey_runs WHERE user_id = ? ORDER BY created_at DESC", user.id);
  return (
    <AppShell user={user}>
      <PageHeader title="Care Journeys" subtitle="One patient, several professionals, one shared record. Take one role; the AI plays the patient and your colleagues. What each of you finds changes what the next one does." />
      {!journeys.length && <Empty>No care journeys have been published yet.</Empty>}
      <div className="grid gap-5 lg:grid-cols-2">
        {journeys.map((j) => {
          const spec = parse<JourneySpec>(j.spec, { summary: "", stages: [] });
          const c = parse<CaseProfile>(j.profile, {} as CaseProfile);
          const mine = runs.filter((r) => r.journey_id === j.id);
          // The journey title and summary are written for faculty and name the diagnoses.
          const faculty = isFaculty(user);
          const neutral = studentJourneyLabel(c.patient?.name, spec.stages.map((s) => s.roleTitle));
          return (
            <Card key={j.id} className="flex flex-col overflow-hidden">
              <div className="flex items-start gap-4 p-5">
                {c.patient?.portrait ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.patient.portrait} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover object-[50%_25%] ring-1 ring-line" />
                ) : (
                  <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-stage font-display text-xl font-semibold text-white/80">{(c.patient?.name || "?").slice(0, 2).toUpperCase()}</span>
                )}
                <div className="min-w-0">
                  <h2 className="font-display text-[19px] font-semibold leading-snug text-ink">{faculty ? j.title : neutral.title}</h2>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{faculty ? spec.summary : `Seen in turn by ${spec.stages.length} professionals. Join as any one of them; the AI plays the rest.`}</p>
                  <div className="mt-1 text-[12.5px] text-ink-3">
                    Patient: {c.patient?.name}, {c.patient?.age}
                  </div>
                </div>
              </div>
              {/* The team, in order: one shared patient passes through each of them. */}
              <ol className="flex flex-wrap items-center gap-y-2 border-y border-line bg-surface-2 px-5 py-3.5 text-[12.5px] text-ink-2" aria-label="Encounters in order">
                {[...spec.stages].sort((a, b) => a.order - b.order).map((s, i) => (
                  <li key={s.id} className="flex items-center">
                    {i > 0 && <span className="mx-1.5 h-px w-5 bg-slate-300" aria-hidden />}
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 ring-1 ring-inset ring-line">
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-brand-600 font-mono text-[10px] font-semibold text-white">{s.order}</span>
                      {s.roleTitle}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-auto flex flex-wrap items-center gap-2 p-5">
                <LinkButton href={`/student/journeys/${j.id}`}>
                  <Route className="h-4 w-4" aria-hidden />
                  Choose your role
                </LinkButton>
                {mine.slice(0, 3).map((r) => {
                  const st = spec.stages.find((s) => s.id === r.student_stage_id);
                  return (
                    <LinkButton key={r.id} href={`/journey/${r.id}`} variant="secondary" size="sm">
                      {r.status === "complete" ? "Review" : "Resume"} as {st?.roleTitle.toLowerCase() || "your role"} <Badge tone={r.status === "complete" ? "green" : "amber"}>{r.status === "complete" ? "complete" : "in progress"}</Badge>
                    </LinkButton>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
