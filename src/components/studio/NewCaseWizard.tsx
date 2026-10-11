"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Circle, FileJson, FilePlus2, FileUp, Gauge, ListChecks, MessageSquareQuote, PenLine, Sparkles, Target, UserRound } from "lucide-react";
import { Button, cx, Input, PageHeader, Select } from "@/components/ui";
import type { ClarifyQuestion } from "@/lib/studio/ai";
import { LEVEL_NAMES } from "@/lib/engine/difficulty";
import { api, Area, Field, Notice, Panel, Text } from "./fields";
import ErrorNote from "@/components/ErrorNote";
import GeneratorPipeline from "./GeneratorPipeline";
import { LevelSlider, RapportGates } from "./TierLadder";
import "./studio.css";

type Role = { id: string; name: string; roleTitle: string; encounterTypes: string[] };
type Way = "describe" | "form" | "import";
type Stage = "input" | "asking" | "questions" | "writing" | "failed";

const EXAMPLES: { label: string; role: string; text: string; goals: string }[] = [
  {
    label: "Chest pain, smoker",
    role: "medicine",
    text: "58-year-old long-haul truck driver with three weeks of chest tightness when he climbs stairs or loads the truck, easing after a few minutes of rest. Smokes a pack a day, father died of a heart attack at 60. He plays it down as heartburn and is mainly here because his wife booked the visit. He has not told anyone that he had an episode at rest two nights ago.",
    goals: "Take a focused chest pain history; recognise unstable features; negotiate urgent in-person assessment with a reluctant patient.",
  },
  {
    label: "Heart failure, missed diuretic",
    role: "nursing",
    text: "72-year-old retired school cook with heart failure calling her nurse care manager about three days of worsening leg swelling and a 6 lb weight gain. Lives alone, has been eating canned soup since her daughter moved away, and skips her evening water pill so she does not have to get up at night. She says she takes all her pills.",
    goals: "Elicit non-adherence without judgment; recognise findings that need same-day escalation; teach daily weights and sodium limits.",
  },
  {
    label: "New prediabetes, shift worker",
    role: "dietetics",
    text: "45-year-old aircraft mechanic referred after labs showed prediabetes and high LDL. Works rotating night shifts, eats from vending machines and drive-throughs, drinks several sodas a day. Thinks diet advice is for people with time and money. Drinks more beer than he first admits.",
    goals: "Complete a diet history; identify realistic changes that fit shift work; use motivational interviewing rather than instruction.",
  },
];

const FORM_FIELDS: { key: string; label: string; placeholder: string; area?: boolean; half?: boolean }[] = [
  { key: "name", label: "Patient name", placeholder: "Leave blank to let the guide choose", half: true },
  { key: "age", label: "Age", placeholder: "e.g. 58", half: true },
  { key: "sex", label: "Sex", placeholder: "e.g. Male", half: true },
  { key: "occupation", label: "Occupation", placeholder: "e.g. Long-haul truck driver", half: true },
  { key: "chiefConcern", label: "Reason for the visit, in the patient's words", placeholder: "e.g. Tightness in my chest when I climb stairs" },
  { key: "diagnosis", label: "Underlying problem or diagnosis the case is built around", placeholder: "e.g. Unstable angina" },
  { key: "history", label: "Key history the patient can give", placeholder: "Onset, pattern, relevant past history, family history, risk factors", area: true },
  { key: "medications", label: "Medications and allergies", placeholder: "e.g. Lisinopril 10 mg daily; no known allergies", area: true },
  { key: "findings", label: "Findings, results and documents that should be in the chart", placeholder: "e.g. ECG with ST depression in V4-V6, lipid panel with LDL 168, last clinic note", area: true },
  { key: "sensitive", label: "What the patient is reluctant to share", placeholder: "e.g. An episode of pain at rest two nights ago; drinking more than he says", area: true },
  { key: "personality", label: "Personality and communication style", placeholder: "e.g. Stoic, plays things down, short answers", area: true },
  { key: "context", label: "Living situation and background", placeholder: "e.g. Married, two adult children, on the road four nights a week", area: true },
];

