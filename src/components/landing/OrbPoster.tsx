import { ORB_TIERS, orbPoints } from "./orbData";

// Static SVG of the disclosure orb: the first paint, the reduced-motion version and the no-WebGL
// fallback. Same seeded points as the WebGL orb, projected once at a fixed angle.
const ROT_Y = 0.9;
const TILT_X = 0.38;
const CAM = 7.4;
const SCALE = 62;

function project(x: number, y: number, z: number) {
  const cy = Math.cos(ROT_Y), sy = Math.sin(ROT_Y);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cx = Math.cos(TILT_X), sx = Math.sin(TILT_X);
  const y2 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  const p = CAM / (CAM - z2);
  // Rounded so server and browser maths (which differ in the last digits) render identical markup.
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { x: r2(x1 * p * SCALE), y: r2(-y2 * p * SCALE), depth: z2, p: r2(p) };
}

export default function OrbPoster({ className }: { className?: string }) {
  const pts = orbPoints()
    .map((pt) => ({ ...pt, ...project(pt.x, pt.y, pt.z) }))
    .sort((a, b) => a.depth - b.depth);
  return (
    <svg viewBox="-200 -200 400 400" className={className} role="img" aria-label="Four shells of patient facts around the patient. Inner shells light up first; the outer, guarded shell needs the most trust.">
      <defs>
        <radialGradient id="orb-core" r="0.5">
          <stop offset="0" stopColor="#f4ffd9" stopOpacity="1" />
          <stop offset="1" stopColor="#c6f36a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {ORB_TIERS.map((t) => (
        <ellipse key={t.id} cx={0} cy={0} rx={t.radius * SCALE * 1.02} ry={t.radius * SCALE * 0.38} fill="none" stroke={t.hex} strokeOpacity={0.36} strokeWidth={1} transform="rotate(-7)" />
      ))}
      {pts.map((pt, i) => {
        const r = Math.round((pt.unlocks ? 3.1 : 2.1) * pt.p * 100) / 100;
        return <circle key={i} cx={pt.x} cy={pt.y} r={r} fill={pt.unlocks ? ORB_TIERS[pt.tier].hex : "#4a4f86"} fillOpacity={pt.unlocks ? 0.95 : 0.7} />;
      })}
      <circle cx={0} cy={0} r={26} fill="url(#orb-core)" />
      <circle cx={0} cy={0} r={6} fill="#f4ffd9" />
    </svg>
  );
}
