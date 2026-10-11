"use client";

import { useEffect, type ReactNode } from "react";
import { CheckCircle2, Info, OctagonAlert, Trash2, TriangleAlert, X } from "lucide-react";
import { Button, cx, Input, Label, Textarea } from "@/components/ui";

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">{hint}</p>}
    </div>
  );
}

export function Text({ label, hint, value, onChange, className, ...p }: { label?: ReactNode; hint?: ReactNode; value: string | number; onChange: (v: string) => void; className?: string } & Omit<React.ComponentProps<"input">, "value" | "onChange" | "className">) {
  const input = <Input {...p} value={value} onChange={(e) => onChange(e.target.value)} />;
  return label ? (
    <Field label={label} hint={hint} className={className}>
      {input}
    </Field>
  ) : (
    <div className={className}>{input}</div>
  );
}

/** Textarea that grows with its content. */
export function Area({ label, hint, value, onChange, className, minRows = 2, dense, ...p }: { label?: ReactNode; hint?: ReactNode; value: string; onChange: (v: string) => void; className?: string; minRows?: number; dense?: boolean } & Omit<React.ComponentProps<"textarea">, "value" | "onChange" | "className">) {
  const rows = Math.max(minRows, Math.min(14, value.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 70)), 0)));
  const area = <Textarea {...p} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} style={{ minHeight: `${minRows * (dense ? 1.4 : 1.65) + (dense ? 0.8 : 1.2)}em` }} className={cx("[field-sizing:content] resize-y", dense && "px-2 py-1.5 text-[13px] leading-snug")} />;
  return label ? (
    <Field label={label} hint={hint} className={className}>
      {area}
    </Field>
  ) : (
    <div className={className}>{area}</div>
  );
}

/** Editable list of short strings, one row each. */
export function StringList({ label, hint, items, onChange, placeholder, addLabel = "Add" }: { label?: ReactNode; hint?: ReactNode; items: string[]; onChange: (v: string[]) => void; placeholder?: string; addLabel?: string }) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <Area dense minRows={1} className="flex-1" value={it} placeholder={placeholder} onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} />
            <RemoveButton label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))} />
          </div>
        ))}
      </div>
      <Button type="button" variant="ghost" size="sm" className="mt-1.5" onClick={() => onChange([...items, ""])}>
        + {addLabel}
      </Button>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function RemoveButton({ onClick, label = "Delete" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="press mt-0.5 inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-1.5 text-[12px] font-semibold text-ink-3 transition-colors hover:bg-rose-50 hover:text-rose-700 pointer-coarse:min-h-11">
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

export function Panel({ title, subtitle, action, children, className, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <section className={cx("rise rounded-[22px] border border-line/80 bg-surface shadow-e1", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line/70 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">{icon}</span>}
          <div className="min-w-0">
            <h2 className="font-display text-[18px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{title}</h2>
            {subtitle && <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-3">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Dialog({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="scrim-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={cx("pop-in w-full overflow-hidden rounded-[26px] bg-surface shadow-e3", wide ? "max-w-4xl" : "max-w-xl")}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
          <h2 className="font-display text-[22px] font-black tracking-[-0.025em] text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="press inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-[13.5px] font-semibold text-ink-3 hover:bg-slate-100 hover:text-ink pointer-coarse:min-h-11">
            <X className="h-4 w-4" aria-hidden />
            Close
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-start justify-end gap-2 border-t border-line bg-surface-2/60 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

const NOTICE_ICON = { slate: Info, amber: TriangleAlert, red: OctagonAlert, green: CheckCircle2, teal: Info };

/** A tinted callout with a leading icon in its tone (never a side stripe). */
export function Notice({ tone = "slate", children, className }: { tone?: "slate" | "amber" | "red" | "green" | "teal"; children: ReactNode; className?: string }) {
  const tones = {
    slate: "border-line bg-surface-2 text-ink-2",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    red: "border-rose-200 bg-rose-50 text-rose-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-950",
    teal: "border-brand-200 bg-brand-50 text-brand-950",
  };
  const iconTone = { slate: "text-ink-3", amber: "text-amber-600", red: "text-rose-600", green: "text-emerald-600", teal: "text-brand-600" };
  const Icon = NOTICE_ICON[tone];
  return (
    <div className={cx("flex gap-2.5 rounded-2xl border px-3.5 py-2.5 text-[14px] leading-relaxed", tones[tone], className)}>
      <Icon className={cx("mt-[3px] h-4 w-4 shrink-0", iconTone[tone])} aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Reads `await res.json()` and throws on { error } or a non-2xx status. */
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init || {};
  const res = await fetch(url, json === undefined ? rest : { ...rest, method: rest.method || "POST", headers: { "Content-Type": "application/json", ...(rest.headers || {}) }, body: JSON.stringify(json) });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    throw new Error(res.ok ? "The server sent an unreadable reply." : `Request failed (${res.status}).`);
  }
  const err = (data as { error?: string } | null)?.error;
  if (err || !res.ok) throw Object.assign(new Error(err || `Request failed (${res.status}).`), { status: res.status, data });
  return data as T;
}

/** Starts a visit with the case and returns the encounter URL. Faculty may start drafts. */
export async function startTestVisit(caseId: string): Promise<string> {
  const { id } = await api<{ id: string }>("/api/encounters", { json: { caseId } });
  return `/encounter/${id}`;
}
