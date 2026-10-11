import AppShell from "@/components/AppShell";
import CaseLibrary from "@/components/studio/CaseLibrary";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { professions } from "@/lib/professions";
import { listCases } from "@/lib/studio/store";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const user = await requireUser("faculty");
  const portraits = Object.fromEntries(
    all<{ id: string; portrait: string | null }>("SELECT id, json_extract(profile, '$.patient.portrait') AS portrait FROM cases")
      .filter((r) => r.portrait)
      .map((r) => [r.id, r.portrait as string]),
  );
  return (
    <AppShell user={user}>
      <CaseLibrary initial={listCases(user)} professions={professions().map((p) => ({ id: p.id, name: p.name }))} portraits={portraits} />
    </AppShell>
  );
}
