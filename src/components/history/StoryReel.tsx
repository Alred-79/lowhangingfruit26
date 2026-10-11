"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { usePrefersReducedMotion } from "@/components/motion";
import { cx } from "@/components/ui";
import "./history.css";

export interface Story {
  id: string;
  kicker: string;
  big: string;
  unit?: string;
  line: string;
  tone: "brand" | "xp" | "flame" | "mastery" | "ink";
  /** A small real series under the number (e.g. XP per visit), with what it shows in words. */
  bars?: number[];
  barsLabel?: string;
}

const TONE: Record<Story["tone"], string> = {
  brand: "bg-brand-600 text-white",
  xp: "bg-[var(--color-xp)] text-ink",
  flame: "bg-gradient-to-br from-[var(--color-flame-2)] to-[var(--color-flame)] text-ink",
  mastery: "bg-[var(--color-mastery)] text-white",
  ink: "bg-ink text-white",
};
const MS = 6000;

/**
 * "Your story so far": a Wrapped-style reel of real numbers, one card at a time. Advances by itself
 * every 6 s, driven by the progress bar's own animation (so it pauses with it: on hover, on focus, when
 * the tab is hidden; under reduced motion there is no animation and so no auto-advance);
 * prev/next buttons, pips and the arrow keys move it by hand.
 */
export default function StoryReel({ stories }: { stories: Story[] }) {
  const reduced = usePrefersReducedMotion();
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [hold, setHold] = useState(false);
  const [stopped, setStopped] = useState(false);
  const paused = hold || stopped || reduced;
  const go = (n: number, d = n > i ? 1 : -1) => {
    setDir(d);
    setI((n + stories.length) % stories.length);
  };
  const s = stories[i];
  const light = s.tone === "xp" || s.tone === "flame";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Your story so far"
      className={cx("rise relative flex h-full min-h-[300px] flex-col overflow-hidden rounded-[26px] p-5 clay transition-colors duration-300 sm:p-6", TONE[s.tone], paused && "hist-story-paused")}
      style={{ "--i": 3 } as CSSProperties}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHold(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(i + 1, 1);
        else if (e.key === "ArrowLeft") go(i - 1, -1);
        else return;
        e.preventDefault();
      }}
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full spin-slow [background:conic-gradient(from_0deg,transparent,rgb(255_255_255/0.22),transparent_45%)]" aria-hidden />
      <ol className="relative flex gap-1.5" aria-label="Stories">
        {stories.map((x, k) => (
          <li key={x.id} className="flex-1">
            <button type="button" onClick={() => go(k)} aria-label={`Story ${k + 1} of ${stories.length}: ${x.kicker}`} aria-current={k === i ? "true" : undefined} className="group block w-full py-2 pointer-coarse:py-4">
              <span className={cx("block h-1.5 overflow-hidden rounded-full", light ? "bg-ink/20" : "bg-white/25")}>
                <span key={k === i ? `on-${i}` : `off-${k}`} className={cx("block h-full rounded-full", light ? "bg-ink" : "bg-white", k === i ? "hist-story-fill" : k < i ? "w-full" : "w-0")}
                  style={{ "--story-ms": `${MS}ms` } as CSSProperties}
                  onAnimationEnd={() => k === i && !paused && stories.length > 1 && go(i + 1, 1)}
                />
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div key={s.id} className="hist-card-in relative mt-3 flex flex-1 flex-col" style={{ "--dir": dir } as CSSProperties} aria-live={paused ? "polite" : "off"}>
        <p className={cx("text-[13.5px] font-bold", light ? "text-ink" : "text-white/90")}>{s.kicker}</p>
        <p className="mt-2 font-display text-[clamp(3.2rem,7vw,4.6rem)] font-black leading-[0.85] tracking-[-0.04em]">
          {s.big}
          {s.unit && <span className="ml-1.5 text-[0.36em] tracking-[-0.01em]">{s.unit}</span>}
        </p>
        <p className={cx("mt-3 max-w-sm text-[15px] font-semibold leading-snug", light ? "text-ink" : "text-white")}>{s.line}</p>
        {s.bars && s.bars.length > 0 && (
          <figure className="mt-auto pt-4">
            <div className="flex h-20 items-end gap-[3px]" role="img" aria-label={s.barsLabel}>
              {s.bars.map((b, k) => {
                const max = Math.max(...s.bars!, 1);
                return <span key={k} className={cx("hist-grow-y min-w-0 flex-1 rounded-t-[4px]", light ? "bg-ink" : "bg-white/85", b === 0 && "opacity-25")} style={{ height: `${Math.max(6, (b / max) * 100)}%`, "--i": k } as CSSProperties} />;
              })}
            </div>
            <figcaption className={cx("mt-1.5 text-[11.5px] font-bold", light ? "text-ink" : "text-white/85")}>{s.barsLabel}</figcaption>
          </figure>
        )}
      </div>
      <div className="relative mt-4 flex items-center justify-between gap-2">
        <span className={cx("font-mono text-[12px] font-bold", light ? "text-ink" : "text-white/85")}>
          {i + 1} / {stories.length}
        </span>
        <div className="flex gap-1.5">
          {!reduced && (
            <button type="button" onClick={() => setStopped(!stopped)} aria-label={stopped ? "Play the stories" : "Pause the stories"} className={cx("press grid h-10 w-10 place-items-center rounded-full pointer-coarse:h-11 pointer-coarse:w-11", light ? "bg-ink/10 hover:bg-ink/20" : "bg-white/15 hover:bg-white/25")}>
              {stopped ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
            </button>
          )}
          <button type="button" onClick={() => go(i - 1, -1)} aria-label="Previous story" className={cx("press grid h-10 w-10 place-items-center rounded-full pointer-coarse:h-11 pointer-coarse:w-11", light ? "bg-ink/10 hover:bg-ink/20" : "bg-white/15 hover:bg-white/25")}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={() => go(i + 1, 1)} aria-label="Next story" className={cx("press grid h-10 w-10 place-items-center rounded-full pointer-coarse:h-11 pointer-coarse:w-11", light ? "bg-ink text-white" : "bg-white text-ink")}>
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}
