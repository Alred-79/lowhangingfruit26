// Lip-sync helpers: a mouth timeline is keyframes of jaw openness (0-1) over audio time.

export interface MouthTimeline {
  t: number[]; // seconds, ascending
  v: number[]; // 0-1
}

/** Parse the server's "ms:level,..." string (level 0-9) from the X-Mouth header. */
export function parseMouth(s: string | null): MouthTimeline | null {
  if (!s) return null;
  const t: number[] = [];
  const v: number[] = [];
  for (const part of s.split(",")) {
    const [ms, lv] = part.split(":");
    const a = Number(ms), b = Number(lv);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      t.push(a / 1000);
      v.push(Math.min(1, b / 9));
    }
  }
  return t.length ? { t, v } : null;
}

/** Fallback for voices without alignment (Polly): the loudness envelope of the decoded clip. Decoding never touches playback. */
export async function envelopeMouth(blob: Blob): Promise<MouthTimeline | null> {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    try {
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      const data = buf.getChannelData(0);
      const step = Math.max(1, Math.round(buf.sampleRate * 0.04));
      const rms: number[] = [];
      let peak = 1e-4;
      for (let i = 0; i < data.length; i += step) {
        let sum = 0;
        const end = Math.min(data.length, i + step);
        for (let j = i; j < end; j++) sum += data[j] * data[j];
        const r = Math.sqrt(sum / (end - i));
        rms.push(r);
        peak = Math.max(peak, r);
      }
      const t = rms.map((_, i) => (i * step) / buf.sampleRate);
      // Quiet gaps close the mouth; loud stretches open it, scaled to this clip's own peak.
      const v = rms.map((r) => Math.min(1, Math.max(0, (r / peak - 0.12) / 0.7)));
      return { t, v };
    } finally {
      ctx.close().catch(() => {});
    }
  } catch {
    return null;
  }
}

/** Openness at audio time `sec`, holding each keyframe until the next (smoothed by the caller). */
export function levelAt(tl: MouthTimeline, sec: number): number {
  const { t, v } = tl;
  if (sec < t[0] || sec > t[t.length - 1] + 0.3) return 0;
  let lo = 0, hi = t.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (t[mid] <= sec) lo = mid;
    else hi = mid - 1;
  }
  return v[lo];
}
