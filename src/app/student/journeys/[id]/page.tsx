import { ArrowLeft, Clock, Eye, FileText, MessagesSquare, PenLine, Stethoscope, Trophy, Users } from "lucide-react";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import AppShell from "@/components/AppShell";
import JoinButtons from "@/components/journey/JoinButtons";
import { LinkButton } from "@/components/ui";
import { isFaculty, requireUser } from "@/lib/auth";
import { studentJourneyLabel } from "@/lib/courses/label";
import { get, parse } from "@/lib/db";
import { clinician, loadJourney, resolveProfession } from "@/lib/journey/store";
import { stageBrief } from "@/lib/journey/types";
import type { CaseProfile } from "@/lib/types";

const v = (o: Record<string, string | number>) => o as CSSProperties;
const SEAT_TONES = ["bg-brand-600 text-white", "bg-[var(--color-mastery)] text-white", "bg-[var(--color-xp)] text-ink", "bg-[var(--color-flame-2)] text-ink", "bg-ink text-white"];

const HOW: [string, typeof Eye][] = [
  ["Encounters run in order. You watch each colleague's visit and read their SBAR handoff.", Eye],
  ["You hold your own visit with the patient, starting from the shared record, then write your SBAR.", PenLine],
  ["You can page any colleague at any time for a consult or to clarify something.", MessagesSquare],
  ["The team huddles to settle what is still disputed or unanswered.", Users],
  ["You get the integrated patient view, the coordinated care plan and feedback on your teamwork.", Trophy],
];

