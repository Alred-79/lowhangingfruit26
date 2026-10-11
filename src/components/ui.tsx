import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import TrustLabel, { type TrustKind } from "./TrustLabel";

// Shared primitives. Every export keeps the name and props it had before the redesign; new options
// are additive. Tokens come from globals.css (03-design-system.md).

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

// Clay buttons: chunky, an inner top highlight, a colored drop that deepens on hover.
const BTN = {
  primary:
    "bg-brand-600 text-white shadow-[inset_0_1.5px_0_rgb(255_255_255/0.22),inset_0_-2px_0_rgb(0_0_40/0.18),0_8px_18px_-8px_oklch(0.45_0.24_266/0.7)] hover:bg-brand-500 hover:shadow-[inset_0_1.5px_0_rgb(255_255_255/0.22),inset_0_-2px_0_rgb(0_0_40/0.18),0_12px_24px_-8px_oklch(0.5_0.25_266/0.75)] disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none",
  secondary: "bg-surface text-ink ring-1 ring-inset ring-line-strong/50 shadow-e1 hover:bg-brand-50 hover:ring-brand-300 disabled:bg-surface disabled:text-slate-400 disabled:ring-slate-200",
  danger: "bg-rose-600 text-white shadow-[inset_0_1.5px_0_rgb(255_255_255/0.2),0_8px_18px_-8px_rgb(225_29_72/0.6)] hover:bg-rose-500 disabled:bg-rose-200 disabled:text-rose-800 disabled:shadow-none",
  ghost: "text-ink-2 hover:bg-brand-50 hover:text-brand-800 disabled:text-slate-400 disabled:hover:bg-transparent",
  subtle: "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200 hover:bg-brand-100 disabled:text-slate-400",
};
const SIZE = {
  sm: "min-h-8 px-3 text-[13px] gap-1.5 rounded-[10px] pointer-coarse:min-h-11",
  md: "min-h-10 px-4 text-[14px] gap-2 rounded-xl pointer-coarse:min-h-11",
  lg: "min-h-12 px-6 text-[15.5px] gap-2 rounded-2xl",
};
type BtnProps = { variant?: keyof typeof BTN; size?: keyof typeof SIZE };
const BASE = "press inline-flex select-none items-center justify-center font-semibold leading-tight transition-[background-color,color,box-shadow,transform] duration-150 disabled:cursor-not-allowed";

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & BtnProps) {
  return <button {...p} className={cx(BASE, BTN[variant], SIZE[size], className)} />;
}
export function LinkButton({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & BtnProps) {
  return <Link {...p} className={cx(BASE, BTN[variant], SIZE[size], className)} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div {...p} className={cx("rounded-[20px] border border-line/80 bg-surface shadow-e1", className)} />;
}
export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-line/70 px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="font-display text-[16.5px] font-bold tracking-[-0.015em] text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 max-w-3xl text-[13px] leading-relaxed text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const TONES = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-100/80 text-emerald-900 ring-emerald-300/70",
  amber: "bg-amber-100/80 text-amber-900 ring-amber-300/70",
  red: "bg-rose-100/80 text-rose-900 ring-rose-300/70",
  blue: "bg-sky-100/80 text-sky-900 ring-sky-300/70",
  teal: "bg-brand-100 text-brand-800 ring-brand-300/70",
  violet: "bg-violet-100/80 text-violet-900 ring-violet-300/70",
};
export function Badge({ tone = "slate", className, ...p }: ComponentProps<"span"> & { tone?: keyof typeof TONES }) {
  return <span {...p} className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold leading-4 ring-1 ring-inset", TONES[tone], className)} />;
}

const FIELD =
  "w-full rounded-xl border border-line-strong/50 bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-500 transition-[border-color,box-shadow] duration-150 hover:border-brand-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-500 pointer-coarse:min-h-11";
export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input {...p} className={cx(FIELD, className)} />;
}
export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea {...p} className={cx(FIELD, "leading-relaxed", className)} />;
}
export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select {...p} className={cx(FIELD, "cursor-pointer pr-8", className)} />;
}
export function Label({ className, ...p }: ComponentProps<"label">) {
  return <label {...p} className={cx("mb-1.5 block text-[12.5px] font-medium text-ink-2", className)} />;
}

export function PageHeader({ title, subtitle, action, eyebrow, meta }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; eyebrow?: ReactNode; meta?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <div className="rise mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-[12.5px] font-semibold text-brand-800">{eyebrow}</div>}
        <h1 className="rise font-display text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[40px]" style={{ ["--i" as string]: 1 }}>{title}</h1>
        {subtitle && <p className="rise mt-2 max-w-2xl text-[15.5px] leading-relaxed text-ink-2" style={{ ["--i" as string]: 2 }}>{subtitle}</p>}
        {meta && <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{meta}</div>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function Empty({ children, title, action, icon }: { children: ReactNode; title?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-[20px] border-2 border-dashed border-brand-200 bg-surface/70 px-5 py-10 text-center">
      {icon && <div className="float-idle mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700 clay">{icon}</div>}
      {title && <p className="font-display text-[19px] font-bold tracking-[-0.015em] text-ink">{title}</p>}
      <div className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-ink-3">{children}</div>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** A number with its label: tabular figures, optional link. */
export function Stat({ label, value, note, href, tone }: { label: ReactNode; value: ReactNode; note?: ReactNode; href?: string; tone?: "default" | "alert" | "live" }) {
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3">
        {tone === "live" && <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />}
        {label}
      </div>
      <div className={cx("mt-1.5 font-display text-[32px] font-extrabold leading-none tracking-[-0.03em] tabular", tone === "alert" ? "text-rose-700" : "text-ink")}>{value}</div>
      {note && <div className="mt-1.5 text-[12.5px] leading-snug text-ink-3">{note}</div>}
    </>
  );
  const cls = "block rounded-[20px] border border-line/80 bg-surface p-4 shadow-e1";
  return href ? (
    <Link href={href} className={cx(cls, "press transition-colors hover:border-brand-300 hover:bg-brand-50/40")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Horizontal value bar with its number as text (never colour alone). */
export function Meter({ value, max = 100, tone = "brand", label, className }: { value: number; max?: number; tone?: "brand" | "amber" | "rose" | "emerald" | "slate" | "xp" | "flame" | "mastery"; label: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill = { brand: "bg-gradient-to-r from-brand-500 to-brand-400", amber: "bg-amber-500", rose: "bg-rose-500", emerald: "bg-emerald-500", slate: "bg-slate-400", xp: "bg-[var(--color-xp)]", flame: "bg-gradient-to-r from-[var(--color-flame)] to-[var(--color-flame-2)]", mastery: "bg-[var(--color-mastery)]" }[tone];
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} className={cx("h-2 overflow-hidden rounded-full bg-slate-200/80", className)}>
      <div className={cx("shimmer h-full origin-left rounded-full transition-transform duration-700 ease-[var(--ease-spring)]", fill)} style={{ transform: `scaleX(${pct / 100})` }} />
    </div>
  );
}

/** A small titled group label used inside cards and panels. */
export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-2 flex items-center justify-between gap-2", className)}>
      <h3 className="font-display text-[14px] font-bold tracking-[-0.01em] text-ink-2">{children}</h3>
      {action}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-surface-2 px-1 font-mono text-[11px] text-ink-3">{children}</kbd>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-slate-200/70", className)} aria-hidden />;
}

export { cx, TrustLabel };
export type { TrustKind };
