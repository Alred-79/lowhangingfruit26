"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void) {
  const m = window.matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

/** True when the user asked for reduced motion. False on the server. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

/**
 * Counts from 0 to `target` once, on mount (and from the previous value when it changes).
 * Renders the final value on the server and under reduced motion, so nothing is ever hidden.
 */
export function useCountUp(target: number, { duration = 900, delay = 0 }: { duration?: number; delay?: number } = {}): number {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(target);
  const from = useRef(0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now() + delay;
    const a = from.current;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setValue(a + (target - a) * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay, reduced]);
  return reduced ? target : value;
}

export function CountUp({ value, duration, delay, format = (n) => String(Math.round(n)) }: { value: number; duration?: number; delay?: number; format?: (n: number) => string }) {
  const v = useCountUp(value, { duration, delay });
  return <>{format(v)}</>;
}

/**
 * A critically-damped-ish spring toward `target`, driven by requestAnimationFrame and written
 * straight to an element's style through `apply` (no React state per frame: emil + r3f rules).
 * Returns a setter for the target. Reduced motion: jumps straight to the target.
 */
export function useSpringValue(apply: (v: number) => void, { stiffness = 170, damping = 18, initial = 0 } = {}) {
  const state = useRef({ x: initial, v: 0, target: initial, raf: 0, last: 0 });
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });
  useEffect(() => {
    const s = state.current;
    return () => cancelAnimationFrame(s.raf);
  }, []);
  return (target: number) => {
    const s = state.current;
    s.target = target;
    if (typeof window !== "undefined" && window.matchMedia(QUERY).matches) {
      s.x = target;
      s.v = 0;
      applyRef.current(target);
      return;
    }
    if (s.raf) return;
    s.last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - s.last) / 1000);
      s.last = now;
      const f = -stiffness * (s.x - s.target) - damping * s.v;
      s.v += f * dt;
      s.x += s.v * dt;
      applyRef.current(s.x);
      if (Math.abs(s.v) < 0.001 && Math.abs(s.x - s.target) < 0.001) {
        s.x = s.target;
        applyRef.current(s.x);
        s.raf = 0;
        return;
      }
      s.raf = requestAnimationFrame(step);
    };
    s.raf = requestAnimationFrame(step);
  };
}
