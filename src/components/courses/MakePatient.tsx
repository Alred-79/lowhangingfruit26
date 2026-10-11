"use client";

import { Check, FileText, Link2, ListTree, Sparkles, Stethoscope, UserRound, Users, Video, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ErrorNote from "@/components/ErrorNote";
import { Textarea, cx } from "@/components/ui";
import { LEVEL_NAMES } from "@/lib/engine/difficulty";
import "@/components/practice/practice.css";

const IDEAS = [
  "An anxious first-time parent who has read a lot online and questions everything I say",
  "An older man who downplays his symptoms and does not want to bother anyone",
  "A teenager who answers in one word until I earn some trust",
  "Someone who has stopped a medication and has not told anyone",
];

// The server answers once, when the patient is saved and the visit created, so these stages are an
// estimate from typical timings of the staged case writer (outline, four writers in parallel, linking),
// and are labelled as an estimate. Nothing is shown as finished past the last stage until it answers.
const STAGES: {
  at: number;
  end: number;
  title: string;
  detail: string;
  Icon: typeof Check;
}[] = [
  {
    at: 0,
    end: 16,
    title: "Outlining the story",
    detail: "The clinical story and every number are fixed once",
    Icon: ListTree,
  },
  {
    at: 16,
    end: 62,
    title: "Writing the patient",
    detail: "Four writers in parallel, each copying from the outline",
    Icon: Wand2,
  },
  {
    at: 62,
    end: 78,
    title: "Linking it together",
    detail: "Objectives tied to the facts that now exist",
    Icon: Link2,
  },
  {
    at: 78,
    end: Infinity,
    title: "Opening your visit",
    detail: "The waiting room opens as soon as the patient is saved",
    Icon: Video,
  },
];
const WRITERS: [string, typeof Check][] = [
  ["Who they are", UserRound],
  ["Medical history", Stethoscope],
  ["Personal history", Users],
  ["Chart and results", FileText],
];

/** The visible, staged wait for the ~80 second generator. role=status keeps screen readers informed. */
function Generating({ secs }: { secs: number }) {
  const pct = Math.min(96, (secs / 80) * 100);
  const current = STAGES.findIndex((s) => secs >= s.at && secs < s.end);
  return (
    <div role="status" aria-live="polite" className="rounded-[22px] bg-white/[0.06] p-4 ring-1 ring-inset ring-white/10 sm:p-5">
      <div className="flex items-start gap-4">
        <div className="practice-scan relative grid h-20 w-16 shrink-0 place-items-center overflow-hidden rounded-[18px] bg-gradient-to-b from-brand-500 to-[var(--color-stage)] ring-2 ring-[var(--color-xp)]/60" aria-hidden>
          <UserRound className="breathe h-9 w-9 text-white/80" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[19px] font-extrabold leading-tight tracking-[-0.02em] text-white">{STAGES[Math.max(0, current)].title}…</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-white/80">
            Writing your patient&apos;s history, chart and test results. This usually takes one to two minutes.{" "}
            <span className="font-mono font-bold text-[var(--color-xp)]">
              {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
            </span>
            {secs > 150 ? " — still working; a long case takes longer." : ""}
          </p>
        </div>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/12" aria-hidden>
        <div className="practice-progress shimmer h-full w-full rounded-full bg-[var(--color-xp)]" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {STAGES.map((s, i) => {
          const state = i < current ? "done" : i === current ? "active" : "todo";
          return (
            <li
              key={s.title}
              className={cx(
                "flex items-start gap-2.5 rounded-2xl px-3 py-2.5 ring-1 ring-inset transition-colors duration-300",
                state === "active" ? "bg-white/[0.1] ring-[var(--color-xp)]/70" : "ring-white/10",
                state === "todo" && "opacity-60",
              )}
            >
              <span className={cx("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full", state === "done" ? "bg-[var(--color-xp)] text-ink" : state === "active" ? "bg-white text-ink" : "bg-white/15 text-white")}>
                {state === "done" ? <Check className="pop-spring h-3.5 w-3.5" aria-hidden /> : <s.Icon className={cx("h-3.5 w-3.5", state === "active" && "breathe")} aria-hidden />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-bold leading-snug text-white">{s.title}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-white/75">{s.detail}</span>
                {i === 1 && state !== "todo" && (
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    {WRITERS.map(([w, Icon], wi) => (
                      <span key={w} className="pop-spring inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11.5px] font-semibold text-white" style={{ ["--i" as string]: wi }}>
                        <Icon className="h-3 w-3" aria-hidden />
                        {w}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[11.5px] text-white/70">Stages are estimated from typical timings. You can keep this tab open; the visit starts by itself.</p>
    </div>
  );
}

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
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: text, level: Number(level) }),
      });
      const j = await res.json();
      if (j.error || !j.id) throw new Error(j.error || "The patient could not be created.");
      router.push(`/encounter/${j.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  if (busy) return <Generating secs={secs} />;
  const need = 15 - text.trim().length;
  return (
    <div className="space-y-3">
      <Textarea
        aria-label="Describe the practice patient"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={1500}
        placeholder={`Describe a patient, or a skill you want to practise as ${roleName}`}
        className="border-0 bg-white text-[15px] ring-2 ring-transparent focus:ring-[var(--color-xp)]"
      />
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-white/80">
          <Sparkles className="h-3.5 w-3.5 text-[var(--color-xp)]" aria-hidden />
          Try one
        </p>
        <div className="flex flex-wrap gap-1.5">
          {IDEAS.map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={text === i}
              onClick={() => setText(i)}
              className={cx(
                "press min-h-9 rounded-2xl px-3 py-1.5 text-left text-[12.5px] font-semibold leading-snug ring-1 ring-inset transition-colors duration-150 pointer-coarse:min-h-11",
                text === i ? "bg-[var(--color-xp)] text-ink ring-transparent" : "bg-white/[0.08] text-white ring-white/15 hover:bg-white/15",
              )}
            >
              {i}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <fieldset className="min-w-0">
          <legend className="sr-only">Level</legend>
          <div className="inline-flex rounded-2xl bg-white/[0.08] p-1 ring-1 ring-inset ring-white/15">
            {[1, 2, 3, 4, 5].map((l) => (
              <label
                key={l}
                title={`Level ${l}, ${LEVEL_NAMES[l]}`}
                className={cx(
                  "press grid h-10 w-10 cursor-pointer place-items-center rounded-xl font-display text-[15px] font-black transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--color-xp)] pointer-coarse:h-11 pointer-coarse:w-11",
                  level === String(l) ? "bg-white text-ink shadow-e2" : "text-white/80 hover:text-white",
                )}
              >
                <input type="radio" name="make-level" value={l} checked={level === String(l)} onChange={() => setLevel(String(l))} className="sr-only" aria-label={`Level ${l}, ${LEVEL_NAMES[l]}`} />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        <span className="text-[13px] font-bold text-white/85">
          Level {level} <span className="font-semibold text-white/70">{LEVEL_NAMES[Number(level)]}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={go}
          disabled={need > 0}
          className="press inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[var(--color-xp)] px-6 text-[15.5px] font-black text-ink clay transition-[background-color,color,box-shadow] duration-150 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/60 disabled:shadow-none"
        >
          <Wand2 className="h-4 w-4" aria-hidden />
          Create and start
        </button>
        <span className="text-[12.5px] text-white/75" aria-live="polite">
          {need > 0 ? `${need} more character${need === 1 ? "" : "s"} to go. ` : ""}
          Private to you. Written by AI and not reviewed by faculty.
        </span>
      </div>
      {error && <ErrorNote message={error} title="The patient could not be created." kept="Your description is kept; try again." />}
    </div>
  );
}
