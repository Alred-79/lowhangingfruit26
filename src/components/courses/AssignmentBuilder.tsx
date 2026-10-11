"use client";
import { BookOpenCheck, Check, ChevronDown, Dumbbell, GraduationCap, Route, Search, Sparkles, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Badge, Button, Card, Input, Label, Select, Textarea, cx } from "@/components/ui";
import { LEVEL_NAMES } from "@/lib/engine/difficulty";
import { defaultSettings, TYPE_LABEL, type AssignmentSettings, type AssignmentType } from "@/lib/courses/settings";


export interface BuilderCase {
  id: string;
  title: string;
  summary: string;
  specialty: string;
  professions: string[];
  difficulty: number;
  encounterType: string;
  objectives: string[];
  aiDraft: boolean;
}
export interface BuilderInitial {
  id: string;
  title: string;
  instructions: string;
  type: AssignmentType;
  caseIds: string[];
  journeyId: string | null;
  settings: AssignmentSettings;
  dueAt: string | null;
}
interface Reasons {
  type: string;
  level: string;
  settings: string;
  cases: Record<string, string>;
  gaps: string;
}

const LEVEL_HELP = [
  "",
  "Forthcoming, calm patient who volunteers information. Hints available, no time limit.",
  "Slightly vague patient who still volunteers some information. Hints available, no time limit.",
  "Patient answers only what is asked and mentions some irrelevant details. Timed.",
  "Guarded, vague, emotional patient who needs trust before sharing sensitive history. Timed.",
  "Distressed, very vague patient with a tight time limit.",
];
const TYPE_HELP: Record<AssignmentType, string> = {
  homework: "Graded practice with a due date. Students usually get several attempts and see feedback straight away.",
  exam: "Summative. Hints are off, every student meets the patient at the same level, and feedback is held until you release it.",
  practice: "Ungraded repetition. Unlimited attempts by default, with the patient's mood changing on repeats.",
};
const TIME_CHOICES = [10, 15, 20, 25, 30, 45, 60];


const TYPE_LOOK: Record<AssignmentType, { Icon: typeof BookOpenCheck; on: string; tile: string }> = {
  homework: { Icon: BookOpenCheck, on: "bg-brand-600 text-white ring-brand-600", tile: "bg-brand-100 text-brand-800" },
  exam: { Icon: GraduationCap, on: "bg-[var(--color-mastery)] text-white ring-[var(--color-mastery)]", tile: "bg-[var(--color-mastery-soft)] text-[var(--color-mastery-ink)]" },
  practice: { Icon: Dumbbell, on: "bg-ink text-white ring-ink", tile: "bg-[var(--color-tier-initial-soft)] text-[var(--color-tier-initial-ink)]" },
};
const v = (o: Record<string, string | number>) => o as CSSProperties;

function GuideNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="pop-in mt-2 flex gap-2 rounded-xl bg-[var(--color-mastery-soft)] px-3 py-2 text-[12.5px] leading-relaxed text-ink">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-mastery-ink)]" aria-hidden />
      <span>
        <span className="font-bold text-[var(--color-mastery-ink)]">Guide: </span>
        {children}
      </span>
    </p>
  );
}

/** A checkbox drawn as a switch: the native input stays (keyboard, label, form semantics). */
function Toggle({ id, checked, onChange, disabled, label, help }: { id: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; help: string }) {
  return (
    <label htmlFor={id} className={cx("flex items-start gap-3 rounded-2xl p-3.5 ring-1 ring-inset transition-colors", disabled ? "bg-surface-2/60 ring-line" : checked ? "cursor-pointer bg-brand-50 ring-brand-300" : "cursor-pointer bg-surface ring-line hover:ring-brand-300")}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className={cx("h-6 w-10 rounded-full transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2", checked ? (disabled ? "bg-slate-400" : "bg-brand-600") : "bg-slate-300")} aria-hidden />
        <span className={cx("absolute left-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow-e1 transition-transform duration-200 [transition-timing-function:var(--ease-out-ui)]", checked && "translate-x-4")} aria-hidden>
          {checked && <Check className="h-3 w-3 text-brand-700" />}
        </span>
      </span>
      <span>
        <span className={cx("block text-[14px] font-bold", disabled ? "text-ink-3" : "text-ink")}>{label}</span>
        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-3">{help}</span>
      </span>
    </label>
  );
}

