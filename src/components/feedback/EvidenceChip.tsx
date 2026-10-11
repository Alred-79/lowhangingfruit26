"use client";

import { CheckCircle2, MessageSquareQuote } from "lucide-react";
import { useId, useState } from "react";

/**
 * A verified quote from the transcript. The chip shows the turn and that code found the quote; the
 * quote itself opens on hover (fine pointers), on keyboard focus, or on tap, and stays open on click.
 */
export default function EvidenceChip({ quote, turn }: { quote: string; turn?: number }) {
  const [pinned, setPinned] = useState(false);
  const [peek, setPeek] = useState(false);
  const id = useId();
  const open = pinned || peek;
  return (
    <span className="relative inline-block max-w-full" onPointerEnter={(e) => e.pointerType === "mouse" && setPeek(true)} onPointerLeave={() => setPeek(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setPinned((p) => !p)}
        onFocus={() => setPeek(true)}
        onBlur={() => setPeek(false)}
        className={`press inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full py-1 pl-1.5 pr-3 text-left text-[12.5px] font-semibold ring-1 ring-inset transition-colors pointer-coarse:min-h-11 ${open ? "bg-brand-600 text-white ring-brand-600" : "bg-brand-50 text-brand-800 ring-brand-200 hover:bg-brand-100"}`}
      >
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${open ? "bg-white/20" : "bg-brand-600 text-white"}`}>
          <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="truncate italic">&ldquo;{quote.length > 44 ? quote.slice(0, 42).trimEnd() + "…" : quote}&rdquo;</span>
        {turn !== undefined && turn !== null && <span className={`shrink-0 rounded px-1 font-mono text-[11px] not-italic ${open ? "bg-white/20" : "bg-white text-ink-2"}`}>T{turn}</span>}
      </button>
      <span id={id} role="region" aria-label="Quote from the transcript" hidden={!open} className="pop-in mt-1.5 block rounded-2xl bg-surface p-3 text-[13.5px] leading-relaxed shadow-e2 ring-1 ring-line">
        <span className="italic text-ink">&ldquo;{quote}&rdquo;</span>
        <span className="mt-1.5 flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          found in transcript
          {turn !== undefined && turn !== null && (
            <a href={`#t${turn}`} className="ml-1 rounded bg-slate-100 px-1 font-mono text-[11px] text-ink-2 hover:bg-brand-100">
              T{turn}
            </a>
          )}
        </span>
      </span>
    </span>
  );
}
