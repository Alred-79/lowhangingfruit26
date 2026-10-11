"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { useSpringValue } from "@/components/motion";

const FINE = "(hover: hover) and (pointer: fine)";
const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * A card that tilts toward the pointer on a spring, with a soft glare that follows it.
 * Pointer-fine devices only; never under reduced motion. Transform is written straight to the
 * element (no state per frame), per emil-design-eng.
 */
export function TiltCard({ children, className, max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const glare = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const cur = useRef({ x: 0, y: 0 });
  const apply = (v: number, axis: "x" | "y") => {
    cur.current[axis] = v;
    if (el.current) el.current.style.transform = `perspective(900px) rotateX(${cur.current.x.toFixed(2)}deg) rotateY(${cur.current.y.toFixed(2)}deg)`;
  };
  const rx = useSpringValue((v) => apply(v, "x"), { stiffness: 180, damping: 16 });
  const ry = useSpringValue((v) => apply(v, "y"), { stiffness: 180, damping: 16 });
  const enabled = () => typeof window !== "undefined" && window.matchMedia(FINE).matches && !window.matchMedia(REDUCED).matches;
  return (
    <div
      ref={el}
      className={cx("relative will-change-transform [transform-style:preserve-3d]", className)}
      onPointerMove={(e) => {
        if (!enabled() || !el.current) return;
        const r = el.current.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        target.current = { x: (0.5 - py) * max * 2, y: (px - 0.5) * max * 2 };
        rx(target.current.x);
        ry(target.current.y);
        if (glare.current) {
          glare.current.style.opacity = "1";
          glare.current.style.background = `radial-gradient(420px circle at ${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%, rgb(255 255 255 / 0.22), transparent 45%)`;
        }
      }}
      onPointerLeave={() => {
        rx(0);
        ry(0);
        if (glare.current) glare.current.style.opacity = "0";
      }}
    >
      {children}
      <div ref={glare} className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300" aria-hidden />
    </div>
  );
}

/**
 * Hold-to-confirm. The fill grows over `ms` while the pointer or Space/Enter is held and snaps back
 * on release (emil: slow where the user decides, fast where the system responds). Completion is timed
 * in JS, so it works the same under reduced motion. A quick tap explains itself instead of firing.
 */
export function HoldButton({ label, holdingLabel = "Keep holding", doneLabel, onConfirm, ms = 1400, disabled, tone = "brand", className, size = "md", icon }: { label: ReactNode; holdingLabel?: ReactNode; doneLabel?: ReactNode; onConfirm: () => void; ms?: number; disabled?: boolean; tone?: "brand" | "xp" | "rose"; className?: string; size?: "md" | "lg"; icon?: ReactNode }) {
  const [holding, setHolding] = useState(false);
  const [hint, setHint] = useState(false);
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintId = useId();
  const start = () => {
    if (disabled || done || timer.current) return;
    setHolding(true);
    setHint(false);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      setDone(true);
      onConfirm();
    }, ms);
  };
  const stop = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
    setHint(true);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 2500);
    return () => clearTimeout(t);
  }, [done]);
  const base = { brand: "bg-brand-600 text-white", xp: "bg-ink text-white", rose: "bg-rose-600 text-white" }[tone];
  const fill = { brand: "bg-[var(--color-xp)] text-ink", xp: "bg-[var(--color-xp)] text-ink", rose: "bg-rose-800 text-white" }[tone];
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={disabled}
        aria-describedby={hintId}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") stop();
        }}
        onContextMenu={(e) => e.preventDefault()}
        style={{ ["--hold" as string]: `${ms}ms` }}
        className={cx(
          "press relative isolate inline-flex select-none items-center justify-center overflow-hidden font-semibold clay disabled:cursor-not-allowed disabled:opacity-50 [touch-action:none]",
          size === "lg" ? "min-h-12 rounded-2xl px-6 text-[15.5px]" : "min-h-11 rounded-xl px-4 text-[14px]",
          holding && "holding",
          base,
          className,
        )}
      >
        <span className="relative z-0 inline-flex items-center gap-2">
          {icon}
          {done ? doneLabel || label : holding ? holdingLabel : label}
        </span>
        <span className={cx("hold-fill absolute inset-0 z-10 inline-flex items-center justify-center gap-2", fill)} aria-hidden>
          {icon}
          {holding ? holdingLabel : label}
        </span>
      </button>
      <span id={hintId} className={cx("text-[12px]", hint ? "font-semibold text-ink" : "text-ink-3")}>
        {hint ? "Press and hold until the bar fills." : "Press and hold (or hold Space)"}
      </span>
    </span>
  );
}

/** Filter chips with live counts. Each chip is a toggle button (aria-pressed); counts update as the set changes. */
export function FilterChips<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string; count: number; tone?: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={cx(
              "press inline-flex min-h-10 items-center gap-2 rounded-full pl-3.5 pr-1.5 text-[13.5px] font-bold transition-[background-color,color,box-shadow] duration-200 pointer-coarse:min-h-11",
              on ? "bg-ink text-white shadow-e2" : "bg-surface text-ink-2 ring-1 ring-inset ring-line hover:ring-brand-300",
            )}
          >
            {o.label}
            <span key={o.count} className={cx("pop-spring grid h-7 min-w-7 place-items-center rounded-full px-1.5 font-mono text-[12px]", on ? o.tone || "bg-[var(--color-xp)] text-ink" : "bg-surface-2 text-ink-2")}>
              {o.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

type GameLevel = "on" | "minimal" | "off";
import { GAME_LAYER_KEY as KEY } from "./layer";

/** The per-device game layer switch (sunset control): On / Minimal (no ambient motion) / Off (no XP, ranks or streaks). */
export function GameLayerSwitch({ className }: { className?: string }) {
  const [level, setLevel] = useState<GameLevel>("on");
  useEffect(() => {
    let saved: GameLevel = "on";
    try {
      saved = (localStorage.getItem(KEY) as GameLevel) || "on";
    } catch {}
    // Reading a per-device preference after mount (the server cannot know it).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLevel(saved);
  }, []);
  const set = (l: GameLevel) => {
    setLevel(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
    document.documentElement.setAttribute("data-game", l);
  };
  return (
    <div className={cx("inline-flex rounded-full bg-surface-2 p-1 ring-1 ring-line", className)} role="radiogroup" aria-label="Game layer">
      {(["on", "minimal", "off"] as const).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={level === l}
          onClick={() => set(l)}
          className={cx("min-h-8 rounded-full px-3 text-[12.5px] font-bold capitalize transition-colors pointer-coarse:min-h-11", level === l ? "bg-ink text-white" : "text-ink-2 hover:text-ink")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
