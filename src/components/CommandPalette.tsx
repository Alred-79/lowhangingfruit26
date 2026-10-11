"use client";

import { CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export interface Command {
  label: string;
  href: string;
  hint?: string;
}

/**
 * Jump anywhere with Cmd+K / Ctrl+K. Opened from the keyboard many times a day, so it has no
 * open/close animation (emil-design-eng frequency rule). Navigation only: every action still
 * lives on its own page.
 */
export default function CommandPalette({ commands, open, setOpen }: { commands: Command[]; open: boolean; setOpen: (v: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? commands.filter((c) => `${c.label} ${c.hint || ""}`.toLowerCase().includes(n)) : commands;
  }, [q, commands]);

  if (!open) return null;
  const close = () => {
    setOpen(false);
    setQ("");
    setI(0);
  };
  const go = (c?: Command) => {
    if (!c) return;
    close();
    router.push(c.href);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/30 p-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label="Go to" className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-e3">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setI(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              else if (e.key === "Enter") go(shown[i]);
              else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setI((x) => (e.key === "ArrowDown" ? Math.min(shown.length - 1, x + 1) : Math.max(0, x - 1)));
              }
            }}
            placeholder="Go to a page"
            aria-label="Go to a page"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={shown[i] ? `cmdk-${i}` : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-slate-500"
          />
          <kbd className="rounded border border-line bg-surface-2 px-1.5 font-mono text-[11px] text-ink-3">Esc</kbd>
        </div>
        <ul id="cmdk-list" role="listbox" className="scroll-quiet max-h-80 overflow-y-auto p-1.5">
          {shown.length === 0 && <li className="px-3 py-6 text-center text-[13.5px] text-ink-3">Nothing matches.</li>}
          {shown.map((c, k) => (
            <li
              key={c.href + c.label}
              id={`cmdk-${k}`}
              role="option"
              aria-selected={k === i}
              onMouseEnter={() => setI(k)}
              onClick={() => go(c)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[14px] ${k === i ? "bg-brand-50 text-brand-950" : "text-ink"}`}
            >
              <span>
                {c.label}
                {c.hint && <span className="ml-2 text-[12.5px] text-ink-3">{c.hint}</span>}
              </span>
              {k === i && <CornerDownLeft className="h-3.5 w-3.5 text-brand-700" aria-hidden />}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
