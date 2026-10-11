"use client";

// The sign-in "disclosure orb" in WebGL. Loaded only by OrbStage through next/dynamic (ssr: false),
// so three.js never reaches any other route. Everything per frame mutates refs and typed arrays:
// no React state and no allocations inside useFrame (r3f-best-practices, three-best-practices).
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ORB_TIERS, orbPoints } from "./orbData";

const CYCLE = 10; // seconds: sweep out, hold, settle
const SWEEP = 6;
const HOLD = 2.2;
const MAX_R = ORB_TIERS[ORB_TIERS.length - 1].radius + 0.35;

const vertex = /* glsl */ `
  attribute float aLit;
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vLit;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * (0.6 + 0.7 * aLit) * uPixelRatio * (7.0 / -mv.z);
    vColor = aColor;
    vLit = aLit;
  }
`;
const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vLit;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.08, d);
    float core = smoothstep(0.2, 0.0, d);
    vec3 dim = mix(vec3(0.28, 0.46, 0.5), vColor, 0.42);
    vec3 col = mix(dim, vColor, vLit) + core * 0.55 * vLit;
    gl_FragColor = vec4(col, a * mix(0.55, 1.0, vLit));
  }
`;

function circle(radius: number, segments = 96) {
  const arr = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    arr[i * 3] = Math.cos(t) * radius;
    arr[i * 3 + 1] = Math.sin(t) * radius;
    arr[i * 3 + 2] = 0;
  }
  return arr;
}

function Orb({ pointer }: { pointer: { current: { x: number; y: number } } }) {
  const group = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const litAttr = useRef<THREE.BufferAttribute>(null);
  const pulse = useRef<THREE.LineLoop>(null);
  const pulseMat = useRef<THREE.LineBasicMaterial>(null);
  const pointsMat = useRef<THREE.ShaderMaterial>(null);
  const clock = useRef(0);

  const data = useMemo(() => {
    const pts = orbPoints();
    const n = pts.length + 1; // + the patient at the centre
    const position = new Float32Array(n * 3);
    const color = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const lit = new Float32Array(n);
    const radius = new Float32Array(n);
    const unlocks = new Uint8Array(n);
    const jitter = new Float32Array(n);
    pts.forEach((p, i) => {
      position.set([p.x, p.y, p.z], i * 3);
      color.set(ORB_TIERS[p.tier].rgb, i * 3);
      size[i] = 9 + p.jitter * 4;
      radius[i] = ORB_TIERS[p.tier].radius;
      unlocks[i] = p.unlocks ? 1 : 0;
      jitter[i] = p.jitter;
    });
    const c = n - 1;
    color.set([0.86, 0.98, 0.95], c * 3);
    size[c] = 26;
    lit[c] = 1;
    radius[c] = 0;
    unlocks[c] = 1;
    return { position, color, size, lit, radius, unlocks, jitter, n, rings: ORB_TIERS.map((t) => circle(t.radius)), pulse: circle(1, 128) };
  }, []);

  const uniforms = useMemo(() => ({ uPixelRatio: { value: 1 } }), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    clock.current = (clock.current + dt) % CYCLE;
    const t = clock.current;
    if (pointsMat.current) pointsMat.current.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    if (group.current) group.current.rotation.y += dt * 0.16;
    // Pointer parallax: ease the tilt toward the pointer (a spring-like lerp; refs only, no state).
    if (tilt.current) {
      const kk = 1 - Math.exp(-dt * 3.2);
      tilt.current.rotation.x += (pointer.current.y * 0.28 - tilt.current.rotation.x) * kk;
      tilt.current.rotation.y += (pointer.current.x * 0.38 - tilt.current.rotation.y) * kk;
    }

    // The rapport sweep: grows outward, holds, then the shells settle back for the next interview.
    const sweepT = Math.min(1, t / SWEEP);
    const sweepR = (1 - Math.pow(1 - sweepT, 3)) * MAX_R;
    const settling = t > SWEEP + HOLD;
    const k = 1 - Math.exp(-dt * (settling ? 1.6 : 7));
    const { radius, unlocks, jitter, n } = data;
    const attr = litAttr.current;
    if (attr) {
      // The attribute owns the typed array; it is mutated in place (no allocation per frame).
      const lit = attr.array as Float32Array;
      for (let i = 0; i < n - 1; i++) {
        const target = !settling && unlocks[i] && sweepR >= radius[i] * (1 + jitter[i] * 0.08) ? 1 : 0;
        lit[i] += (target - lit[i]) * k;
      }
      attr.needsUpdate = true;
    }

    if (pulse.current && pulseMat.current) {
      const s = Math.max(0.001, sweepR);
      pulse.current.scale.set(s, s, s);
      pulseMat.current.opacity = t < SWEEP ? 0.5 * (1 - sweepT) + 0.08 : 0;
    }
  });

  return (
    <>
      <lineLoop ref={pulse}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.pulse, 3]} />
        </bufferGeometry>
        <lineBasicMaterial ref={pulseMat} color="#c6f36a" transparent opacity={0} depthWrite={false} />
      </lineLoop>
      <group ref={tilt}>
      <group ref={group} rotation={[0.38, 0, 0.12]}>
        {data.rings.map((ring, i) => (
          <lineLoop key={i} rotation={[Math.PI / 2, 0, 0]}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[ring, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color={ORB_TIERS[i].hex} transparent opacity={0.34} depthWrite={false} blending={THREE.AdditiveBlending} />
          </lineLoop>
        ))}
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[data.position, 3]} />
            <bufferAttribute attach="attributes-aColor" args={[data.color, 3]} />
            <bufferAttribute attach="attributes-aSize" args={[data.size, 1]} />
            <bufferAttribute ref={litAttr} attach="attributes-aLit" args={[data.lit, 1]} usage={THREE.DynamicDrawUsage} />
          </bufferGeometry>
          <shaderMaterial ref={pointsMat} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
      </group>
      </group>
    </>
  );
}

export default function OrbCanvas({ active, onLost, pointer }: { active: boolean; onLost: () => void; pointer: { current: { x: number; y: number } } }) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={[1, 1.5]}
      flat
      camera={{ position: [0, 0, 7.4], fov: 42, near: 0.1, far: 50 }}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onLost();
        });
      }}
      aria-hidden
    >
      <Orb pointer={pointer} />
    </Canvas>
  );
}
