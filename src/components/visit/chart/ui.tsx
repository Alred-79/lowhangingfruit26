import type { ReactNode } from "react";
import type { Flag } from "./derive";

/** Shared look of the chart: light grey chrome, blue section bars, tight zebra tables. */

export const LINK = "text-[#1a5eb0] hover:underline";

export function Bar({ title, right, children, tone = "blue" }: { title: ReactNode; right?: ReactNode; children?: ReactNode; tone?: "blue" | "red" | "grey" }) {
  const t = tone === "red" ? "bg-[#f6d7d7] text-[#8a1010] border-[#e0aaaa]" : tone === "grey" ? "bg-[#e6eaef] text-[#2b3a4c] border-[#c3ccd7]" : "bg-[#d5e0ed] text-[#16365c] border-[#b3c4d8]";
  return (
    <section className="border border-[#b9c4d1] bg-white">
      <div className={`flex items-center justify-between gap-2 border-b px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${t}`}>
        <span className="min-w-0 truncate">{title}</span>
        {right && <span className="shrink-0 font-normal normal-case tracking-normal">{right}</span>}
      </div>
      {children}
    </section>
  );
}

export const TH = "border-b border-[#b9c4d1] bg-[#eef2f6] px-2 py-1 text-left text-xs font-semibold uppercase tracking-wide text-[#44556b]";
export const TD = "px-2 py-1 align-top";
export const ROW = "border-b border-[#e3e9ef] odd:bg-white even:bg-[#f5f8fb]";

export function NewBadge({ children = "New" }: { children?: ReactNode }) {
  return <span className="inline-block rounded-sm bg-[#f4c20d] px-1.5 text-xs font-bold leading-4 text-[#4a3800]">{children}</span>;
}

export function Count({ n }: { n: number }) {
  return <span className="rounded-full bg-[#c62828] px-1.5 text-xs font-bold leading-4 text-white">{n}</span>;
}

/** A result value with Epic-style abnormal marking: red and bold, with a flag letter. */
export function Value({ v, flag }: { v: string; flag?: Flag }) {
  if (!flag) return <span className="text-[#1a1a1a]">{v}</span>;
  const cls = flag === "L" ? "bg-[#dbe9fb] text-[#0b3f8f]" : "bg-[#fbdcdc] text-[#b00000]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-1 font-bold ${cls}`}>
      {v}
      <span className="text-xs">{flag === "A" ? "!" : flag}</span>
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-3 py-5 text-center text-sm italic text-[#5d6b7c]">{children}</div>;
}
