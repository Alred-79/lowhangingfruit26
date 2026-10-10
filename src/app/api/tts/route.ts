import { encounterFor } from "@/lib/access";
import { get } from "@/lib/db";
import { spoken } from "@/lib/engine/patient";
import { bad } from "@/lib/http";
import { synth, voiceFor } from "@/lib/tts";

/** GET /api/tts?e=<encounterId>&m=<messageId> -> mp3 of that patient message. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const r = await encounterFor(u.searchParams.get("e") || "", { faculty: "also" });
  if (r instanceof Response) return r;
  const m = get<{ text: string; speaker: string }>("SELECT text, speaker FROM messages WHERE id = ? AND encounter_id = ?", Number(u.searchParams.get("m")), r.enc.row.id);
  if (!m || m.speaker !== "patient") return bad("Message not found", 404);
  const text = spoken(m.text);
  if (!text) return new Response(null, { status: 204 });
  try {
    const p = r.enc.c.patient;
    const audio = await synth(text, voiceFor(p.sex, p.name));
    return new Response(Buffer.from(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    console.error(e);
    return bad("Voice is unavailable", 503);
  }
}
