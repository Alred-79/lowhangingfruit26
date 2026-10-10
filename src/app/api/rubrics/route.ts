import { apiUser } from "@/lib/auth";
import { all, newId, run } from "@/lib/db";
import { bad } from "@/lib/http";
import { listRubrics } from "@/lib/rubrics";
import { cleanRubric } from "@/lib/studio/rubricSpec";

/** Built-in rubrics plus custom ones. `mine` marks the ones the caller can edit. */
export async function GET() {
  const user = await apiUser("faculty");
  if (user instanceof Response) return user;
  const owners = new Map(all<{ id: string; owner_id: string | null }>("SELECT id, owner_id FROM rubrics").map((r) => [r.id, r.owner_id]));
  return Response.json({ rubrics: listRubrics().map((r) => ({ ...r, custom: owners.has(r.id), mine: owners.get(r.id) === user.id })) });
}

/** Save a custom rubric. Body: { name, type: "domain4" | "checklist", instructions?, domains? | items? } */
export async function POST(req: Request) {
  const user = await apiUser("faculty");
  if (user instanceof Response) return user;
  try {
    const spec = cleanRubric(await req.json().catch(() => null));
    const id = newId("rb_");
    run("INSERT INTO rubrics (id, owner_id, name, spec) VALUES (?,?,?,?)", id, user.id, spec.name, JSON.stringify(spec));
    return Response.json({ rubric: { ...spec, id, custom: true, mine: true } });
  } catch (e) {
    return bad((e as Error).message);
  }
}
