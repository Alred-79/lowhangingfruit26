import { ArrowRight, CircleCheck, FilePen, Plus, Route, Users } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import AppShell from "@/components/AppShell";
import { Count } from "@/components/game/hud";
import { Badge, cx, Empty, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all, parse } from "@/lib/db";
import type { JourneySpec } from "@/lib/journey/types";

const v = (o: Record<string, string | number>) => o as CSSProperties;

/** Completed runs of all started runs, as a ring with the numbers as text. */
function RunsRing({ done, runs }: { done: number; runs: number }) {
  const c = 2 * Math.PI * 16;
  return (
    <span className="relative grid h-14 w-14 shrink-0 place-items-center" role="img" aria-label={`${done} of ${runs} runs complete`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-surface-2)" strokeWidth="5" />
        {runs > 0 && <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-xp-ink)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - done / runs)} className="ring-fill" style={v({ "--from": c })} />}
      </svg>
      <span className="font-mono text-[12px] font-bold text-ink">{done}/{runs}</span>
    </span>
  );
}

export default async function FacultyJourneys() {
  const user = await requireUser("faculty");
  const rows = all<{ id: string; title: string; status: string; spec: string; runs: number; done: number }>(
    `SELECT j.id, j.title, j.status, j.spec,
       (SELECT COUNT(*) FROM journey_runs r WHERE r.journey_id = j.id) AS runs,
       (SELECT COUNT(*) FROM journey_runs r WHERE r.journey_id = j.id AND r.status = 'complete') AS done
     FROM journeys j WHERE j.status != 'archived' ORDER BY j.created_at DESC`,
  );
  const published = rows.filter((r) => r.status === "published").length;
  const runs = rows.reduce((n, r) => n + r.runs, 0);
  const done = rows.reduce((n, r) => n + r.done, 0);
  return (
    <AppShell user={user}>
      <PageHeader
        eyebrow={<><Route className="h-3.5 w-3.5" aria-hidden />Interprofessional</>}
        title="Care Journeys"
        subtitle="One patient case, several professionals in sequence, one shared patient state. Students join as one professional; the AI plays the others from the clinician personas."
        action={<LinkButton href="/faculty/journeys/new" size="lg"><Plus className="h-4 w-4" aria-hidden />New care journey</LinkButton>}
      />
      {rows.length > 0 && (
        <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            [rows.length, "journeys", "bg-brand-600 text-white"],
            [published, "published to students", "bg-[var(--color-xp)] text-ink"],
            [runs, "student runs started", "bg-[var(--color-mastery)] text-white"],
            [done, "runs complete", "bg-ink text-white"],
          ] as [number, string, string][]).map(([n, l, cls], i) => (
            <div key={l} className={cx("rise rounded-[22px] p-4 clay", cls)} style={v({ "--i": i })}>
              <dd className="font-display text-[38px] font-black leading-none tracking-[-0.04em]"><Count value={n} delay={i * 80} /></dd>
              <dt className="mt-1 text-[13px] font-bold opacity-90">{l}</dt>
            </div>
          ))}
        </dl>
      )}
      {!rows.length && <Empty icon={<Route className="h-6 w-6" aria-hidden />} title="No care journeys yet" action={<LinkButton href="/faculty/journeys/new">New care journey</LinkButton>}>No care journeys yet. Create one from any published patient case.</Empty>}
      <div className="space-y-3">
        {rows.map((j, i) => {
          const spec = parse<JourneySpec>(j.spec, { summary: "", stages: [] });
          return (
            <article key={j.id} className="rise lift flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-line/80 bg-surface p-4 shadow-e1 sm:p-5" style={v({ "--i": i + 2 })}>
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <RunsRing done={j.done} runs={j.runs} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-[18px] font-black leading-snug tracking-[-0.02em] text-ink">
                      <Link href={`/faculty/journeys/${j.id}`} className="hover:text-brand-700">{j.title}</Link>
                    </h2>
                    <Badge tone={j.status === "published" ? "green" : "amber"}>{j.status === "published" ? <CircleCheck className="h-3 w-3" aria-hidden /> : <FilePen className="h-3 w-3" aria-hidden />}{j.status === "published" ? "Published" : "Draft"}</Badge>
                  </div>
                  <ol className="mt-2 flex flex-wrap items-center gap-y-1.5 text-[12px] font-bold text-ink-2" aria-label="Encounters in order">
                    {[...spec.stages].sort((a, b) => a.order - b.order).map((s, k) => (
                      <li key={s.id} className="flex items-center">
                        {k > 0 && <span className="mx-1 h-[3px] w-4 rounded-full bg-brand-200" aria-hidden />}
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pl-0.5 pr-2.5 ring-1 ring-inset ring-line">
                          <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-600 font-mono text-[10.5px] text-white">{s.order}</span>
                          {s.roleTitle}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3"><Users className="h-3.5 w-3.5" aria-hidden />{j.runs} student run{j.runs === 1 ? "" : "s"}, {j.done} complete</p>
                </div>
              </div>
              <LinkButton href={`/faculty/journeys/${j.id}`} variant="secondary">Open<ArrowRight className="h-4 w-4" aria-hidden /></LinkButton>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
