import type { CSSProperties } from "react";
import type { Knobs } from "@/lib/types";

const dStyle = (p: string) => ({ d: `path("${p}")` }) as CSSProperties;

// A neutral avatar (no skin tone, no hair): it stands for any patient, not a particular person.
// Mood words are read straight from the engine's difficulty knobs (emotion 0-3, vagueness 0-3), so the
// preview says exactly what the level does to the patient and nothing more.
export const MOOD = ["At ease", "A little uneasy", "Guarded", "Very guarded"] as const;
export const VAGUE = ["Clear answers", "Sometimes vague", "Often vague", "Very vague"] as const;
/** A dot color per emotion step: lime (calm) to live red (most guarded). Text always carries the word too. */
export const MOOD_DOT = ["var(--color-xp)", "var(--color-flame-2)", "var(--color-flame)", "var(--color-live)"] as const;

const clamp = (n: number) => Math.max(0, Math.min(3, Math.round(n)));

/**
 * An expressive face that reads the knobs: the mouth falls and the brows knit as emotion rises,
 * the eyes drift away as answers get vaguer. Decorative (aria-hidden): the mood is also in text.
 */
export default function MoodFace({ knobs, size = 112, className = "" }: { knobs: Knobs; size?: number; className?: string }) {
  const e = clamp(knobs.emotion);
  const vg = clamp(knobs.vagueness);
  // Mouth: a quadratic curve whose control point drops from a smile to a frown.
  const curve = [16, 7, -1, -8][e];
  const mouthW = [17, 15, 12, 13][e];
  const mouth = `M ${50 - mouthW} 68 Q 50 ${68 + curve} ${50 + mouthW} 68`;
  // Brows: inner ends rise (worry) as emotion rises.
  const lift = [0, 3, 6, 9][e];
  const browL = `M 27 ${37 - lift * 0.2} Q 34 ${33 - lift * 0.4} 42 ${35 + lift * 0.5}`;
  const browR = `M 73 ${37 - lift * 0.2} Q 66 ${33 - lift * 0.4} 58 ${35 + lift * 0.5}`;
  const look = [0, 2, 3.5, 4.5][vg];
  const blush = e === 0 ? 0.55 : e === 1 ? 0.3 : 0;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`practice-face ${className}`} aria-hidden>
      <defs>
        <radialGradient id="pf-skin" cx="40%" cy="32%" r="75%">
          <stop offset="0" stopColor="#f4f5ff" />
          <stop offset="1" stopColor="#c4eef0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="52" r="44" fill="url(#pf-skin)" />
      <circle cx="28" cy="62" r="7" fill="#ff7a9a" opacity={blush} style={{ transition: "opacity 280ms" }} />
      <circle cx="72" cy="62" r="7" fill="#ff7a9a" opacity={blush} style={{ transition: "opacity 280ms" }} />
      <path d={browL} style={dStyle(browL)} stroke="#1b2255" strokeWidth="3.6" strokeLinecap="round" fill="none" />
      <path d={browR} style={dStyle(browR)} stroke="#1b2255" strokeWidth="3.6" strokeLinecap="round" fill="none" />
      <g className="practice-blink">
        <ellipse cx="35" cy="48" rx="6" ry="7" fill="#fff" />
        <ellipse cx="65" cy="48" rx="6" ry="7" fill="#fff" />
        <g style={{ transform: `translate(${look}px, ${look * 0.35}px)` }}>
          <circle cx="35" cy="49" r="3.6" fill="#0d2f33" />
          <circle cx="65" cy="49" r="3.6" fill="#0d2f33" />
        </g>
      </g>
      <path d={mouth} style={dStyle(mouth)} stroke="#1b2255" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