export default async function JourneyIntro({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ assignment?: string }> }) {
  const { id } = await params;
  const { assignment } = await searchParams;
  const user = await requireUser();
  const j = loadJourney(id);
  if (!j || (j.row.status !== "published" && !isFaculty(user))) notFound();
  const c = parse<CaseProfile>(get<{ profile: string }>("SELECT profile FROM cases WHERE id = ?", j.row.case_id)?.profile, {} as CaseProfile);
  // Only what is on the record before anyone sees the patient is shown here. Students get each stage's
  // neutral brief; the faculty-facing focus can name conditions and is not shown to them.
  const stages = j.stages.map((s) => {
    const cl = clinician(s.clinicianId);
    return { id: s.id, order: s.order, roleTitle: s.roleTitle, clinicianName: cl.name, clinicianRole: cl.role, focus: isFaculty(user) ? s.focus : stageBrief(s, c.patient?.name || "", j.stages.length), simTime: s.simTime, visitLabel: s.visitLabel, suggested: !!user.profession_id && resolveProfession(s).id === user.profession_id && (s.professionId === user.profession_id || !j.stages.some((o) => o.professionId === user.profession_id)) };
  });
  const firstSuggested = stages.findIndex((s) => s.suggested);
  // The journey title and summary are written for faculty and name the diagnoses; students get the patient and the roles.
  const neutral = studentJourneyLabel(c.patient?.name, stages.map((s) => s.roleTitle));
  const heading = isFaculty(user) ? { title: j.row.title, subtitle: j.spec.summary } : { title: neutral.title, subtitle: `Seen in turn by: ${neutral.roles}. Join as any one of them; the AI plays the rest.` };
  const chart = (c.chartAtStart || []).filter((x) => !/^reason for visit$/i.test(x.label.trim())).slice(0, 4);
  return (
    <AppShell user={user}>
      {/* ---------- Hero: the patient, the team, the time it takes ---------- */}
      <section className="rise relative mb-6 overflow-hidden rounded-[28px] bg-stage p-5 text-white clay sm:p-7">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -left-24 -top-32 h-80 w-80 rounded-full spin-slow [background:conic-gradient(from_0deg,transparent,oklch(0.6_0.24_268/0.55),transparent_45%)]" />
          <div className="absolute -bottom-40 right-0 h-96 w-96 rounded-full [background:radial-gradient(closest-side,oklch(0.86_0.2_128/0.28),transparent)]" />
        </div>
        <div className="relative grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
          {c.patient?.portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.patient.portrait} alt="" className="float-idle h-32 w-32 rounded-[28px] object-cover object-[50%_25%] ring-4 ring-white/15 sm:h-40 sm:w-40" />
          ) : (
            <span className="float-idle grid h-32 w-32 place-items-center rounded-[28px] bg-white/10 font-display text-4xl font-black text-white/85">{(c.patient?.name || "?").slice(0, 2).toUpperCase()}</span>
          )}
          <div className="min-w-0">
            <LinkButton href="/student/journeys" variant="ghost" size="sm" className="-ml-2 mb-2 !text-white/85 hover:!bg-white/10">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              All care journeys
            </LinkButton>
            <h1 className="font-display text-[30px] font-black leading-[1.02] tracking-[-0.035em] sm:text-[42px]">{heading.title}</h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-white/85">{heading.subtitle}</p>
            <ol className="mt-4 flex flex-wrap items-center gap-y-2" aria-label="The team, in order">
              {stages.map((s, i) => (
                <li key={s.id} className="flex items-center">
                  {i > 0 && <span className="mx-1 h-[3px] w-5 rounded-full bg-white/25" aria-hidden />}
                  <span className="pop-spring inline-flex items-center gap-1.5 rounded-full bg-white/10 py-1 pl-1 pr-3 text-[12.5px] font-bold ring-1 ring-inset ring-white/15" style={v({ "--i": i + 2 })}>
                    <span className={`grid h-6 w-6 place-items-center rounded-full font-mono text-[11px] font-black ${SEAT_TONES[i % SEAT_TONES.length]}`}>{s.order}</span>
                    {s.roleTitle}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--color-xp)] px-3 py-1 text-[12.5px] font-extrabold text-ink">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {stages.length} encounters · 20 to 30 minutes
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div>
          <h2 className="mb-1 font-display text-[22px] font-black tracking-[-0.03em] text-ink">Choose the professional you will be</h2>
          <p className="mb-4 text-[13.5px] text-ink-3">Point at a seat to see how much of the journey you watch before your own visit.</p>
          <JoinButtons journeyId={j.row.id} assignmentId={assignment} stages={stages.map((s, i) => ({ ...s, suggested: s.suggested && i === firstSuggested }))} />
        </div>
        <div className="space-y-4">
          <section className="rise rounded-[22px] border border-line/80 bg-surface p-4 shadow-e1" style={v({ "--i": 2 })}>
            <h2 className="inline-flex items-center gap-2 font-display text-[16px] font-extrabold text-ink"><Stethoscope className="h-4 w-4 text-brand-600" aria-hidden />The patient</h2>
            <div className="mt-3 flex items-center gap-3">
              {c.patient?.portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.patient.portrait} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover object-[50%_25%] ring-1 ring-line" />
              ) : null}
              <p className="font-display text-[17px] font-extrabold leading-tight text-ink">{c.patient?.name}, {c.patient?.age}, {c.patient?.sex}</p>
            </div>
            <dl className="mt-3 grid gap-2">
              {chart.map((x, i) => (
                <div key={x.label} className="rise rounded-2xl bg-surface-2 px-3 py-2" style={v({ "--i": i + 3 })}>
                  <dt className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-ink-3"><FileText className="h-3 w-3" aria-hidden />{x.label}</dt>
                  <dd className="text-[13.5px] leading-snug text-ink">{x.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rise rounded-[22px] bg-ink p-4 text-white shadow-e2" style={v({ "--i": 3 })}>
            <h2 className="font-display text-[16px] font-extrabold">How it works</h2>
            <ol className="relative mt-3 space-y-3 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-[3px] before:rounded-full before:bg-white/15">
              {HOW.map(([t, I], i) => (
                <li key={i} className="relative flex items-start gap-3 text-[13px] leading-relaxed text-white/90">
                  <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full ${i === HOW.length - 1 ? "bg-[var(--color-xp)] text-ink" : "bg-brand-600 text-white"}`}><I className="h-4 w-4" aria-hidden /></span>
                  <span className="pt-1"><span className="sr-only">{i + 1}. </span>{t}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/85">Allow 20 to 30 minutes. The later your role, the more you will watch before your own visit.</p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
