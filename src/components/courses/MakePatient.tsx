"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ErrorNote from "@/components/ErrorNote";
import { Button, Select, Textarea } from "@/components/ui";

const IDEAS = [
  "An anxious first-time parent who has read a lot online and questions everything I say",
  "An older man who downplays his symptoms and does not want to bother anyone",
  "A teenager who answers in one word until I earn some trust",
  "Someone who has stopped a medication and has not told anyone",
];

/** Lets a student ask for a private practice patient in their own words. */
export default function MakePatient({ roleName }: { roleName: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [level, setLevel] = useState("2");
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);
  async function go() {
    setBusy(true);
    setSecs(0);
    setError("");
    try {
      const res = await fetch("/api/practice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: text, level: Number(level) }) });
      const j = await res.json();
      if (j.error || !j.id) throw new Error(j.error || "The patient could not be created.");
      router.push(`/encounter/${j.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  if (busy) {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl bg-brand-50 px-4 py-3 text-[14px] text-brand-950 ring-1 ring-inset ring-brand-200">
        <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        <span>
          Writing your patient&apos;s history, chart and test results. This usually takes one to two minutes. {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
          {secs > 150 ? " — still working; a long case takes longer." : ""}
        </span>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Textarea aria-label="Describe the practice patient" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={1500} placeholder={`Describe a patient, or a skill you want to practise as ${roleName}`} />
      <div className="flex flex-wrap gap-1.5">
        {IDEAS.map((i) => (
          <button key={i} type="button" onClick={() => setText(i)} className="press rounded-full bg-surface-2 px-2.5 py-1 text-left text-[12.5px] text-ink-2 ring-1 ring-inset ring-line hover:bg-brand-50 hover:text-brand-900 hover:ring-brand-200">
            {i}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value)} className="max-w-40">
          {[1, 2, 3, 4, 5].map((l) => (
            <option key={l} value={l}>
              Level {l}
            </option>
          ))}
        </Select>
        <Button onClick={go} disabled={text.trim().length < 15}>
          Create and start
        </Button>
        <span className="text-[12.5px] text-ink-3">Private to you. Written by AI and not reviewed by faculty.</span>
      </div>
      {error && <ErrorNote message={error} title="The patient could not be created." kept="Your description is kept; try again." />}
    </div>
  );
}
