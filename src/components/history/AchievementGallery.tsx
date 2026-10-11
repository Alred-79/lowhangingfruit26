import { Award, Check, Flame, KeyRound, Lock, Mountain, Repeat, Route, Sparkles, Star, Trophy } from "lucide-react";
import type { CSSProperties } from "react";
import { cx } from "@/components/ui";
import "./history.css";

export interface GalleryItem {
  id: string;
  title: string;
  detail: string;
  got: boolean;
  icon: "spark" | "five" | "ten" | "flame" | "blaze" | "star" | "key" | "mountain" | "route" | "repeat";
  tone: "xp" | "flame" | "mastery" | "tier";
  /** Countable progress toward the badge, when the rule is a count (visits, streak days). */
  progress?: { have: number; need: number; unit: string };
}

const ICONS = { spark: Sparkles, five: Award, ten: Trophy, flame: Flame, blaze: Flame, star: Star, key: KeyRound, mountain: Mountain, route: Route, repeat: Repeat };
const TILE: Record<GalleryItem["tone"], string> = {
  xp: "bg-[var(--color-xp)] text-ink",
  flame: "bg-gradient-to-b from-[var(--color-flame-2)] to-[var(--color-flame)] text-ink",
  mastery: "bg-[var(--color-mastery)] text-white",
  tier: "bg-[var(--color-tier-initial)] text-white",
};
const WASH: Record<GalleryItem["tone"], string> = {
  xp: "bg-[var(--color-xp-soft)]",
  flame: "bg-[var(--color-flame-soft)]",
  mastery: "bg-[var(--color-mastery-soft)]",
  tier: "bg-[var(--color-tier-initial-soft)]",
};
const v = (o: Record<string, string | number>) => o as CSSProperties;

/** Every badge, won or not, with the rule that unlocks it and (for counts) how close you are. */
export default function AchievementGallery({ items }: { items: GalleryItem[] }) {
  return (
    <ul className="grid gap-2.5 sm:grid-cols-2">
      {items.map((a, i) => {
        const Icon = ICONS[a.icon];
        const pct = a.progress ? Math.min(100, (a.progress.have / a.progress.need) * 100) : a.got ? 100 : 0;
        return (
          <li key={a.id} className={cx("pop-spring lift flex items-start gap-3 rounded-2xl p-3", a.got ? WASH[a.tone] : "bg-surface-2 ring-1 ring-inset ring-line")} style={v({ "--i": i })}>
            <span className={cx("relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl", a.got ? cx(TILE[a.tone], "clay shimmer") : "border-2 border-dashed border-line-strong/60 bg-surface text-ink-3")} style={v({ "--sd": `${i * 0.6}s` })}>
              <Icon className={cx("h-6 w-6", !a.got && "opacity-40")} strokeWidth={2.2} aria-hidden />
              {!a.got && (
                <span className="hist-wobble absolute -bottom-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-white" style={v({ "--i": i })}>
                  <Lock className="h-3 w-3" aria-hidden />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[14.5px] font-bold leading-tight text-ink">{a.title}</span>
                {a.got ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-ink px-1.5 py-0.5 text-[11px] font-bold text-white">
                    <Check className="h-3 w-3" aria-hidden />
                    Unlocked
                  </span>
                ) : (
                  <span className="rounded-full bg-surface px-1.5 py-0.5 text-[11px] font-bold text-ink-2 ring-1 ring-line">Locked</span>
                )}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-2">{a.got ? a.detail : `To unlock: ${a.detail.charAt(0).toLowerCase()}${a.detail.slice(1)}`}</span>
              {a.progress && !a.got && (
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface ring-1 ring-inset ring-line" role="meter" aria-label={`${a.title} progress`} aria-valuemin={0} aria-valuemax={a.progress.need} aria-valuenow={a.progress.have}>
                    <span className="bar-grow block h-full rounded-full bg-ink" style={{ width: `${Math.max(4, pct)}%` }} />
                  </span>
                  <span className="whitespace-nowrap font-mono text-[11.5px] font-bold text-ink">
                    {a.progress.have}/{a.progress.need} {a.progress.unit}
                  </span>
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