/** The patient's mood at a difficulty level: calm and open at 1, distressed and closed at 5 (a preview, not data). */
function MoodFace({ level }: { level: number | null }) {
  const l = level ?? 2;
  const curve = [0, 7, 4, 0, -4, -7][l];
  const brow = [0, 0, 0, 1, 3, 5][l];
  const fill = ["", "var(--color-xp)", "var(--color-tier-initial)", "var(--color-flame-2)", "var(--color-flame)", "var(--color-tier-hidden)"][l];
  return (
    <svg viewBox="0 0 48 48" className="h-16 w-16 shrink-0" role="img" aria-label={`Patient mood preview for ${level ? `level ${level}` : "each patient's own level"}`}>
      <circle cx="24" cy="24" r="22" fill={fill} style={{ transition: "fill 240ms ease" }} />
      <line x1="13" x2="20" y1={15 + brow * 0.3} y2={15 - brow * 0.5} stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" style={{ transition: "all 240ms var(--ease-out-ui)" }} />
      <line x1="35" x2="28" y1={15 + brow * 0.3} y2={15 - brow * 0.5} stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" style={{ transition: "all 240ms var(--ease-out-ui)" }} />
      <circle cx="17" cy="21" r="2.6" fill="var(--color-ink)" />
      <circle cx="31" cy="21" r="2.6" fill="var(--color-ink)" />
      <path d={`M15 ${32 - curve / 2} Q24 ${32 + curve} 33 ${32 - curve / 2}`} fill="none" stroke="var(--color-ink)" strokeWidth="2.8" strokeLinecap="round" style={{ transition: "d 240ms var(--ease-out-ui)" }} />
    </svg>
  );
}

