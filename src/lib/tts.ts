import { PollyClient, SynthesizeSpeechCommand, type VoiceId } from "@aws-sdk/client-polly";

const g = globalThis as unknown as { __polly?: PollyClient; __ttsCache?: Map<string, Speech> };

export interface Speaker {
  name: string;
  sex: string;
  age?: number;
}

const isFemale = (sex: string) => /^f|woman|female/i.test(sex);
function pick<T>(pool: T[], seed: string): T {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

// Amazon Polly generative voices (fallback, and the default when no ElevenLabs key is set).
const POLLY_F: VoiceId[] = ["Danielle", "Joanna", "Ruth", "Salli"];
const POLLY_M: VoiceId[] = ["Matthew", "Stephen"];

// ElevenLabs premade voices, grouped so a 72-year-old does not sound 25. Same person, same voice.
const XI = {
  f_young: ["EXAVITQu4vr4xnSDxMaL", "FGY2WhTYpPnrIDTdsKH5", "cgSgspJ2msm6clMCkdW9"],
  f_older: ["XrExE9yKIg1WjnnlVkGX", "hpp4J3VqNfWAUOO0d1Us"],
  m_young: ["TX3LPaxmHKxFdv7VOQHJ", "bIHbv24MWmeRgasZH58o"],
  m_middle: ["CwhRBWXzGAHq8TQ4Fs17", "cjVigY5qzO86Huf0OWal", "iP95p4xoKVk53GoZ742B", "nPczCjzI2devNBz1zQrb"],
  m_old: ["pqHfZKP75CvOlQylNhV4"],
};
function elevenVoice(s: Speaker): string {
  const age = s.age ?? 40;
  if (isFemale(s.sex)) return pick(age < 38 ? XI.f_young : XI.f_older, s.name);
  return pick(age < 32 ? XI.m_young : age < 62 ? XI.m_middle : XI.m_old, s.name);
}

export interface Speech {
  audio: Uint8Array;
  /** Mouth-openness timeline for lip-sync, "ms:level,ms:level,..." with level 0-9. Only present with ElevenLabs alignment. */
  mouth?: string;
}

const ELEVEN_BODY = (text: string) =>
  JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5", voice_settings: { stability: 0.45, similarity_boost: 0.75 } });
const elevenHeaders = () => ({ "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" });

// How far the jaw opens for a letter, 0-9. Lips-together sounds close the mouth; open vowels open it wide.
const OPENNESS: Record<string, number> = { a: 9, o: 7, e: 6, u: 5, i: 4, y: 3, w: 4, r: 3, l: 3, f: 2, v: 2, m: 0, b: 0, p: 0 };
function openness(ch: string): number {
  const c = ch.toLowerCase();
  if (c in OPENNESS) return OPENNESS[c];
  if (/[a-z]/.test(c)) return 3;
  if (/[0-9]/.test(c)) return 4;
  return /\s/.test(c) ? 1 : 0;
}

/** Collapse ElevenLabs character timings into a compact keyframe string the browser can drive the mouth from. */
function mouthTimeline(al: { characters?: string[]; character_start_times_seconds?: number[]; character_end_times_seconds?: number[] } | undefined): string | undefined {
  const ch = al?.characters, st = al?.character_start_times_seconds, en = al?.character_end_times_seconds;
  if (!ch?.length || !st || !en || ch.length !== st.length || ch.length !== en.length) return undefined;
  const out: string[] = [];
  let last = -1;
  const push = (sec: number, v: number) => {
    if (v === last) return;
    last = v;
    out.push(`${Math.round(sec * 1000)}:${v}`);
  };
  for (let i = 0; i < ch.length; i++) {
    push(st[i], openness(ch[i]));
    // A pause between characters (breath, comma, full stop) lets the mouth settle shut.
    if (i + 1 < ch.length && st[i + 1] - en[i] > 0.12) push(en[i], 0);
  }
  push(en[en.length - 1], 0);
  return out.join(",");
}

async function eleven(text: string, voiceId: string): Promise<Speech> {
  // The aligned endpoint gives the lip-sync timeline for the same price; fall back to plain audio if it misbehaves.
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_64`, {
      method: "POST",
      headers: elevenHeaders(),
      body: ELEVEN_BODY(text),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as { audio_base64?: string; alignment?: Parameters<typeof mouthTimeline>[0] };
    if (!j.audio_base64) throw new Error("ElevenLabs aligned response had no audio");
    return { audio: new Uint8Array(Buffer.from(j.audio_base64, "base64")), mouth: mouthTimeline(j.alignment) };
  } catch (e) {
    console.error("[tts] no alignment, plain audio:", (e as Error).message);
  }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: elevenHeaders(),
    body: ELEVEN_BODY(text),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return { audio: new Uint8Array(await res.arrayBuffer()) };
}

async function polly(text: string, voice: VoiceId): Promise<Uint8Array> {
  g.__polly ||= new PollyClient({ region: process.env.AWS_REGION || "us-west-2" });
  const res = await g.__polly.send(new SynthesizeSpeechCommand({ Text: text, VoiceId: voice, Engine: "generative", OutputFormat: "mp3" }));
  return res.AudioStream!.transformToByteArray();
}

/** Speech for one speaker. Uses ElevenLabs when a key is configured and falls back to Polly on any failure. */
export async function speak(text: string, s: Speaker): Promise<Speech> {
  text = text.slice(0, 2800);
  g.__ttsCache ||= new Map();
  const key = `${s.name}|${s.sex}|${s.age}|${text}`;
  const hit = g.__ttsCache.get(key);
  if (hit) return hit;
  let out: Speech | null = null;
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      out = await eleven(text, elevenVoice(s));
    } catch (e) {
      console.error("[tts] falling back to Polly:", (e as Error).message);
    }
  }
  out ||= { audio: await polly(text, pick(isFemale(s.sex) ? POLLY_F : POLLY_M, s.name)) };
  if (g.__ttsCache.size > 300) g.__ttsCache.clear();
  g.__ttsCache.set(key, out);
  return out;
}
