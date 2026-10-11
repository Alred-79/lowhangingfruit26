import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import TrustLabel, { type TrustKind } from "./TrustLabel";

// Shared primitives. Every export keeps the name and props it had before the redesign; new options
// are additive. Tokens come from globals.css (03-design-system.md).

const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

const BTN = {
  primary: "bg-brand-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(4_54_49/0.25)] hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none",
  secondary: "bg-surface text-ink ring-1 ring-inset ring-slate-300 hover:bg-slate-50 hover:ring-slate-400 disabled:bg-surface disabled:text-slate-400 disabled:ring-slate-200",
  danger: "bg-rose-600 text-white hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-500",
  ghost: "text-slate-700 hover:bg-slate-100 hover:text-ink disabled:text-slate-400 disabled:hover:bg-transparent",
  subtle: "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200 hover:bg-brand-100 disabled:text-slate-400",
};
const SIZE = {
  sm: "min-h-8 px-2.5 text-[13px] gap-1.5 rounded-md pointer-coarse:min-h-11",
  md: "min-h-9 px-3.5 text-sm gap-2 rounded-lg pointer-coarse:min-h-11",
  lg: "min-h-11 px-5 text-[15px] gap-2 rounded-lg",
};
type BtnProps = { variant?: keyof typeof BTN; size?: keyof typeof SIZE };
const BASE = "press inline-flex select-none items-center justify-center font-medium leading-tight transition-[background-color,color,box-shadow,transform] duration-150 disabled:cursor-not-allowed";

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & BtnProps) {
  return <button {...p} className={cx(BASE, BTN[variant], SIZE[size], className)} />;
}
export function LinkButton({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & BtnProps) {
  return <Link {...p} className={cx(BASE, BTN[variant], SIZE[size], className)} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div {...p} className={cx("rounded-xl border border-line bg-surface", className)} />;
}
export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-line/70 px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 max-w-3xl text-[12.5px] leading-relaxed text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const TONES = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-800 ring-rose-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  teal: "bg-brand-50 text-brand-800 ring-brand-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
};
export function Badge({ tone = "slate", className, ...p }: ComponentProps<"span"> & { tone?: keyof typeof TONES }) {
  return <span {...p} className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium leading-4 ring-1 ring-inset", TONES[tone], className)} />;
}

const FIELD =
  "w-full rounded-lg border border-line-strong/60 bg-surface px-3 py-2 text-sm text-ink placeholder:text-slate-500 transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/20 disabled:bg-slate-50 disabled:text-slate-500 pointer-coarse:min-h-11";
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
        {eyebrow && <div className="mb-1.5 text-[12.5px] font-medium text-brand-700">{eyebrow}</div>}
        <h1 className="font-display text-[26px] font-semibold leading-tight text-ink sm:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-2">{subtitle}</p>}
        {meta && <div className="mt-2.5 flex flex-wrap items-center gap-1.5">{meta}</div>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function Empty({ children, title, action, icon }: { children: ReactNode; title?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-surface/60 px-5 py-9 text-center">
      {icon && <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500">{icon}</div>}
      {title && <p className="font-display text-[17px] font-semibold text-ink">{title}</p>}
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
      <div className={cx("mt-1 font-display text-[28px] font-semibold leading-none tabular", tone === "alert" ? "text-rose-700" : "text-ink")}>{value}</div>
      {note && <div className="mt-1.5 text-[12.5px] leading-snug text-ink-3">{note}</div>}
    </>
  );
  const cls = "block rounded-xl border border-line bg-surface p-4";
  return href ? (
    <Link href={href} className={cx(cls, "press transition-colors hover:border-brand-300 hover:bg-brand-50/40")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Horizontal value bar with its number as text (never colour alone). */
export function Meter({ value, max = 100, tone = "brand", label, className }: { value: number; max?: number; tone?: "brand" | "amber" | "rose" | "emerald" | "slate"; label: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill = { brand: "bg-brand-500", amber: "bg-amber-500", rose: "bg-rose-500", emerald: "bg-emerald-500", slate: "bg-slate-400" }[tone];
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} className={cx("h-1.5 overflow-hidden rounded-full bg-slate-200/80", className)}>
      <div className={cx("h-full origin-left rounded-full transition-transform duration-700 ease-[var(--ease-in-out-ui)]", fill)} style={{ transform: `scaleX(${pct / 100})` }} />
    </div>
  );
}

/** A small titled group label used inside cards and panels. */
export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-2 flex items-center justify-between gap-2", className)}>
      <h3 className="text-[13px] font-semibold text-ink-2">{children}</h3>
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