// The same wording the difficulty select used, now shown beside the slider.
const LEVEL_TEXT = ["Let the guide decide", "Forthcoming patient, single clear problem", "Straightforward", "Some reluctance, a few distractors", "Guarded patient, competing problems", "Complex, sensitive, easy to miss"];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const v = (o: Record<string, string | number>) => o as CSSProperties;

/** One line of the readiness card: what the guide will receive, with its state as icon + text. */
function Ready({ ok, label, detail, optional }: { ok: boolean; label: string; detail?: ReactNode; optional?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={cx("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg transition-colors duration-300", ok ? "bg-[var(--color-xp)] text-ink" : "bg-surface-2 text-ink-3 ring-1 ring-inset ring-line")}>
        {ok ? <Check key="y" className="pop-spring h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : <Circle className="h-2.5 w-2.5" aria-hidden />}
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-bold text-ink">
          {label}
          {optional && <span className="ml-1 font-medium text-ink-3">(optional)</span>}
          <span className="sr-only">{ok ? ": done" : ": not yet"}</span>
        </span>
        {detail && <span className="block text-[12.5px] leading-snug text-ink-3">{detail}</span>}
      </span>
    </li>
  );
}

export default function NewCaseWizard({ groups, defaultRole }: { groups: { group: string; items: Role[] }[]; defaultRole: string }) {
  const router = useRouter();
  const roles = groups.flatMap((g) => g.items);
  const [way, setWay] = useState<Way>("describe");
  const [stage, setStage] = useState<Stage>("input");
  const [role, setRole] = useState(roles.some((r) => r.id === defaultRole) ? defaultRole : roles[0]?.id || "");
  const [description, setDescription] = useState("");
  const [goals, setGoals] = useState("");
  const [level, setLevel] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [doc, setDoc] = useState<{ id: string; filename: string; chars: number; note?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [understood, setUnderstood] = useState("");
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saved, setSaved] = useState<{ id: string; title: string; seconds: number; counts: { facts: number; actions: number; artifacts: number; objectives: number } } | null>(null);
  const [importing, setImporting] = useState(false);
  const started = useRef(0);

  useEffect(() => {
    if (stage !== "writing") return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 1000);
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      clearInterval(t);
      window.removeEventListener("beforeunload", warn);
    };
  }, [stage]);

  const formFilled = Object.values(form).filter((v) => v.trim()).length;
  const canContinue = way === "describe" ? description.trim().length >= 15 : !!(form.chiefConcern?.trim() || form.diagnosis?.trim());

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api<{ id: string; filename: string; text: string | null; note?: string }>("/api/uploads", { method: "POST", body: fd });
      setDoc({ id: r.id, filename: r.filename, chars: r.text?.length || 0, note: r.note });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function next() {
    setError(null);
    if (way === "form") return write([]);
    setStage("asking");
    try {
      const r = await api<{ questions: ClarifyQuestion[]; understood: string }>("/api/cases/clarify", { json: { professionId: role, description, goals, level: Number(level) || undefined } });
      setUnderstood(r.understood);
      if (!r.questions.length) return write([]);
      setQuestions(r.questions);
      setAnswers({});
      setStage("questions");
    } catch {
      // The questions are a convenience. If they cannot be fetched, draft from the description as written.
      return write([]);
    }
  }

  async function write(qa: { question: string; answer: string }[]) {
    setError(null);
    setSaved(null);
    started.current = Date.now();
    setElapsed(0);
    setStage("writing");
    try {
      const r = await api<NonNullable<typeof saved>>("/api/cases/generate", {
        json: { professionId: role, description: way === "describe" ? description : form.notes || "", structured: way === "form" ? form : undefined, goals, level: Number(level) || undefined, uploadId: doc?.id, answers: qa },
      });
      setSaved(r);
      router.push(`/faculty/cases/${r.id}?created=1`);
    } catch (e) {
      setError((e as Error).message);
      setStage("failed");
    }
  }

  async function importFile(file: File) {
    setError(null);
    setImporting(true);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error("That file is not valid JSON.");
      }
      const { id } = await api<{ id: string }>("/api/cases", { json: { import: parsed } });
      router.push(`/faculty/cases/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setImporting(false);
    }
  }

  async function blank() {
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/cases", { json: { blank: true, professionId: role } });
      router.push(`/faculty/cases/${id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const roleName = roles.find((r) => r.id === role)?.name || role;
  const lvl = Number(level) || 0;
  const roleSelect = (
    <Field label="Who is the learner?" hint="The case is scoped to what this role does in a telehealth visit. You can add more roles later.">
      <Select value={role} onChange={(e) => setRole(e.target.value)}>
        {groups.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.items.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
    </Field>
  );

  // Difficulty: a slider (Auto, 1-5) that previews the rapport gates the engine uses at that level.
  const difficulty = (
    <div className="rounded-[20px] bg-surface-2/70 p-4 ring-1 ring-inset ring-line">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor="wiz-level" className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink">
          <Gauge className="h-4 w-4 text-brand-600" aria-hidden />
          Target difficulty <span className="font-medium text-ink-3">(optional)</span>
        </label>
        <span className="font-display text-[17px] font-extrabold tracking-[-0.01em] text-brand-700">{lvl ? `${lvl} · ${LEVEL_NAMES[lvl]}` : "Auto"}</span>
      </div>
      <p className="mt-0.5 text-[12.5px] text-ink-2">{LEVEL_TEXT[lvl]}</p>
      <div className="mt-2">
        <LevelSlider id="wiz-level" value={lvl} onChange={(n) => setLevel(n ? String(n) : "")} allowAuto label="Target difficulty" />
      </div>
      {lvl ? (
        <div className="mt-2">
          <RapportGates level={lvl} compact />
        </div>
      ) : (
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">The guide picks a level that fits the description. Slide to preview how much rapport each level asks of the student.</p>
      )}
    </div>
  );

  const source = (
    <Field label="Source document (optional)" hint="A guideline, protocol or paper as PDF, TXT or MD. The case is written to agree with it, and it is attached as a knowledge source that grounds student feedback.">
      {doc ? (
        <div className="pop-spring flex items-center justify-between gap-2 rounded-2xl bg-[var(--color-xp-soft)] px-3 py-2.5 text-sm ring-1 ring-inset ring-[var(--color-xp)]">
          <span className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-xp)] text-ink">
              <FileUp className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 truncate font-semibold text-ink">
              {doc.filename} <span className="font-normal text-ink-2">· {doc.chars ? `${doc.chars.toLocaleString()} characters of text read` : "no text could be read"}</span>
            </span>
          </span>
          <button type="button" className="press min-h-9 shrink-0 rounded-lg px-2 text-[12.5px] font-semibold text-ink-2 hover:bg-rose-50 hover:text-rose-700 pointer-coarse:min-h-11" onClick={() => setDoc(null)}>
            Remove
          </button>
        </div>
      ) : (
        <label className={cx("flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-brand-200 bg-surface px-3 py-3 transition-colors hover:border-brand-400 hover:bg-brand-50/50", uploading && "cursor-wait opacity-70")}>
          <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700", uploading ? "breathe" : "")}>
            <FileUp className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-[13px] text-ink-2">
            <span className="block font-bold text-ink">{uploading ? "Uploading and reading the document..." : "Attach a PDF, TXT or MD"}</span>
            <Input type="file" accept=".pdf,.txt,.md" disabled={uploading} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} className="mt-1 border-0 bg-transparent p-0 text-[12.5px] shadow-none hover:border-0 focus:ring-0" />
          </span>
        </label>
      )}
      {doc?.note && <p className="mt-1 text-xs text-amber-800">{doc.note}</p>}
    </Field>
  );

  if (stage === "writing" || stage === "failed") {
    const chips = [way === "describe" ? "Description read" : `Form read (${formFilled} fields filled in)`, understood, doc ? `Source document attached: ${doc.filename}, ${doc.chars.toLocaleString()} characters` : ""].filter(Boolean);
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          eyebrow={
            <>
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {roleName}
            </>
          }
          title={stage === "failed" ? "The draft was not written" : saved ? saved.title : "Drafting your patient"}
          subtitle={stage === "failed" ? "Nothing was saved. Your description and answers are kept." : `Working · ${fmt(elapsed)} elapsed. The draft is saved to your library as soon as it is written, even if you close this page.`}
        />
        <ul className="mb-4 flex flex-wrap gap-1.5" aria-label="What the guide was given">
          {chips.map((c, i) => (
            <li key={i} className="rise inline-flex max-w-full items-start gap-1.5 rounded-2xl bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-2 ring-1 ring-inset ring-line" style={v({ "--i": i })}>
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-xp-ink)]" aria-hidden />
              <span className="min-w-0">{c}</span>
            </li>
          ))}
        </ul>
        <GeneratorPipeline elapsed={elapsed} saved={!!saved} failed={stage === "failed"} counts={saved?.counts} />
        {stage === "writing" && !saved && (
          <p role="status" aria-live="polite" className={cx("mt-4 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[14px] ring-1 ring-inset", elapsed >= 120 ? "bg-amber-50 text-amber-950 ring-amber-200" : "bg-surface text-ink-2 ring-line")}>
            <span className={cx("live-dot mt-1.5 h-2 w-2 shrink-0 rounded-full", elapsed >= 120 ? "bg-amber-500" : "bg-brand-600")} />
            <span>
              {elapsed < 60 && "Writing. Most patients are ready in one to two minutes."}
              {elapsed >= 60 && elapsed < 120 && "Still writing. This is within the usual one to two minutes."}
              {elapsed >= 120 && elapsed < 180 && `Still working at ${fmt(elapsed)}. This patient is taking longer than usual, which happens with detailed descriptions and cases that need several chart documents. No error has come back. The whole case is written before any of it is shown, so there is nothing to display yet.`}
              {elapsed >= 180 && elapsed < 300 && `Still working at ${fmt(elapsed)}. The longest drafts are the ones with many facts, lab tables and documents that all have to agree with each other. You can keep this page open or leave it: the draft is saved to your library when it is done.`}
              {elapsed >= 300 && `Still working at ${fmt(elapsed)}, which is much longer than usual. If the draft cannot be written, this page will say so and offer to try again. You can also check your library for the finished draft.`}
            </span>
          </p>
        )}
        {saved && <p className="mt-4 text-[14px] font-semibold text-ink-2">Opening the editor for your review…</p>}
        {stage === "failed" && (
          <div className="pop-in mt-4 space-y-3">
            <ErrorNote message={error || "Unknown error."} title="The draft was not written." kept="Your description is kept; try again, or start from an existing patient in the library." />
            <div className="flex flex-wrap gap-2">
              <Button size="lg" onClick={() => write(questions.map((q) => ({ question: q.question, answer: answers[q.id] || "" })))}>
                <Sparkles className="h-4 w-4" aria-hidden />
                Try again
              </Button>
              <Button size="lg" variant="secondary" onClick={() => setStage("input")}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to the description
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (stage === "questions") {
    const answered = questions.filter((q) => (answers[q.id] || "").trim()).length;
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          eyebrow={
            <>
              <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden />
              {answered} of {questions.length} answered
            </>
          }
          title="A few quick questions"
          subtitle="Your description leaves these open. Answer what you can; anything you skip, the guide decides and you can change it in the editor."
        />
        {understood && (
          <div className="rise mb-4 flex gap-3 rounded-[20px] bg-brand-600 p-4 text-white clay" style={v({ "--i": 2 })}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15">
              <Sparkles className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div>
              <p className="text-[12.5px] font-bold text-white/80">Before the guide writes the case, it understood:</p>
              <p className="mt-0.5 text-[14.5px] leading-relaxed">{understood}</p>
            </div>
          </div>
        )}
        <ol className="space-y-3">
          {questions.map((q, n) => (
            <li key={q.id} className="rise rounded-[20px] bg-surface p-4 shadow-e1 ring-1 ring-line" style={v({ "--i": n + 3 })}>
              <p className="flex items-start gap-2.5 text-[15px] font-bold text-ink">
                <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-lg font-display text-[14px] font-black transition-colors", (answers[q.id] || "").trim() ? "bg-[var(--color-xp)] text-ink" : "bg-brand-100 text-brand-800")}>{n + 1}</span>
                {q.question}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {q.suggestions.map((s) => {
                  const on = answers[q.id] === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: a[q.id] === s ? "" : s }))}
                      className={cx("press inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors pointer-coarse:min-h-11", on ? "bg-ink text-white" : "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line hover:bg-brand-50 hover:text-brand-900")}
                    >
                      {on && <Check className="h-3.5 w-3.5 text-[var(--color-xp)]" aria-hidden />}
                      {s}
                    </button>
                  );
                })}
              </div>
              <Input className="mt-2.5" value={answers[q.id] || ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} placeholder="Or type your own answer" />
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button size="lg" onClick={() => write(questions.map((q) => ({ question: q.question, answer: answers[q.id] || "" })))}>
            <Sparkles className="h-4 w-4" aria-hidden />
            Draft the patient
          </Button>
          <Button variant="ghost" onClick={() => setStage("input")}>
            Back
          </Button>
          <span className="text-[12.5px] text-ink-3">Drafting usually takes one to two minutes and can take longer.</span>
        </div>
      </div>
    );
  }

  const ways: { id: Way; title: string; text: string; Icon: typeof PenLine; tone: string; tile: string }[] = [
    { id: "describe", title: "Describe the patient", text: "Write a paragraph or paste your notes. The guide asks what is missing, then drafts the full case.", Icon: PenLine, tone: "bg-brand-600 text-white", tile: "bg-brand-100 text-brand-700" },
    { id: "form", title: "Fill in a form", text: "Enter the core clinical details field by field. The guide expands them into the full case.", Icon: ListChecks, tone: "bg-[var(--color-mastery)] text-white", tile: "bg-[var(--color-mastery-soft)] text-[var(--color-mastery-ink)]" },
    { id: "import", title: "Import a file", text: "Load a patient profile exported from Poscere (JSON).", Icon: FileJson, tone: "bg-ink text-white", tile: "bg-slate-100 text-ink" },
  ];
  const chars = description.trim().length;
  const richness = Math.min(1, chars / 600);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={
          <>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Patient Studio
          </>
        }
        title="New patient"
        subtitle="Every route ends in the same editor, where you review and correct everything before publishing. Nothing reaches students until you publish."
        action={
          <Link href="/faculty/cases" className="press inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-semibold text-ink-2 hover:bg-brand-50 hover:text-ink pointer-coarse:min-h-11">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to the library
          </Link>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3" role="tablist" aria-label="How to start">
        {ways.map((w, i) => {
          const on = way === w.id;
          return (
            <button
              key={w.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                setWay(w.id);
                setError(null);
              }}
              className={cx("press lift rise relative overflow-hidden rounded-[22px] p-4 text-left transition-[background-color,color,box-shadow] duration-200", on ? cx(w.tone, "clay") : "bg-surface text-ink shadow-e1 ring-1 ring-inset ring-line")}
              style={v({ "--i": i })}
            >
              {on && <span className="spin-slow pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full [background:conic-gradient(from_0deg,transparent,rgb(255_255_255/0.18),transparent_45%)]" aria-hidden />}
              <span className={cx("relative grid h-10 w-10 place-items-center rounded-xl", on ? "bg-white/15" : w.tile)}>
                <w.Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="relative mt-3 block font-display text-[18px] font-extrabold tracking-[-0.02em]">{w.title}</span>
              <span className={cx("relative mt-1 block text-[13px] leading-relaxed", on ? "text-white/85" : "text-ink-3")}>{w.text}</span>
            </button>
          );
        })}
      </div>
      {error && (
        <Notice tone="red" className="mb-3">
          {error}
        </Notice>
      )}

      {way === "describe" && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Panel title="Describe the patient" subtitle="Say who they are, why they booked the visit, and what the case should teach. Details you give are kept as written; the guide fills in the rest.">
            <div className="space-y-5">
              {roleSelect}
              <div>
                <Area
                  label="Patient description"
                  minRows={7}
                  value={description}
                  onChange={setDescription}
                  placeholder="e.g. 58-year-old truck driver with three weeks of exertional chest tightness. Smoker, father died of a heart attack at 60. Plays it down as heartburn..."
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-ink-3">
                  Start from an example:
                  {EXAMPLES.filter((e) => roles.some((r) => r.id === e.role)).map((e) => (
                    <button
                      key={e.label}
                      type="button"
                      className="press inline-flex min-h-8 items-center gap-1 rounded-full bg-brand-50 px-3 text-[12.5px] font-semibold text-brand-800 ring-1 ring-inset ring-brand-200 hover:bg-brand-100 pointer-coarse:min-h-11"
                      onClick={() => {
                        setDescription(e.text);
                        setGoals(e.goals);
                        setRole(e.role);
                      }}
                    >
                      <Sparkles className="h-3 w-3" aria-hidden />
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
              <Area label="Learning goals (optional)" minRows={3} value={goals} onChange={setGoals} placeholder="What should a student be able to do by the end of this visit?" />
              <div className="grid gap-4 xl:grid-cols-2">
                {difficulty}
                {source}
              </div>
            </div>
          </Panel>

          {/* Readiness: what the guide will receive, updating as you type, with the action that sends it. */}
          <aside className="rise rounded-[22px] bg-surface p-4 shadow-e2 ring-1 ring-line lg:sticky lg:top-4" style={v({ "--i": 3 })} aria-label="Draft readiness">
            <p className="font-display text-[17px] font-extrabold tracking-[-0.015em] text-ink">What the guide gets</p>
            <div className="mt-2">
              <div className="flex items-baseline justify-between text-[12.5px] font-semibold text-ink-2">
                <span>Description detail</span>
                <span className="font-mono text-ink">{chars} chars</span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line" role="meter" aria-label="Description detail" aria-valuemin={0} aria-valuemax={600} aria-valuenow={Math.min(600, chars)}>
                <div className={cx("h-full origin-left rounded-full transition-transform duration-300 ease-[var(--ease-out-ui)]", chars >= 15 ? "bg-[var(--color-xp)]" : "bg-brand-400")} style={{ transform: `scaleX(${Math.max(0.02, richness)})` }} />
              </div>
              <p className="mt-1 text-[12px] text-ink-3">{chars < 15 ? `${15 - chars} more characters to continue.` : chars < 250 ? "Enough to start. More detail means fewer questions." : "Plenty to work from."}</p>
            </div>
            <ul className="mt-4 space-y-2.5">
              <Ready ok={!!role} label="Learner role" detail={roleName} />
              <Ready ok={chars >= 15} label="Patient description" detail={chars >= 15 ? "Kept as written" : "At least a sentence"} />
              <Ready ok={!!goals.trim()} label="Learning goals" optional />
              <Ready ok={!!lvl} label="Difficulty" optional detail={lvl ? `${lvl} · ${LEVEL_NAMES[lvl]}` : "The guide decides"} />
              <Ready ok={!!doc} label="Source document" optional detail={doc ? doc.filename : undefined} />
            </ul>
            <Button size="lg" className="mt-4 w-full" disabled={!canContinue || stage === "asking" || uploading} onClick={next}>
              {stage === "asking" ? (
                <>
                  Reading your description
                  <span className="studio-dots inline-flex" aria-hidden>
                    <i />
                    <i />
                    <i />
                  </span>
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </Button>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-3">Next: the guide may ask up to three short questions, then drafts the case (usually one to two minutes).</p>
          </aside>
        </div>
      )}

      {way === "form" && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Panel title="Core clinical details" subtitle="Fill in what matters to you and leave the rest blank. At minimum give the reason for the visit or the underlying problem.">
            <div className="space-y-5">
              {roleSelect}
              <div className="grid gap-4 sm:grid-cols-4">
                {FORM_FIELDS.map((f) =>
                  f.area ? (
                    <Area key={f.key} className="sm:col-span-2" label={f.label} minRows={2} placeholder={f.placeholder} value={form[f.key] || ""} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} />
                  ) : (
                    <Text key={f.key} className={f.half ? "sm:col-span-1" : "sm:col-span-2"} label={f.label} placeholder={f.placeholder} value={form[f.key] || ""} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} />
                  ),
                )}
                <Area className="sm:col-span-4" label="Anything else the guide should know (optional)" minRows={2} value={form.notes || ""} onChange={(v) => setForm((s) => ({ ...s, notes: v }))} />
              </div>
              <Area label="Learning goals (optional)" minRows={3} value={goals} onChange={setGoals} placeholder="What should a student be able to do by the end of this visit?" />
              <div className="grid gap-4 xl:grid-cols-2">
                {difficulty}
                {source}
              </div>
            </div>
          </Panel>
          <aside className="rise rounded-[22px] bg-surface p-4 shadow-e2 ring-1 ring-line lg:sticky lg:top-4" style={v({ "--i": 3 })} aria-label="Form progress">
            <div className="flex items-center gap-3">
              <div className="relative h-[72px] w-[72px] shrink-0" role="img" aria-label={`${formFilled} of ${FORM_FIELDS.length + 1} fields filled in`}>
                <svg viewBox="0 0 72 72" className="absolute inset-0 -rotate-90" aria-hidden>
                  <circle cx="36" cy="36" r="29" fill="none" stroke="var(--color-mastery-soft)" strokeWidth="8" />
                  <circle cx="36" cy="36" r="29" fill="none" stroke="var(--color-mastery)" strokeWidth="8" strokeLinecap="round" strokeDasharray={2 * Math.PI * 29} strokeDashoffset={2 * Math.PI * 29 * (1 - formFilled / (FORM_FIELDS.length + 1))} style={{ transition: "stroke-dashoffset 400ms var(--ease-out-ui)" }} />
                </svg>
                <span className="absolute inset-0 grid place-items-center font-display text-[20px] font-black text-ink">{formFilled}</span>
              </div>
              <div>
                <p className="font-display text-[17px] font-extrabold tracking-[-0.015em] text-ink">Fields filled in</p>
                <p className="text-[12.5px] text-ink-3">of {FORM_FIELDS.length + 1}. Blank fields are left to the guide.</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5">
              <Ready ok={!!(form.chiefConcern?.trim() || form.diagnosis?.trim())} label="Reason for the visit or problem" detail="The one thing the guide needs" />
              <Ready ok={!!form.sensitive?.trim()} label="What the patient holds back" optional detail="Becomes the Needs trust and Guarded facts" />
              <Ready ok={!!goals.trim()} label="Learning goals" optional />
              <Ready ok={!!lvl} label="Difficulty" optional detail={lvl ? `${lvl} · ${LEVEL_NAMES[lvl]}` : "The guide decides"} />
            </ul>
            <Button size="lg" className="mt-4 w-full" disabled={!canContinue || uploading} onClick={next}>
              <Sparkles className="h-4 w-4" aria-hidden />
              Draft the patient
            </Button>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-3">Drafting usually takes one to two minutes and can take longer. You review everything before it can be published.</p>
          </aside>
        </div>
      )}

      {way === "import" && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rise rounded-[22px] bg-ink p-5 text-white clay" style={v({ "--i": 1 })}>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/12">
              <FileJson className="h-5.5 w-5.5" aria-hidden />
            </span>
            <h2 className="mt-3 font-display text-[22px] font-black tracking-[-0.02em]">Import a patient profile</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-white/80">Use a JSON file exported from the editor (Export JSON), or any file that follows the Poscere case format. The import is saved as a draft you own.</p>
            <label className={cx("mt-4 flex cursor-pointer flex-col gap-1 rounded-2xl border-2 border-dashed border-white/30 bg-white/5 p-3 transition-colors hover:border-[var(--color-xp)]", importing && "cursor-wait")}>
              <span className="text-[13px] font-bold">{importing ? "Importing..." : "Choose a .json file"}</span>
              <Input type="file" accept=".json,application/json" disabled={importing} onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} className="border-0 bg-transparent p-0 text-[12.5px] text-white shadow-none file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-xp)] file:px-3 file:py-1.5 file:font-bold file:text-ink hover:border-0 focus:ring-0 disabled:bg-transparent" />
            </label>
          </section>
          <section className="rise rounded-[22px] bg-surface p-5 shadow-e1 ring-1 ring-line" style={v({ "--i": 2 })}>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-100 text-brand-700">
              <FilePlus2 className="h-5.5 w-5.5" aria-hidden />
            </span>
            <h2 className="mt-3 font-display text-[22px] font-black tracking-[-0.02em] text-ink">Prefer to write everything yourself?</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-3">Start from an empty profile for one learner role, and fill in each section in the editor.</p>
            <div className="mt-4">{roleSelect}</div>
            <Button variant="secondary" className="mt-3" onClick={blank}>
              <UserRound className="h-4 w-4" aria-hidden />
              Start with an empty profile
            </Button>
          </section>
        </div>
      )}
      <p className="mt-6 flex items-center gap-2 text-[12.5px] text-ink-3">
        <Target className="h-3.5 w-3.5" aria-hidden />
        AI drafts are labelled &ldquo;AI-drafted, not faculty-reviewed&rdquo; until you mark them reviewed.
      </p>
    </div>
  );
}
