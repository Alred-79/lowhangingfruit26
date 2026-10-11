import { headers } from "next/headers";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import When from "@/components/courses/When";
import AccessKeys from "@/components/episodes/AccessKeys";
import { Bot, Search } from "lucide-react";
import TrustLabel from "@/components/TrustLabel";
import { Badge, Button, Card, CardHeader, Empty, Input, Label, PageHeader } from "@/components/ui";
import { isFaculty, requireUser } from "@/lib/auth";
import { searchEpisodes } from "@/lib/episodes";

export default async function EpisodesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const q = await searchParams;
  const faculty = isFaculty(user);
  const episodes = searchEpisodes(user, { patient: q.patient, participant: q.participant, role: q.role, text: q.text, limit: 60 });
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") || "https"}://${h.get("x-forwarded-host") || h.get("host")}`;
  return (
    <AppShell user={user}>
      <PageHeader
        title={faculty ? "Episodes" : "My visits"}
        subtitle={faculty ? "Every recorded visit (assignments and care journeys): search by patient, by who took part, by role, or by what was said. Students' private practice is not listed." : "Every visit you have taken part in, plus your teammates' visits with a patient your class shares."}
      />
      <Card className="mb-5 p-4">
        <form role="search" className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          <div>
            <Label htmlFor="ep-patient">Patient</Label>
            <Input id="ep-patient" name="patient" defaultValue={q.patient} placeholder="Patient name" />
          </div>
          <div>
            <Label htmlFor="ep-participant">{faculty ? "Who took part" : "Teammate"}</Label>
            <Input id="ep-participant" name="participant" defaultValue={q.participant} placeholder={faculty ? "Student or professional" : "Teammate"} />
          </div>
          <div>
            <Label htmlFor="ep-role">Role</Label>
            <Input id="ep-role" name="role" defaultValue={q.role} placeholder="Role, e.g. nursing" />
          </div>
          <div>
            <Label htmlFor="ep-text">Said in the visit</Label>
            <Input id="ep-text" name="text" defaultValue={q.text} placeholder="Said in the visit, e.g. alcohol" />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit">
              <Search className="h-4 w-4" aria-hidden />
              Search
            </Button>
            <Link href="/episodes" className="min-h-9 content-center rounded-lg px-2 text-[13.5px] text-ink-3 hover:text-ink">
              Clear
            </Link>
          </div>
        </form>
      </Card>
      <p className="mb-3 text-[13px] text-ink-3">
        <span className="font-semibold text-ink">{episodes.length}</span> episode{episodes.length === 1 ? "" : "s"}
        {faculty && (
          <>
            {" "}
            · <TrustLabel kind="recorded" /> visits only; <TrustLabel kind="private" /> is never listed
          </>
        )}
      </p>
      {episodes.length === 0 ? (
        <Empty>No episodes match.</Empty>
      ) : (
        <Card className="scroll-quiet overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[13.5px]">
            <thead className="bg-surface-2">
              <tr className="border-b border-line text-[12px] text-ink-3">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Patient</th>
                <th className="px-3 py-2 font-medium">Professional</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Turns</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {episodes.map((e) => (
                <tr key={e.id} className="border-b border-line/70 align-top transition-colors hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    <When at={e.startedAt} />
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/episodes?patient=${encodeURIComponent(e.patient)}`} className="font-medium text-slate-900 hover:underline">
                      {e.patient}
                    </Link>
                    {e.visitNumber > 1 && <Badge tone="blue" className="ml-1.5">visit {e.visitNumber}</Badge>}
                    {faculty && <div className="text-xs text-slate-500">{e.caseTitle}</div>}
                    {e.match && <div className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[12.5px] text-ink ring-1 ring-inset ring-amber-200">{e.match}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/episodes?participant=${encodeURIComponent(e.participant)}`} className="text-slate-800 hover:underline">
                      {e.participant}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{e.role}</td>
                  <td className="px-3 py-2">
                    <Badge tone={e.recorded ? "violet" : "slate"}>{e.mode}</Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-700">{e.turns}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-900">{e.status === "scored" && e.score !== null ? `${Math.round(e.score)}%` : <span className="text-slate-500">{e.status === "active" ? "in progress" : e.status}</span>}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={e.status === "active" && e.participantId === user.id ? `/encounter/${e.id}` : `/encounter/${e.id}/feedback`} className="font-medium text-brand-600 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Card className="mt-6">
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Bot className="h-4 w-4 text-brand-600" aria-hidden />
              Connect an assistant
            </span>
          }
          subtitle="Search these episodes from an AI assistant over MCP, or from a script."
        />
        <div className="p-4">
          <AccessKeys origin={origin} />
        </div>
      </Card>
    </AppShell>
  );
}
