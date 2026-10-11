// Shared geometry for the sign-in "disclosure orb": four shells of points, one per fact tier.
// Pure data, no DOM or WebGL, so the SVG poster and the WebGL canvas draw the same composition.

export interface OrbTier {
  id: "initial" | "discoverable" | "reluctant" | "hidden";
  label: string;
  /** Shell radius in scene units. */
  radius: number;
  count: number;
  /** Share of this shell's facts that a good interview unlocks in one sweep. */
  unlocks: number;
  /** sRGB colour, 0-1. */
  rgb: [number, number, number];
  hex: string;
}

export const ORB_TIERS: OrbTier[] = [
  { id: "initial", label: "Volunteered", radius: 0.95, count: 22, unlocks: 1, rgb: [0.13, 0.78, 0.55], hex: "#22c78c" },
  { id: "discoverable", label: "When asked", radius: 1.45, count: 32, unlocks: 0.85, rgb: [0.27, 0.62, 0.95], hex: "#459ef2" },
  { id: "reluctant", label: "Needs trust", radius: 1.95, count: 40, unlocks: 0.55, rgb: [0.96, 0.66, 0.2], hex: "#f5a833" },
  { id: "hidden", label: "Guarded", radius: 2.45, count: 48, unlocks: 0.3, rgb: [0.95, 0.36, 0.45], hex: "#f25c73" },
];

export interface OrbPoint {
  x: number;
  y: number;
  z: number;
  tier: number;
  /** Will this point light up during a sweep? */
  unlocks: boolean;
  /** 0-1, staggers when within the shell the point lights. */
  jitter: number;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fibonacci-sphere points per shell, with a seeded choice of which ones unlock. */
export function orbPoints(seed = 7): OrbPoint[] {
  const rand = mulberry32(seed);
  const out: OrbPoint[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  ORB_TIERS.forEach((t, ti) => {
    for (let i = 0; i < t.count; i++) {
      const y = 1 - (i / (t.count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const phi = i * golden + ti * 0.7;
      out.push({ x: Math.cos(phi) * r * t.radius, y: y * t.radius, z: Math.sin(phi) * r * t.radius, tier: ti, unlocks: rand() < t.unlocks, jitter: rand() });
    }
  });
  return out;
}
