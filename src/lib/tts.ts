import { PollyClient, SynthesizeSpeechCommand, type VoiceId } from "@aws-sdk/client-polly";

const g = globalThis as unknown as { __polly?: PollyClient; __ttsCache?: Map<string, Uint8Array> };
const FEMALE: VoiceId[] = ["Danielle", "Joanna", "Ruth", "Salli"];
const MALE: VoiceId[] = ["Matthew", "Stephen"];

/** Stable voice per person: same name always gets the same voice. */
export function voiceFor(sex: string, seed: string): VoiceId {
  const pool = /^f|woman|female/i.test(sex) ? FEMALE : MALE;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

export async function synth(text: string, voice: VoiceId): Promise<Uint8Array> {
  g.__polly ||= new PollyClient({ region: process.env.AWS_REGION || "us-west-2" });
  g.__ttsCache ||= new Map();
  const key = voice + "|" + text;
  const hit = g.__ttsCache.get(key);
  if (hit) return hit;
  const res = await g.__polly.send(new SynthesizeSpeechCommand({ Text: text.slice(0, 2800), VoiceId: voice, Engine: "generative", OutputFormat: "mp3" }));
  const bytes = await res.AudioStream!.transformToByteArray();
  if (g.__ttsCache.size > 200) g.__ttsCache.clear();
  g.__ttsCache.set(key, bytes);
  return bytes;
}
