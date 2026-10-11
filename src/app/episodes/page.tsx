import { headers } from "next/headers";
import Link from "next/link";
import type { CSSProperties } from "react";
import AppShell from "@/components/AppShell";
import AccessKeys from "@/components/episodes/AccessKeys";
import EpisodeExplorer, { type EpisodeItem } from "@/components/history/EpisodeExplorer";
import { Activity, Bot, MessageSquareText, Search, Stethoscope, UserRound, Users, X } from "lucide-react";
import TrustLabel from "@/components/TrustLabel";
import { Button, Empty, Input, Label } from "@/components/ui";
import { isFaculty, requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { searchEpisodes } from "@/lib/episodes";

const v = (o: Record<string, string | number>) => o as CSSProperties;

export default async function EpisodesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const q = await searchParams;
  const faculty = isFaculty(user);
  const episodes = searchEpisodes(user, { patient: q.patient, participant: q.participant, role: q.role, text: q.text, limit: 60 });
  // Scores of visits whose assignment feedback the instructor is still holding are not shown to
  // students here either (the feedback page already withholds them).
  const heldIds = faculty ? new Set<string>() : new Set(all<{ id: string }>("SELECT e.id FROM encounters e JOIN assignments a ON a.id = e.assignment_id WHERE a.feedback_released = 0").map((r) => r.id));
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") || "https"}://${h.get("x-forwarded-host") || h.get("host")}`;
  // Only what the old table rendered goes to the browser (no participant ids, findings or levels);
  // the case title stays faculty-only, as searchEpisodes already blanks it for students.
  const items: EpisodeItem[] = episodes.map((e) => ({
    id: e.id,
    startedAt: e.startedAt,
    status: e.status,
    mode: e.mode,
    patient: e.patient,
    participant: e.participant,
    role: e.role,
    visitNumber: e.visitNumber,
    turns: e.turns,
    score: e.status === "scored" && !heldIds.has(e.id) ? e.score : null,
    recorded: e.recorded,
    match: e.match,
    caseTitle: faculty ? e.caseTitle : "",
    openHref: e.status === "active" && e.participantId === user.id ? `/encounter/${e.id}` : `/encounter/${e.id}/feedback`,
    mine: e.participantId === user.id,
  }));
  const patients = new Set(episodes.map((e) => e.patient)).size;
  const live = episodes.filter((e) => e.status === "active" || e.status === "paused").length;
  const scored = episodes.filter((e) => e.status === "scored").length;
  const searching = !!(q.patient || q.participant || q.role || q.text);

  const fields = [
    { id: "ep-patient", name: "patient", label: "Patient", placeholder: "Patient name", Icon: Stethoscope },
    { id: "ep-participant", name: "participant", label: faculty ? "Who took part" : "Teammate", placeholder: faculty ? "Student or professional" : "Teammate", Icon: UserRound },
    { id: "ep-role", name: "role", label: "Role", placeholder: "Role, e.g. nursing", Icon: Users },
    { id: "ep-text", name: "text", label: "Said in the visit", placeholder: "Said in the visit, e.g. alcohol", Icon: MessageSquareText },
  ] as const;

  return (
    <AppShell user={user}>
      {/* ---------- Hero: the title and the history at a glance ---------- */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-6">
          <h1 className="rise font-display text-[34px] font-black leading-[1] tracking-[-0.035em] text-ink sm:text-[46px]">{faculty ? "Episodes" : "My visits"}</h1>
          <p className="rise mt-2 max-w-2xl text-[15.5px] leading-relaxed text-ink-2" style={v({ "--i": 1 })}>
            {faculty ? "Every recorded visit (assignments and care journeys): search by patient, by who took part, by role, or by what was said. Students' private practice is not listed." : "Every visit you have taken part in, plus your teammates' visits with a patient your class shares."}
          </p>
          {faculty && (
            <p className="rise mt-3 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2" style={v({ "--i": 2 })}>
              <TrustLabel kind="recorded" /> visits only; <TrustLabel kind="private" /> is never listed
            </p>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-3 lg:col-span-6">
          <div className="rise relative overflow-hidden rounded-[22px] bg-brand-600 p-4 text-white clay" style={v({ "--i": 1 })}>
            <dt className="text-[12.5px] font-bold text-white/85">{faculty ? "Episodes" : "Visits"}</dt>
            <dd className="mt-1 font-display text-[40px] font-black leading-none tracking-[-0.04em]">{episodes.length}</dd>
            <dd className="mt-1 text-[12px] font-semibold text-white/85">{searching ? "matching your search" : "most recent first"}</dd>
          </div>
          <div className="rise rounded-[22px] bg-[var(--color-xp)] p-4 text-ink clay" style={v({ "--i": 2 })}>
            <dt className="text-[12.5px] font-bold">Patients</dt>
            <dd className="mt-1 font-display text-[40px] font-black leading-none tracking-[-0.04em]">{patients}</dd>
            <dd className="mt-1 text-[12px] font-semibold">{scored} scored</dd>
          </div>
          <div className="rise rounded-[22px] bg-ink p-4 text-white clay" style={v({ "--i": 3 })}>
            <dt className="flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-bold text-white/85">
              {live > 0 && <span className="live-dot h-2 w-2 rounded-full bg-[var(--color-xp)]" aria-hidden />}
              In progress
            </dt>
            <dd className="mt-1 font-display text-[40px] font-black leading-none tracking-[-0.04em]">{live}</dd>
            <dd className="mt-1 text-[12px] font-semibold text-white/85">
              <Activity className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              open now
            </dd>
          </div>
        </dl>
      </div>

      {/* ---------- Search (a GET form: the URL keeps patient, participant, role and text) ---------- */}
      <form role="search" className="rise mt-5 grid items-end gap-3 rounded-[24px] border border-line/80 bg-surface p-4 shadow-e1 sm:grid-cols-2 sm:p-5 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]" style={v({ "--i": 2 })}>
        {fields.map(({ id, name, label, placeholder, Icon }) => (
          <div key={id}>
            <Label htmlFor={id}>{label}</Label>
            <div className="relative">
              <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <Input id={id} name={name} defaultValue={q[name]} placeholder={placeholder} className="pl-9" />
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Button type="submit">
            <Search className="h-4 w-4" aria-hidden />
            Search
          </Button>
          <Link href="/episodes" className="press inline-flex min-h-10 items-center gap-1 rounded-xl px-2.5 text-[13.5px] font-semibold text-ink-3 hover:bg-brand-50 hover:text-ink pointer-coarse:min-h-11">
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear
          </Link>
        </div>
      </form>
      {searching && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
          Searching for
          {fields
            .filter((f) => q[f.name])
            .map((f) => (
              <span key={f.name} className="rounded-full bg-brand-100 px-2.5 py-0.5 font-bold text-brand-800">
                {f.label}: {q[f.name]}
              </span>
            ))}
        </p>
      )}

      <p className="sr-only">
        {episodes.length} episode{episodes.length === 1 ? "" : "s"}
      </p>
      <div className="mt-5">
        {episodes.length === 0 ? (
          <Empty icon={<Search className="h-6 w-6" aria-hidden />} title="No episodes match." action={searching ? <Link href="/episodes" className="font-semibold text-brand-700 underline">Clear the search</Link> : undefined}>
            {searching ? "Try fewer words, or another patient or role." : faculty ? "Recorded visits from your courses will appear here." : "Finish a visit and it will appear here."}
          </Empty>
        ) : (
          <EpisodeExplorer items={items} faculty={faculty} />
        )}
      </div>

      {/* ---------- Access keys for an assistant ---------- */}
      <section className="rise mt-8 overflow-hidden rounded-[26px] border border-line/80 bg-surface shadow-e2" style={v({ "--i": 6 })} aria-labelledby="connect">
        <div className="flex flex-wrap items-center gap-3 bg-ink px-5 py-4 text-white sm:px-6">
          <span className="breathe grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--color-xp)] text-ink">
            <Bot className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="connect" className="font-display text-[20px] font-black tracking-[-0.02em]">
              Connect an assistant
            </h2>
            <p className="text-[13px] text-white/85">Search these episodes from an AI assistant over MCP, or from a script.</p>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <AccessKeys origin={origin} />
        </div>
      </section>
    </AppShell>
  );
}
