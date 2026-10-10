import { apiUser } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { bad } from "@/lib/http";

/** Faculty review of a visit. Body: { note: string | null, score: number | null } (score 0-100, null clears the adjustment). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("faculty");
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  const enc = get<{ id: string; status: string }>("SELECT id, status FROM encounters WHERE id = ?", id);
  if (!enc) return bad("Visit not found", 404);
  if (enc.status !== "scored" && enc.status !== "submitted") return bad("This visit has not been submitted yet");
  const b = await req.json().catch(() => ({}));
  const note = String(b.note ?? "").trim().slice(0, 4000) || null;
  let score: number | null = null;
  if (b.score !== null && b.score !== undefined && b.score !== "") {
    score = Number(b.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) return bad("The adjusted score must be between 0 and 100");
    score = Math.round(score * 10) / 10;
  }
  run("UPDATE encounters SET faculty_note = ?, faculty_score = ? WHERE id = ?", note, score, id);
  return Response.json({ ok: true, note, score });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser("faculty");
  if (user instanceof Response) return user;
  const row = get<{ faculty_note: string | null; faculty_score: number | null }>("SELECT faculty_note, faculty_score FROM encounters WHERE id = ?", (await ctx.params).id);
  if (!row) return bad("Visit not found", 404);
  return Response.json({ note: row.faculty_note, score: row.faculty_score });
}
