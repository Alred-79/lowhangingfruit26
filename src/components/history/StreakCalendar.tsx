"use client";

import { Flame } from "lucide-react";
import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { cx } from "@/components/ui";
import "./history.css";

export interface CalDay {
  date: string;
  count: number;
  grace: boolean;
  isToday: boolean;
  future: boolean;
}

const NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const long = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const short = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
// Sequential ramp, one hue (ink, hue 271) light to dark, solid steps on the flame cell: more visits, darker day.
const shade = (n: number) => (n <= 0 ? "bg-white/45" : n === 1 ? "bg-[oklch(0.62_0.14_271)]" : n === 2 ? "bg-[oklch(0.44_0.13_271)]" : "bg-ink");

function readout(d: CalDay) {
  if (d.future) return `${long(d.date)}: still ahead`;
  if (d.grace) return `${long(d.date)}: grace day. One missed day is bridged per week of streak, so your run kept going.`;
  if (d.count) return `${long(d.date)}: ${d.count} visit${d.count === 1 ? "" : "s"} finished`;
  return `${long(d.date)}: no visit${d.isToday ? " yet today" : ""}`;
}

/**
 * The streak calendar: the last weeks as a grid (columns are weeks, rows are weekdays), shaded by
 * how many visits were finished that day, grace days dashed, today ringed. Roving focus: one tab
 * stop, arrow keys move by day (up/down) and week (left/right); the readout follows hover and focus.
 */
export default function StreakCalendar({ days }: { days: CalDay[] }) {
  const todayIdx = Math.max(0, days.findIndex((d) => d.isToday));
  const [sel, setSel] = useState<number | null>(null);
  const [focusIdx, setFocusIdx] = useState(todayIdx);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const weeks = Math.ceil(days.length / 7);
  const shown = sel ?? todayIdx;
  const active = days.filter((d) => d.count > 0).length;

  function key(e: KeyboardEvent) {
    const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7, Home: -focusIdx, End: days.length - 1 - focusIdx }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(days.length - 1, focusIdx + step));
    setFocusIdx(next);
    setSel(next);
    refs.current[next]?.focus();
  }

  return (
    <div>
      <div className="flex gap-1.5">
        <ol className="grid shrink-0 grid-rows-7 gap-[3px] pt-5 text-[10.5px] font-bold leading-none opacity-80" aria-hidden>
          {NAMES.map((n, i) => (
            <li key={n} className="flex h-[clamp(14px,3.4vw,20px)] items-center">
              {i % 2 ? n.slice(0, 1) : ""}
            </li>
          ))}
        </ol>
        <div className="min-w-0 flex-1">
          <div className="grid h-5 text-[10.5px] font-bold opacity-80" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }} aria-hidden>
            {Array.from({ length: weeks }, (_, w) => {
              const d = days[w * 7];
              const first = w === 0 || d.date.slice(5, 7) !== days[(w - 1) * 7].date.slice(5, 7);
              return <span key={w}>{first ? short(d.date).split(" ")[0] : ""}</span>;
            })}
          </div>
          <div role="group" aria-label={`Practice calendar, last ${weeks} weeks: ${active} active days. Use the arrow keys to move between days.`} className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }} onKeyDown={key} onMouseLeave={() => setSel(null)}>
            {days.map((d, i) => (
              <button
                key={d.date}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                tabIndex={i === focusIdx ? 0 : -1}
                aria-label={readout(d)}
                onMouseEnter={() => setSel(i)}
                onFocus={() => {
                  setFocusIdx(i);
                  setSel(i);
                }}
                className={cx(
                  "hist-cell grid h-[clamp(14px,3.4vw,20px)] w-full place-items-center rounded-[5px] outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1",
                  d.future ? "border border-ink/15" : d.grace ? "border-2 border-dashed border-ink/70 bg-white/30" : shade(d.count),
                  d.isToday && "ring-2 ring-white ring-offset-1 ring-offset-ink/60",
                  shown === i && "scale-110",
                )}
                style={{ "--c": Math.floor(i / 7) } as CSSProperties}
              >
                {d.count >= 3 && <Flame className="h-2.5 w-2.5 text-[var(--color-flame-2)]" aria-hidden />}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 min-h-[2.6em] text-[13px] font-semibold leading-snug" aria-live="polite">
        {readout(days[shown])}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] font-bold" aria-hidden>
        <span className="inline-flex items-center gap-1">
          Fewer
          {[0, 1, 2, 3].map((n) => (
            <i key={n} className={cx("inline-block h-3 w-3 rounded-[3px]", shade(n))} />
          ))}
          More visits
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-[3px] border-2 border-dashed border-ink/70" />
          Grace day
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-[3px] ring-2 ring-white" />
          Today
        </span>
      </div>
    </div>
  );
}
