import { ArrowLeft, ArrowRight, ChevronDown, CircleCheck, FilePen, MessagesSquare, Play, Settings2, Sparkles, X } from "lucide-react";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import AppShell from "@/components/AppShell";
import JourneyBuilder from "@/components/journey/JourneyBuilder";
import { Badge, cx, Empty, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all, parse } from "@/lib/db";
import { builderOptions } from "@/lib/journey/facultyData";
import { loadJourney } from "@/lib/journey/store";
import { BEHAVIOURS, type TraceEvaluation } from "@/lib/journey/types";

const v = (o: Record<string, string | number>) => o as CSSProperties;
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

export default async function FacultyJourney({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser("faculty");
  const j = loadJourney(id);
  if (!j) notFound();
  const runs = all<{ id: string; status: string; student_stage_id: string; evaluation: string | null; created_at: string; name: string; entries: number; messages: number }>(
    `SELECT r.id, r.status, r.student_stage_id, r.evaluation, r.created_at, u.name,
       (SELECT COUNT(*) FROM state_entries e WHERE e.run_id = r.id) AS entries,
       (SELECT COUNT(*) FROM team_messages m WHERE m.run_id = r.id AND m.thread LIKE 'consult:%' AND m.from_role != '' AND json_extract(m.meta, '$.fromIsAi') = 0) AS messages
     FROM journey_runs r JOIN users u ON u.id = r.user_id WHERE r.journey_id = ? ORDER BY r.created_at DESC`,
    id,
  );
  const domains = [...new Set(BEHAVIOURS.map((b) => b.domain))];
  const ringC = 2 * Math.PI * 16;
  return (
    <AppShell user={user}>
      <PageHeader
        eyebrow={<>{j.row.status === "published" ? <CircleCheck className="h-3.5 w-3.5" aria-hidden /> : <FilePen className="h-3.5 w-3.5" aria-hidden />}Care journey</>}
        title={j.row.title}
        subtitle={j.spec.summary}
        action={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={j.row.status === "published" ? "green" : "amber"}>{j.row.status === "published" ? "Published" : "Draft"}</Badge>
            <LinkButton href={`/student/journeys/${j.row.id}`} variant="secondary" size="sm"><Play className="h-3.5 w-3.5" aria-hidden />Try it as a student</LinkButton>
            <LinkButton href="/faculty/journeys" variant="secondary" size="sm"><ArrowLeft className="h-3.5 w-3.5" aria-hidden />All care journeys</LinkButton>
          </span>
        }
      />
      <ol className="rise mb-6 flex flex-wrap items-center gap-y-2" aria-label="Encounters in order" style={v({ "--i": 3 })}>
        {j.stages.map((s, i) => (
          <li key={s.id} className="flex items-center">
            {i > 0 && <span className="mx-1.5 h-[4px] w-6 rounded-full bg-brand-200" aria-hidden />}
            <span className="pop-spring inline-flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3.5 text-[13px] font-bold text-ink shadow-e1 ring-1 ring-inset ring-line" style={v({ "--i": i + 3 })}>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 font-display text-[13px] font-black text-white clay">{s.order}</span>
              {s.roleTitle}
              <span className="font-normal text-ink-3">{s.simTime}</span>
            </span>
          </li>
        ))}
      </ol>

      <section className="rise mb-6 rounded-[24px] border border-line/80 bg-surface shadow-e1" style={v({ "--i": 4 })}>
        <header className="flex items-start gap-3 px-5 pb-3 pt-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--color-mastery)] text-white clay"><Sparkles className="h-5 w-5" aria-hidden /></span>
          <div>
            <h2 className="font-display text-[21px] font-black tracking-[-0.025em] text-ink">Student runs <span className="font-mono text-[15px] text-ink-3">{runs.length}</span></h2>
            <p className="mt-0.5 text-[13px] text-ink-3">Open a run to see its shared patient state, provenance, handoffs, huddle and care plan exactly as the student saw them.</p>
          </div>
        </header>
        <div className="px-5 pb-5">
          {!runs.length && <Empty>No student has started this journey yet.</Empty>}
          <div className="space-y-3">
            {runs.map((r, ri) => {
              const ev = parse<TraceEvaluation | null>(r.evaluation, null);
              const stage = j.stages.find((s) => s.id === r.student_stage_id);
              return (
                <article key={r.id} className="rise rounded-[20px] bg-surface-2/70 p-4 ring-1 ring-inset ring-line" style={v({ "--i": ri })}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--color-mastery)] font-display text-[14px] font-black text-white clay" aria-hidden>{initials(r.name)}</span>
                      <div className="min-w-0">
                        <div>
                          <span className="font-display text-[16px] font-extrabold text-ink">{r.name}</span>
                          <span className="text-[14px] text-ink-2"> as {stage?.roleTitle.toLowerCase() || "unknown role"}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-3">
                          <span>Started {r.created_at}</span>
                          <span><span className="font-mono font-bold text-ink">{r.entries}</span> entries in the shared state</span>
                          <span className="inline-flex items-center gap-1"><MessagesSquare className="h-3 w-3" aria-hidden /><span className="font-mono font-bold text-ink">{r.messages}</span> message{r.messages === 1 ? "" : "s"} to colleagues</span>
                        </div>
                      </div>
                    </div>
                    <span className="flex items-center gap-2">
                      <Badge tone={r.status === "complete" ? "green" : "amber"}>{r.status === "complete" ? "Complete" : r.status === "huddle" ? "In the huddle" : "In progress"}</Badge>
                      <LinkButton href={`/journey/${r.id}`} size="sm">Open run<ArrowRight className="h-3.5 w-3.5" aria-hidden /></LinkButton>
                    </span>
                  </div>
                  {ev ? (
                    <div className="mt-3">
                      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                        {domains.map((d) => {
                          const items = BEHAVIOURS.filter((b) => b.domain === d).map((b) => ev.behaviours.find((x) => x.key === b.key)).filter(Boolean);
                          const yes = items.filter((x) => x!.observed === "yes").length;
                          const app = items.filter((x) => x!.observed !== "na").length;
                          return (
                            <div key={d} className="flex items-center gap-2.5 rounded-2xl bg-surface px-3 py-2 ring-1 ring-inset ring-line">
                              <span className="relative grid h-10 w-10 shrink-0 place-items-center" aria-hidden>
                                <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
                                  <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-surface-2)" strokeWidth="5" />
                                  <circle cx="20" cy="20" r="16" fill="none" stroke="#059669" strokeWidth="5" strokeLinecap="round" strokeDasharray={ringC} strokeDashoffset={ringC * (1 - (app ? yes / app : 0))} className="ring-fill" style={v({ "--from": ringC })} />
                                </svg>
                              </span>
                              <div className="min-w-0">
                                <div className="truncate text-xs text-ink-3">{d}</div>
                                <div className="text-sm font-bold text-ink">{yes} of {app} observed</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-3 max-w-[75ch] rounded-2xl bg-surface px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink-2 ring-1 ring-inset ring-line">{ev.summary}</p>
                      <details className="group mt-2">
                        <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-xs font-bold text-brand-700 pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
                          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
                          Behaviours not observed, with evidence location and feedback
                        </summary>
                        <ul className="mt-2 space-y-1.5 text-[13px]">
                          {ev.behaviours.filter((b) => b.observed === "no").map((b) => (
                            <li key={b.key} className="flex gap-2.5 rounded-2xl bg-surface px-3 py-2 ring-1 ring-inset ring-line">
                              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-600 text-white"><X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /></span>
                              <div>
                                <span className="font-bold text-ink">{BEHAVIOURS.find((x) => x.key === b.key)?.label}</span>
                                {b.location && <span className="text-ink-3"> · {b.location.replace("->", "→")}</span>}
                                <div className="text-ink-2">{b.feedback}</div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  ) : (
                    <p className={cx("mt-3 rounded-xl bg-surface px-3 py-2 text-xs text-ink-3 ring-1 ring-inset ring-line")}>The teamwork trace is written when the student closes the huddle.</p>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <h2 className="mb-3 inline-flex items-center gap-2 font-display text-[22px] font-black tracking-[-0.03em] text-ink"><Settings2 className="h-5 w-5 text-brand-600" aria-hidden />Edit this journey</h2>
      <JourneyBuilder {...builderOptions()} initial={{ id: j.row.id, title: j.row.title, summary: j.spec.summary, caseId: j.row.case_id, status: j.row.status, stages: j.stages }} />
    </AppShell>
  );
}
