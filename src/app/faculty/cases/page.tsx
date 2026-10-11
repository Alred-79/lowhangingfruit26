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
  // Display only (faculty page): how many facts sit in each disclosure tier, per case, for the tier bars.
  const tiers: Record<string, [number, number, number, number]> = {};
  const order = ["initial", "discoverable", "reluctant", "hidden"];
  for (const r of all<{ id: string; tier: string | null; n: number }>("SELECT c.id AS id, json_extract(f.value, '$.tier') AS tier, COUNT(*) AS n FROM cases c, json_each(c.profile, '$.facts') f GROUP BY c.id, tier")) {
    const k = order.indexOf(r.tier || "");
    if (k < 0) continue;
    (tiers[r.id] ||= [0, 0, 0, 0])[k] = r.n;
  }
  return (
    <AppShell user={user}>
      <CaseLibrary initial={listCases(user)} professions={professions().map((p) => ({ id: p.id, name: p.name }))} portraits={portraits} tiers={tiers} />
    </AppShell>
  );
}
