import { Armchair, CircleCheck, Hourglass, Route, Users } from "lucide-react";
import type { CSSProperties } from "react";
import AppShell from "@/components/AppShell";
import { TiltCard } from "@/components/game/controls";
import { Count } from "@/components/game/hud";
import { Badge, cx, Empty, LinkButton } from "@/components/ui";
import { isFaculty, requireUser } from "@/lib/auth";
import { studentJourneyLabel } from "@/lib/courses/label";
import { all, parse } from "@/lib/db";
import type { JourneySpec } from "@/lib/journey/types";
import type { CaseProfile } from "@/lib/types";

const v = (o: Record<string, string | number>) => o as CSSProperties;

export default async function StudentJourneys() {
  const user = await requireUser();
  const journeys = all<{ id: string; title: string; spec: string; profile: string }>("SELECT j.id, j.title, j.spec, c.profile FROM journeys j JOIN cases c ON c.id = j.case_id WHERE j.status = 'published' ORDER BY j.created_at");
  const runs = all<{ id: string; journey_id: string; status: string; student_stage_id: string; created_at: string }>("SELECT id, journey_id, status, student_stage_id, created_at FROM journey_runs WHERE user_id = ? ORDER BY created_at DESC", user.id);
  const done = runs.filter((r) => r.status === "complete").length;
  const going = runs.length - done;
  return (
    <AppShell user={user}>
      <h1 className="sr-only">Care Journeys</h1>
      {/* ---------- Hero ---------- */}
      <section className="rise relative mb-6 overflow-hidden rounded-[28px] bg-brand-600 p-5 text-white clay sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full spin-slow [background:conic-gradient(from_0deg,transparent,rgb(255_255_255/0.18),transparent_40%)]" aria-hidden />
        <svg className="pointer-events-none absolute bottom-0 right-0 hidden h-40 w-[32rem] opacity-60 md:block" viewBox="0 0 520 160" aria-hidden>
          <path d="M20 130 C120 130 120 40 220 40 S320 120 420 120 S500 50 510 40" fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth="14" strokeLinecap="round" />
          <path d="M20 130 C120 130 120 40 220 40 S320 120 420 120 S500 50 510 40" fill="none" stroke="var(--color-xp)" strokeWidth="4" strokeLinecap="round" className="orbit-dash" />
          {[[20, 130], [220, 40], [420, 120], [510, 40]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i === 3 ? 13 : 10} fill={i < 2 ? "var(--color-xp)" : "white"} stroke="var(--color-brand-600)" strokeWidth="4" />
          ))}
        </svg>
        <div className="relative max-w-2xl">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[12.5px] font-bold"><Route className="h-3.5 w-3.5" aria-hidden />Care Journeys</p>
          <p className="mt-2 font-display text-[clamp(2rem,4vw,3rem)] font-black leading-[0.98] tracking-[-0.035em]">One patient. Several professionals. One shared record.</p>
          <p className="mt-3 text-[15px] leading-relaxed text-white/90">Take one role; the AI plays the patient and your colleagues. What each of you finds changes what the next one does.</p>
        </div>
        <dl className="relative mt-5 flex flex-wrap gap-2">
          <div className="rounded-2xl bg-white px-4 py-2.5 text-ink">
            <dd className="font-display text-[30px] font-black leading-none tracking-[-0.04em]"><Count value={journeys.length} /></dd>
            <dt className="mt-1 text-[12px] font-bold text-ink-3">journeys open</dt>
          </div>
          <div className="rounded-2xl bg-[var(--color-xp)] px-4 py-2.5 text-ink">
            <dd className="font-display text-[30px] font-black leading-none tracking-[-0.04em]"><Count value={done} delay={120} /></dd>
            <dt className="mt-1 text-[12px] font-bold">you completed</dt>
          </div>
          <div className="rounded-2xl bg-[var(--color-flame-2)] px-4 py-2.5 text-ink">
            <dd className="font-display text-[30px] font-black leading-none tracking-[-0.04em]"><Count value={going} delay={240} /></dd>
            <dt className="mt-1 text-[12px] font-bold">in progress</dt>
          </div>
        </dl>
      </section>

      {!journeys.length && <Empty icon={<Route className="h-6 w-6" aria-hidden />} title="No care journeys yet">No care journeys have been published yet.</Empty>}
      <div className="grid gap-5 lg:grid-cols-2">
        {journeys.map((j, ji) => {
          const spec = parse<JourneySpec>(j.spec, { summary: "", stages: [] });
          const c = parse<CaseProfile>(j.profile, {} as CaseProfile);
          const mine = runs.filter((r) => r.journey_id === j.id);
          // The journey title and summary are written for faculty and name the diagnoses.
          const faculty = isFaculty(user);
          const neutral = studentJourneyLabel(c.patient?.name, spec.stages.map((s) => s.roleTitle));
          const seats = new Set(mine.map((r) => r.student_stage_id));
          const ordered = [...spec.stages].sort((a, b) => a.order - b.order);
          return (
            <TiltCard key={j.id} max={4} className="rise rounded-[24px]">
              <article className="flex h-full flex-col overflow-hidden rounded-[24px] border border-line/80 bg-surface shadow-e1" style={v({ "--i": ji })}>
                <div className="flex items-start gap-4 p-5">
                  <div className="relative shrink-0">
                    {c.patient?.portrait ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.patient.portrait} alt="" className="float-idle h-24 w-24 rounded-[22px] object-cover object-[50%_25%] ring-4 ring-brand-100" style={v({ "--i": ji })} />
                    ) : (
                      <span className="float-idle grid h-24 w-24 place-items-center rounded-[22px] bg-stage font-display text-2xl font-black text-white/85">{(c.patient?.name || "?").slice(0, 2).toUpperCase()}</span>
                    )}
                    <span className="absolute -bottom-2 -right-2 inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-extrabold text-white clay"><Users className="h-3 w-3" aria-hidden />{spec.stages.length}</span>
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-[21px] font-black leading-tight tracking-[-0.025em] text-ink">{faculty ? j.title : neutral.title}</h2>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{faculty ? spec.summary : `Seen in turn by ${spec.stages.length} professionals. Join as any one of them; the AI plays the rest.`}</p>
                    <div className="mt-1.5 text-[12.5px] font-semibold text-ink-3">
                      Patient: {c.patient?.name}, {c.patient?.age}
                    </div>
                  </div>
                </div>
                {/* The team, in order: one shared patient passes through each of them. Your seat is marked. */}
                <ol className="relative mx-5 flex flex-wrap items-center gap-y-2 rounded-2xl bg-surface-2 px-3 py-3 text-[12.5px] font-bold text-ink-2" aria-label="Encounters in order">
                  {ordered.map((s, i) => (
                    <li key={s.id} className="flex items-center">
                      {i > 0 && <span className="mx-1 h-[3px] w-4 rounded-full bg-brand-200" aria-hidden />}
                      <span className={cx("pop-spring inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 ring-1 ring-inset", seats.has(s.id) ? "bg-[var(--color-mastery-soft)] text-ink ring-[var(--color-mastery)]/50" : "bg-surface ring-line")} style={v({ "--i": i + 2 })}>
                        <span className={cx("grid h-5 w-5 place-items-center rounded-full font-mono text-[10.5px] font-black", seats.has(s.id) ? "bg-[var(--color-mastery)] text-white" : "bg-brand-600 text-white")}>{seats.has(s.id) ? <Armchair className="h-3 w-3" aria-label="your seat" /> : s.order}</span>
                        {s.roleTitle}
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="mt-auto flex flex-wrap items-center gap-2 p-5">
                  <LinkButton href={`/student/journeys/${j.id}`} size="lg">
                    <Route className="h-4 w-4" aria-hidden />
                    Choose your role
                  </LinkButton>
                  {mine.slice(0, 3).map((r) => {
                    const st = spec.stages.find((s) => s.id === r.student_stage_id);
                    return (
                      <LinkButton key={r.id} href={`/journey/${r.id}`} variant="secondary" size="sm">
                        {r.status === "complete" ? <CircleCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Hourglass className="h-3.5 w-3.5 text-amber-600" aria-hidden />}
                        {r.status === "complete" ? "Review" : "Resume"} as {st?.roleTitle.toLowerCase() || "your role"} <Badge tone={r.status === "complete" ? "green" : "amber"}>{r.status === "complete" ? "complete" : "in progress"}</Badge>
                      </LinkButton>
                    );
                  })}
                </div>
              </article>
            </TiltCard>
          );
        })}
      </div>
    </AppShell>
  );
}