function StepHead({ n, title, subtitle, action, tone }: { n: number; title: string; subtitle?: string; action?: React.ReactNode; tone: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-line/70 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-[17px] font-black clay", tone)}>{n}</span>
        <div className="min-w-0">
          <h2 className="font-display text-[19px] font-extrabold tracking-[-0.02em] text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export default function AssignmentBuilder({
  courseId,
  courseProfession,
  cases,
  journeys,
  professionNames,
  initial,
}: {
  courseId: string;
  courseProfession: string | null;
  cases: BuilderCase[];
  journeys: { id: string; title: string }[];
  professionNames: Record<string, string>;
  initial?: BuilderInitial;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title || "");
  const [instructions, setInstructions] = useState(initial?.instructions || "");
  const [type, setType] = useState<AssignmentType>(initial?.type || "homework");
  const [target, setTarget] = useState<"cases" | "journey">(initial?.journeyId ? "journey" : "cases");
  const [caseIds, setCaseIds] = useState<string[]>(initial?.journeyId ? [] : initial?.caseIds || []);
  const [journeyId, setJourneyId] = useState(initial?.journeyId || "");
  const [s, setS] = useState<AssignmentSettings>(initial?.settings || defaultSettings("homework"));
  const [due, setDue] = useState("");
  const [reasons, setReasons] = useState<Reasons | null>(null);

  const [request, setRequest] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [showSyllabus, setShowSyllabus] = useState(false);
  const [guiding, setGuiding] = useState(false);
  const [guideError, setGuideError] = useState("");

  const anyForCourse = !!courseProfession && cases.some((c) => c.professions.includes(courseProfession));
  const [prof, setProf] = useState(anyForCourse ? courseProfession! : "");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // The due date is edited in the instructor's own time zone, so it is filled in after mount.
  useEffect(() => {
    if (!initial?.dueAt) return;
    const d = new Date(initial.dueAt);
    if (Number.isNaN(d.getTime())) return;
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setDue(local);
  }, [initial?.dueAt]);

  const set = (patch: Partial<AssignmentSettings>) => setS((old) => ({ ...old, ...patch }));

  function changeType(t: AssignmentType) {
    setType(t);
    if (t === "exam") {
      const d = defaultSettings("exam");
      setS((old) => ({ ...old, hints: false, level: old.level ?? d.level, feedbackRelease: "manual", maxAttempts: 1, liveAssist: false, perturb: false, timeLimitMin: old.timeLimitMin ?? d.timeLimitMin }));
    } else if (type === "exam") {
      const d = defaultSettings(t);
      setS((old) => ({ ...old, hints: d.hints, feedbackRelease: d.feedbackRelease, maxAttempts: d.maxAttempts, perturb: d.perturb }));
    }
  }

  async function askGuide() {
    setGuiding(true);
    setGuideError("");
    try {
      const res = await fetch("/api/assignments/guide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, request, syllabus: showSyllabus ? syllabus : "" }) });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || "The guide could not make a suggestion");
      const p = j.proposal as { title: string; instructions: string; type: AssignmentType; journeyId: string | null; caseIds: string[]; settings: AssignmentSettings };
      setTitle(p.title);
      setInstructions(p.instructions);
      setType(p.type);
      setS(p.settings);
      if (p.journeyId) {
        setTarget("journey");
        setJourneyId(p.journeyId);
      } else {
        setTarget("cases");
        setCaseIds(p.caseIds);
        // Make sure every suggested patient is visible in the list.
        if (prof && p.caseIds.some((id) => !cases.find((c) => c.id === id)?.professions.includes(prof))) setProf("");
        setQ("");
      }
      setReasons(j.reasons);
    } catch (e) {
      setGuideError((e as Error).message);
    }
    setGuiding(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const body = {
        courseId,
        title,
        instructions,
        type,
        caseIds: target === "cases" ? caseIds : [],
        journeyId: target === "journey" ? journeyId : null,
        settings: { ...s, timeLimitMin: s.timeLimitMin ?? null },
        dueAt: due ? new Date(due).toISOString() : null,
      };
      const res = await fetch(initial ? `/api/assignments/${initial.id}` : "/api/assignments", { method: initial ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || "Could not save the assignment");
      router.push(`/faculty/courses/${courseId}/assignments/${j.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const profOptions = useMemo(() => [...new Set(cases.flatMap((c) => c.professions))].sort(), [cases]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cases
      .filter((c) => (!prof || c.professions.includes(prof)) && (!needle || (c.title + " " + c.specialty + " " + c.summary).toLowerCase().includes(needle)))
      .sort((a, b) => Number(caseIds.includes(b.id)) - Number(caseIds.includes(a.id)) || (caseIds.includes(a.id) ? caseIds.indexOf(a.id) - caseIds.indexOf(b.id) : a.title.localeCompare(b.title)));
  }, [cases, prof, q, caseIds]);
  const hiddenSelected = caseIds.filter((id) => !shown.some((c) => c.id === id)).length;

  const exam = type === "exam";
  const timeValue = s.timeLimitMin === undefined ? "default" : String(s.timeLimitMin);
  const timeChoices = s.timeLimitMin && !TIME_CHOICES.includes(s.timeLimitMin) ? [...TIME_CHOICES, s.timeLimitMin].sort((a, b) => a - b) : TIME_CHOICES;
  const ready = title.trim() && (target === "cases" ? caseIds.length > 0 : !!journeyId);


  const checks = [
    { ok: !!title.trim(), text: "Title" },
    { ok: target === "cases" ? caseIds.length > 0 : !!journeyId, text: target === "cases" ? `${caseIds.length} patient${caseIds.length === 1 ? "" : "s"}` : "Care journey" },
    { ok: true, text: s.level ? `Level ${s.level}` : "Own levels" },
    { ok: true, text: due ? "Due date set" : "No due date" },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
      {/* ---------- Guide ---------- */}
      <div>
        <div className="overflow-hidden rounded-[26px] bg-ink text-white clay lg:sticky lg:top-4">
          <div className="relative px-5 pb-3 pt-5">
            <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(circle,oklch(0.545_0.235_293/0.55),transparent_65%)] breathe" aria-hidden />
            <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-[var(--color-mastery)] clay">
              <Sparkles className={cx("h-5 w-5", guiding && "flicker")} aria-hidden />
            </span>
            <h2 className="relative mt-3 font-display text-[21px] font-extrabold tracking-[-0.02em]">Assignment guide</h2>
            <p className="relative mt-1 text-[13px] leading-relaxed text-white/75">Describe what you want students to practise. The guide suggests patients and settings; you review and change anything before saving.</p>
          </div>
          <div className="space-y-3 px-5 pb-5">
            <div>
              <label htmlFor="guide-request" className="mb-1.5 block text-[13px] font-bold text-white/90">
                What should students practise?
              </label>
              <Textarea
                id="guide-request"
                rows={5}
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                maxLength={3000}
                placeholder="e.g. Second-year dietetics students, week 6. Motivational interviewing with a patient who is not ready to change. Low stakes, I want them to repeat it until it feels natural."
              />
            </div>
            {showSyllabus ? (
              <div className="pop-in">
                <label htmlFor="guide-syllabus" className="mb-1.5 block text-[13px] font-bold text-white/90">
                  Syllabus excerpt or learning objectives
                </label>
                <Textarea id="guide-syllabus" rows={6} value={syllabus} onChange={(e) => setSyllabus(e.target.value)} maxLength={12000} placeholder="Paste the relevant part of your syllabus, unit outline or competency list." />
              </div>
            ) : (
              <button type="button" className="press inline-flex min-h-8 items-center gap-1 text-[12.5px] font-bold text-[var(--color-xp)] hover:underline pointer-coarse:min-h-11" onClick={() => setShowSyllabus(true)}>
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                Paste a syllabus excerpt or objectives
              </button>
            )}
            <Button onClick={askGuide} disabled={guiding || (!request.trim() && !(showSyllabus && syllabus.trim()))} className="w-full !bg-[var(--color-xp)] !text-ink disabled:!bg-white/15 disabled:!text-white/60" size="lg">
              <Sparkles className="h-4 w-4" aria-hidden />
              {guiding ? "Reading your patients…" : reasons ? "Suggest again" : "Suggest a setup"}
            </Button>
            {guiding && (
              <div className="space-y-1.5" aria-hidden>
                <div className="shimmer h-2.5 rounded-full bg-white/15" />
                <div className="shimmer h-2.5 w-4/5 rounded-full bg-white/15" style={v({ "--sd": "0.4s" })} />
              </div>
            )}
            {guiding && <p className="text-[12.5px] text-white/70">This usually takes 10 to 30 seconds.</p>}
            {guideError && <p className="rounded-xl bg-[var(--color-tier-hidden-soft)] px-3 py-2 text-[12.5px] font-semibold text-[var(--color-tier-hidden-ink)]">{guideError}</p>}
            {reasons && !guiding && (
              <div className="pop-in space-y-2 rounded-2xl bg-white/10 p-3 text-[12.5px] text-white/85">
                <p className="font-bold text-white">The form has been filled in with the guide&apos;s suggestion. Nothing is saved yet.</p>
                {reasons.gaps && (
                  <p className="rounded-xl bg-[var(--color-tier-reluctant-soft)] px-2.5 py-1.5 text-ink">
                    <span className="font-bold">Not covered by your published patients: </span>
                    {reasons.gaps}
                  </p>
                )}
                <p>Each suggestion has a short reason next to the field it filled in.</p>
              </div>
            )}
            <p className="text-[12px] leading-snug text-white/60">The guide only chooses among published patients and care journeys. It cannot see student data.</p>
          </div>
        </div>
      </div>

      {/* ---------- Form ---------- */}
      <div className="min-w-0 space-y-5">
        <Card className="overflow-hidden">
          <StepHead n={1} title="Basics" tone="bg-brand-600 text-white" />
          <div className="space-y-4 p-5">
            <div>
              <Label htmlFor="as-title">Title</Label>
              <Input id="as-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="e.g. Week 6: counselling a patient who is not ready to change" />
            </div>
            <div>
              <Label>Type</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["homework", "exam", "practice"] as const).map((t) => {
                  const look = TYPE_LOOK[t];
                  const on = type === t;
                  return (
                    <button key={t} type="button" aria-pressed={on} onClick={() => changeType(t)} className={cx("press flex flex-col items-start gap-2 rounded-2xl p-3.5 text-left ring-1 ring-inset transition-[background-color,color,box-shadow] duration-200", on ? cx(look.on, "shadow-e2") : "bg-surface text-ink ring-line hover:ring-brand-300")}>
                      <span className={cx("grid h-9 w-9 place-items-center rounded-xl", on ? "bg-white/20" : look.tile)}>
                        <look.Icon className="h-4.5 w-4.5" aria-hidden />
                      </span>
                      <span className="block font-display text-[16px] font-extrabold">{TYPE_LABEL[t]}</span>
                      <span className={cx("block text-[12.5px] leading-relaxed", on ? "text-white/85" : "text-ink-3")}>{TYPE_HELP[t]}</span>
                    </button>
                  );
                })}
              </div>
              <GuideNote>{reasons?.type}</GuideNote>
            </div>
            <div>
              <Label htmlFor="as-instructions">Instructions shown to students</Label>
              <Textarea id="as-instructions" rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={4000} placeholder="What to focus on. Do not give away findings." />
            </div>
            <div className="max-w-xs">
              <Label htmlFor="as-due">Due (optional)</Label>
              <Input id="as-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <StepHead
            n={2}
            title="Who students see"
            tone="bg-[var(--color-tier-initial)] text-white"
            subtitle={target === "cases" ? `${caseIds.length} patient${caseIds.length === 1 ? "" : "s"} selected. Students complete a visit with each one.` : "One patient seen by several professions in turn, with handoffs."}
            action={
              journeys.length > 0 && (
                <div className="flex rounded-full bg-surface-2 p-1 ring-1 ring-inset ring-line" role="group" aria-label="Students see">
                  {(["cases", "journey"] as const).map((t) => (
                    <button key={t} type="button" aria-pressed={target === t} onClick={() => setTarget(t)} className={cx("press inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold transition-colors pointer-coarse:min-h-11", target === t ? "bg-ink text-white shadow-e1" : "text-ink-2 hover:text-ink")}>
                      {t === "cases" ? <Users className="h-3.5 w-3.5" aria-hidden /> : <Route className="h-3.5 w-3.5" aria-hidden />}
                      {t === "cases" ? "Patients" : "Care journey"}
                    </button>
                  ))}
                </div>
              )
            }
          />
          {target === "journey" ? (
            <div className="p-5">
              <Label htmlFor="as-journey">Care journey</Label>
              <Select id="as-journey" value={journeyId} onChange={(e) => setJourneyId(e.target.value)}>
                <option value="">Choose a published care journey</option>
                {journeys.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </Select>
              <p className="mt-2 text-[12.5px] text-ink-3">Level, hints and time limit below apply to the student&apos;s own visit in the journey.</p>
            </div>
          ) : (
            <div className="p-5">
              <div className="mb-3 flex flex-wrap gap-2">
                <div className="relative max-w-xs flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patients" aria-label="Search patients" className="pl-9" />
                </div>
                <Select value={prof} onChange={(e) => setProf(e.target.value)} aria-label="Filter by profession" className="max-w-[16rem]">
                  <option value="">All professions</option>
                  {profOptions.map((p) => (
                    <option key={p} value={p}>
                      {professionNames[p] || p}
                    </option>
                  ))}
                </Select>
                <span className="inline-flex items-center rounded-full bg-surface-2 px-3 text-[12.5px] font-bold text-ink-2">
                  {shown.length} shown · <span className="ml-1 text-brand-700">{caseIds.length} picked</span>
                </span>
              </div>
              {cases.length === 0 ? (
                <p className="text-[14px] text-ink-3">There are no published patients yet. Publish one in Patient Studio first.</p>
              ) : (
                <ul className="scroll-quiet max-h-[30rem] space-y-1.5 overflow-y-auto rounded-2xl bg-surface-2/60 p-1.5">
                  {shown.map((c) => {
                    const on = caseIds.includes(c.id);
                    return (
                      <li key={c.id} className={cx("rounded-xl transition-colors", on ? "bg-brand-50 ring-2 ring-inset ring-brand-500" : "bg-surface ring-1 ring-inset ring-line")}>
                        <div className="flex items-start gap-3 px-3 py-2.5">
                          <input
                            id={`case-${c.id}`}
                            type="checkbox"
                            className="mt-1 h-4.5 w-4.5 shrink-0 accent-[var(--color-brand-600)]"
                            checked={on}
                            onChange={(e) => setCaseIds((ids) => (e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id)))}
                          />
                          <div className="min-w-0 flex-1">
                            <label htmlFor={`case-${c.id}`} className="block cursor-pointer text-[14px] font-bold text-ink">
                              {c.title}
                            </label>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
                              <Badge tone="teal">
                                Level {c.difficulty} {LEVEL_NAMES[c.difficulty]}
                              </Badge>
                              {c.aiDraft && <Badge tone="amber">AI draft, not reviewed</Badge>}
                              <span>{c.professions.map((p) => professionNames[p] || p).join(", ")}</span>
                              {c.encounterType && <span>· {c.encounterType}</span>}
                            </div>
                            {on && <GuideNote>{reasons?.cases[c.id]}</GuideNote>}
                            {open === c.id && (
                              <div className="pop-in mt-2 space-y-1.5 rounded-xl bg-surface-2 p-2.5 text-[12.5px] leading-relaxed text-ink-2">
                                <p>{c.summary}</p>
                                {c.objectives.length > 0 && (
                                  <ul className="list-disc space-y-0.5 pl-4">
                                    {c.objectives.map((o, i) => (
                                      <li key={i}>{o}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </div>
                          <button type="button" className="press inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[12.5px] font-bold text-brand-700 hover:bg-brand-50 pointer-coarse:min-h-11" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
                            {open === c.id ? "Hide" : "Details"}
                            <ChevronDown className={cx("h-3.5 w-3.5 transition-transform duration-200", open === c.id && "rotate-180")} aria-hidden />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                  {shown.length === 0 && <li className="px-3 py-6 text-center text-[14px] text-ink-3">No patients match that filter.</li>}
                </ul>
              )}
              {hiddenSelected > 0 && <p className="mt-2 text-[12.5px] font-semibold text-[var(--color-tier-reluctant-ink)]">{hiddenSelected} selected patient{hiddenSelected === 1 ? " is" : "s are"} hidden by the filter above.</p>}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <StepHead n={3} title="Settings" tone="bg-[var(--color-mastery)] text-white" subtitle="These are enforced by the server when a student starts a visit." />
          <div className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="as-level">Difficulty level</Label>
                <Select id="as-level" value={s.level === null ? "" : String(s.level)} onChange={(e) => set({ level: e.target.value ? Number(e.target.value) : null })}>
                  {!exam && <option value="">Each patient&apos;s own level</option>}
                  {[1, 2, 3, 4, 5].map((l) => (
                    <option key={l} value={l}>
                      Level {l}: {LEVEL_NAMES[l]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="as-time">Time limit</Label>
                <Select id="as-time" value={timeValue} onChange={(e) => set({ timeLimitMin: e.target.value === "default" ? undefined : Number(e.target.value) })}>
                  <option value="default">Default for the level</option>
                  <option value="0">No limit</option>
                  {timeChoices.map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="as-attempts">Attempts allowed per patient</Label>
                <Select id="as-attempts" value={String(s.maxAttempts)} onChange={(e) => set({ maxAttempts: Number(e.target.value) })}>
                  <option value="0">Unlimited</option>
                  {[1, 2, 3, 4, 5, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {/* Live preview of the chosen difficulty: the patient's mood, the level staircase and what it means. */}
            <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-surface-2 p-4" aria-live="polite">
              <MoodFace level={s.level} />
              <div className="flex items-end gap-1.5" role="img" aria-label={s.level ? `Level ${s.level} of 5` : "Each patient's own level"}>
                {[1, 2, 3, 4, 5].map((l) => (
                  <span key={l} className={cx("w-3.5 rounded-[5px] transition-colors duration-200", s.level && l <= s.level ? "bg-[var(--color-mastery)]" : "bg-surface ring-1 ring-inset ring-line-strong/40")} style={{ height: 10 + l * 7 }} />
                ))}
              </div>
              <div className="min-w-0 flex-1 basis-60">
                <p className="font-display text-[16px] font-extrabold text-ink">{s.level ? `Level ${s.level}: ${LEVEL_NAMES[s.level]}` : "Each patient's own level"}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{s.level ? LEVEL_HELP[s.level] : "Each visit uses the level the patient was written at. Difficulty changes how hard the patient is to interview, never the clinical facts."}</p>
              </div>
            </div>
            <GuideNote>{reasons?.level}</GuideNote>
            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle id="as-hints" checked={s.hints} disabled={exam} onChange={(val) => set({ hints: val })} label="Coach hints" help={exam ? "Always off in exams." : "Students can ask for a nudge that never reveals a finding."} />
              <Toggle id="as-perturb" checked={s.perturb} onChange={(val) => set({ perturb: val })} label="Vary the patient on repeat attempts" help="From the second attempt the patient's mood and delivery change (rushed, anxious, withdrawn). The facts stay the same." />
              <Toggle id="as-live" checked={s.liveAssist} onChange={(val) => set({ liveAssist: val })} label="Live assist" help="You can watch these visits as they happen on Live Visits, pause one and send the student a note. Students are told when it is on." />
              {type !== "exam" && <Toggle id="as-shared" checked={!!s.sharedPatient} onChange={(val) => set({ sharedPatient: val })} label="One shared patient for the class" help="Students see the same continuing patient rather than each getting a fresh copy. The patient remembers earlier students by name and may repeat what they were told; earlier students' visit notes appear in the chart. Use it for a team of different professions seeing one patient in turn." />}
              <Toggle
                id="as-hold"
                checked={s.feedbackRelease === "manual"}
                onChange={(val) => set({ feedbackRelease: val ? "manual" : "immediate" })}
                label="Hold feedback until I release it"
                help="Students see scores and feedback only after you press Release feedback in the gradebook."
              />
            </div>
            <GuideNote>{reasons?.settings}</GuideNote>
          </div>
        </Card>

        {/* Save: a readiness checklist and the save action as one unit. */}
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-[22px] bg-surface/95 p-3 shadow-e3 ring-1 ring-inset ring-line backdrop-blur sm:p-4">
          <ul className="flex flex-1 flex-wrap gap-1.5" aria-label="Ready to save">
            {checks.map((c) => (
              <li key={c.text} className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-bold transition-colors", c.ok ? "bg-[var(--color-xp-soft)] text-ink" : "bg-surface-2 text-ink-3")}>
                <span className={cx("grid h-4 w-4 place-items-center rounded-full", c.ok ? "bg-[var(--color-xp)]" : "ring-1 ring-inset ring-line-strong")} aria-hidden>
                  {c.ok && <Check className="h-3 w-3 text-ink" />}
                </span>
                {c.text}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            {!ready && <span className="text-[12.5px] text-ink-3">{!title.trim() ? "Add a title" : target === "cases" ? "Choose at least one patient" : "Choose a care journey"} to save.</span>}
            {error && <span className="text-[13px] font-semibold text-rose-700">{error}</span>}
            <Button variant="ghost" onClick={() => router.back()} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !ready} size="lg">
              {saving ? "Saving…" : initial ? "Save changes" : "Create assignment"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
