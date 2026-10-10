import { encounterFor } from "@/lib/access";
import { run } from "@/lib/db";
import { addMessage } from "@/lib/engine/encounter";
import { bad } from "@/lib/http";

/** Faculty only, and only when live assist is enabled for the visit. Body: { paused: boolean, note? } */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await encounterFor(id, { faculty: "only" });
  if (r instanceof Response) return r;
  const { row, cfg, state } = r.enc;
  if (!cfg.liveAssist) return bad("Live assist is not enabled for this visit", 403);
  const b = await req.json().catch(() => ({}));
  if (b.paused && row.status === "active") {
    const note = String(b.note || "").slice(0, 1000);
    run("UPDATE encounters SET status = 'paused', pause_note = ? WHERE id = ?", note, id);
    addMessage(id, state.turn, "instructor", note ? `Paused by ${r.user.name}: ${note}` : `Paused by ${r.user.name}.`, { kind: "pause" });
  } else if (!b.paused && row.status === "paused") {
    run("UPDATE encounters SET status = 'active', pause_note = NULL WHERE id = ?", id);
    addMessage(id, state.turn, "instructor", "Visit resumed.", { kind: "resume" });
  }
  return Response.json({ ok: true });
}
