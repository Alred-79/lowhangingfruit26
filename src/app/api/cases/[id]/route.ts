import { bad } from "@/lib/http";
import { hashProfile, sanitizeProfile } from "@/lib/studio/profile";
import { caseFor, consistencyOf, metaOf, profileOf, saveCase } from "@/lib/studio/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const r = await caseFor((await params).id);
  if (r instanceof Response) return r;
  const profile = profileOf(r.row);
  return Response.json({ meta: metaOf(r.row, r.user), profile, consistency: consistencyOf(r.row), hash: hashProfile(profile) });
}

/** Save. Body: { profile, consistency? }. Returns the stored hash so the client can tell when a check is out of date. */
export async function PUT(req: Request, { params }: Ctx) {
  const r = await caseFor((await params).id, { write: true });
  if (r instanceof Response) return r;
  const b = await req.json().catch(() => null);
  if (!b?.profile || typeof b.profile !== "object") return bad("Nothing to save.");
  const profile = sanitizeProfile(b.profile);
  if (!profile.facts.length) return bad("A patient needs at least one fact. Add one before saving.");
  const saved = saveCase(r.row.id, profile, b.consistency === undefined ? undefined : b.consistency);
  return Response.json({ ok: true, ...saved });
}
