import { encounterFor } from "@/lib/access";
import { get } from "@/lib/db";
import { spoken } from "@/lib/engine/patient";
import { bad } from "@/lib/http";
import { speak } from "@/lib/tts";

// X-Mouth carries the lip-sync timeline (when the voice provided alignment) so the audio body stays plain mp3.
// A long clip's timeline is left out to stay under proxy header limits; the browser then uses the clip's loudness.
const audioHeaders = (cache: string, mouth?: string): Record<string, string> => ({ "Content-Type": "audio/mpeg", "Cache-Control": cache, ...(mouth && mouth.length < 4000 ? { "X-Mouth": mouth } : {}) });

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
    const sp = await speak(text, { name: p.name, sex: p.sex, age: p.age });
    return new Response(Buffer.from(sp.audio), { headers: audioHeaders("private, max-age=3600", sp.mouth) });
  } catch (e) {
    console.error(e);
    return bad("Voice is unavailable", 503);
  }
}

/** POST { e: encounterId, text } -> mp3 of one sentence, so speech can start while the reply is still streaming. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const r = await encounterFor(String(b.e || ""), { faculty: "also" });
  if (r instanceof Response) return r;
  const text = spoken(String(b.text || "")).slice(0, 600);
  if (!text) return new Response(null, { status: 204 });
  try {
    const p = r.enc.c.patient;
    const sp = await speak(text, { name: p.name, sex: p.sex, age: p.age });
    return new Response(Buffer.from(sp.audio), { headers: audioHeaders("no-store", sp.mouth) });
  } catch (e) {
    console.error(e);
    return bad("Voice is unavailable", 503);
  }
}
