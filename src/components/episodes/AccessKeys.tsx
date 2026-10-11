"use client";

import { Check, ChevronRight, Copy, KeyRound, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";

interface Key {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Copy a value to the clipboard, with a short "Copied" acknowledgement. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1600);
          },
          () => {},
        );
      }}
      className="press inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3 text-[12px] font-bold text-white pointer-coarse:min-h-11"
      aria-label={label}
    >
      {done ? <Check className="h-3.5 w-3.5 text-[var(--color-xp)]" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/** Personal keys for the episode API and the MCP endpoint. A new key is shown once. */
export default function AccessKeys({ origin }: { origin: string }) {
  const [keys, setKeys] = useState<Key[]>([]);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const load = () =>
    fetch("/api/keys")
      .then((r) => r.json())
      .then((j) => setKeys(j.keys || []));
  useEffect(() => {
    load();
  }, []);
  async function create() {
    const j = await (await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: label || "Assistant" }) })).json();
    setFresh(j.key);
    setLabel("");
    load();
  }
  async function revoke(id: string) {
    await fetch("/api/keys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }
  const cfg = JSON.stringify({ mcpServers: { poscere: { type: "http", url: `${origin}/api/mcp`, headers: { Authorization: `Bearer ${fresh || "<your key>"}` } } } }, null, 2);
  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        <p className="max-w-xl text-[14px] leading-relaxed text-ink-2">
          Connect an AI assistant or a script to your episodes. The MCP endpoint offers four tools (search episodes, read an episode, list patients, read a patient record) and returns only what your account is allowed to see.
        </p>
        <ul className="flex flex-wrap gap-1.5 lg:justify-end" aria-label="The four tools">
          {["Search episodes", "Read an episode", "List patients", "Read a patient record"].map((t, i) => (
            <li key={t} className="pop-spring rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-bold text-brand-800 ring-1 ring-inset ring-brand-200" style={{ ["--i" as string]: i }}>
              {t}
            </li>
          ))}
        </ul>
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <div className="relative w-full sm:max-w-sm">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What is this key for? e.g. Claude Desktop" aria-label="What is this key for?" className="pl-9" />
        </div>
        <Button type="submit" variant="secondary">
          <Plus className="h-4 w-4" aria-hidden />
          Create key
        </Button>
      </form>
      {fresh && (
        <div className="pop-spring rounded-2xl bg-[var(--color-tier-reluctant-soft)] p-3.5 ring-1 ring-inset ring-[var(--color-tier-reluctant)]/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px] font-bold text-[var(--color-tier-reluctant-ink)]">Copy this key now. It is not shown again.</div>
            <CopyButton value={fresh} label="Copy the new key" />
          </div>
          <code className="mt-2 block break-all rounded-xl bg-surface px-3 py-2 font-mono text-[13px] text-ink ring-1 ring-line">{fresh}</code>
        </div>
      )}
      {keys.length > 0 && (
        <ul className="space-y-2">
          {keys.map((k, i) => (
            <li key={k.id} className="pop-spring flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 px-3.5 py-2.5 ring-1 ring-inset ring-line/70" style={{ ["--i" as string]: i }}>
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--color-xp)] text-ink clay" aria-hidden>
                  <KeyRound className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-ink">{k.label}</span>
                  <span className="block break-all font-mono text-[11.5px] text-ink-3">
                    {k.id}… · {k.lastUsedAt ? "last used " + k.lastUsedAt + " UTC" : "never used"}
                  </span>
                </span>
              </span>
              <button onClick={() => revoke(k.id)} className="press inline-flex min-h-8 items-center rounded-full px-3 text-[12.5px] font-bold text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50 pointer-coarse:min-h-11">
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
      <details className="group rounded-2xl ring-1 ring-line open:bg-surface-2/50">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-3.5 text-[13px] font-bold text-ink-2">
          <ChevronRight className="h-4 w-4 transition-transform duration-200 group-open:rotate-90" aria-hidden />
          Connection details
        </summary>
        <div className="space-y-2 px-3.5 pb-3.5 text-xs text-ink-2">
          <p>
            MCP (Streamable HTTP): <code className="rounded bg-surface px-1 ring-1 ring-line">{origin}/api/mcp</code> with header <code className="rounded bg-surface px-1 ring-1 ring-line">Authorization: Bearer &lt;key&gt;</code>
          </p>
          <div className="relative">
            <pre className="scroll-quiet overflow-x-auto rounded-xl bg-stage p-3 pr-20 text-[12px] text-white">{cfg}</pre>
            <span className="absolute right-2 top-2">
              <CopyButton value={cfg} label="Copy the MCP configuration" />
            </span>
          </div>
          <p>
            REST: <code className="rounded bg-surface px-1 ring-1 ring-line">GET {origin}/api/episodes?patient=&amp;participant=&amp;role=&amp;text=</code> and <code className="rounded bg-surface px-1 ring-1 ring-line">?id=&lt;episode&gt;</code>, same header.
          </p>
        </div>
      </details>
    </div>
  );
}
