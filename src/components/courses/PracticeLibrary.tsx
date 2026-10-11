"use client";
import { ArrowRight, History, PlayCircle, Shuffle, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TrustLabel from "@/components/TrustLabel";
import { cx, Empty, Label, Select } from "@/components/ui";
import { knobsForLevel, LEVEL_NAMES } from "@/lib/engine/difficulty";
import { feedbackUrl, visitUrl } from "@/lib/courses/settings";
import StartVisit from "./StartVisit";

export interface PracticeCase {
  id: string;
  /** Student-safe label; the faculty title never reaches this component. */
  label: string;
  specialty: string;
  professions: string[];
  difficulty: number;
  encounterType: string;
  patientFirstName: string;
  age: number | null;
  aiDraft: boolean;
  attempts: number;
  best: number | null;
  lastId: string | null;
  activeId: string | null;
  /** Public portrait image path, when the patient has one. */
  portrait?: string | null;
}

const initials = (n: string) => n.slice(0, 2).toUpperCase();
const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const TIME = (level: number) => (level <= 2 ? "No time limit" : level === 5 ? "5 minutes under the case limit" : "The case's time limit");

function Portrait({ c, className }: { c: PracticeCase; className?: string }) {
  return c.portrait ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={c.portrait} alt="" loading="lazy" className={cx("h-full w-full object-cover object-[50%_25%]", className)} />
  ) : (
    <div className={cx("grid h-full w-full place-items-center bg-[radial-gradient(circle_at_50%_35%,var(--color-stage-3),var(--color-stage))]", className)}>
      <span className="font-display text-3xl font-semibold text-white/80">{initials(c.patientFirstName)}</span>
    </div>
  );
}

/** What a level changes about the patient, read from the same pure function the engine uses. */
function LevelEffects({ level }: { level: number }) {
  const k = knobsForLevel(level);
  const rows: [string, string][] = [
    ["Starting comfort", `${k.rapportStart} of 100`],
    ["Comfort needed for “needs trust” facts", `${k.reluctantAt}`],
    ["Comfort needed for guarded facts", `${k.hiddenAt}`],
    ["New facts per reply, at most", `${k.factsPerTurn}`],
    ["Volunteers related facts", k.volunteers ? "Yes" : "No"],
    ["Coach hints", k.hints ? "Available" : "Off"],
    ["Time", TIME(level)],
  ];
  return (
    <dl className="divide-y divide-line/70 rounded-xl bg-surface-2 px-3.5 text-[13px]">
      {rows.map(([a, b]) => (
        <div key={a} className="flex items-baseline justify-between gap-3 py-1.5">
          <dt className="text-ink-3">{a}</dt>
          <dd className={cx("text-right font-semibold text-ink", /^\d/.test(b) && "font-mono tabular-nums")}>{b}</dd>
        </div>
      ))}
    </dl>
  );
}

function StartSheet({ c, professionNames, onClose }: { c: PracticeCase; professionNames: Record<string, string>; onClose: () => void }) {
  const [level, setLevel] = useState(c.difficulty);
  const [vary, setVary] = useState(c.attempts > 0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="scrim-in absolute inset-0 bg-ink/35" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="sheet-title" className="sheet-in relative flex h-full w-full max-w-md flex-col overflow-hidden bg-surface shadow-e3">
        <div className="relative h-56 shrink-0 bg-stage">
          <Portrait c={c} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <button onClick={onClose} className="press absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white hover:bg-black/60" aria-label="Close">
            <X className="h-5 w-5" aria-hidden />
          </button>
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <h2 id="sheet-title" className="font-display text-[26px] font-semibold leading-tight">
              {c.patientFirstName}
              {c.age !== null && `, ${c.age}`}
            </h2>
            <p className="mt-0.5 text-[13.5px] text-white/80">{[sentence(c.encounterType), c.specialty].filter(Boolean).join(" · ")}</p>
          </div>
        </div>
        <div className="scroll-quiet min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
            <span>Written for {c.professions.map((p) => professionNames[p] || p).join(", ")}</span>
            {c.aiDraft && <TrustLabel kind="ai-draft" title="This patient was written by AI and has not been reviewed by faculty yet." />}
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <Label htmlFor={`lvl-${c.id}`} className="mb-0">
                Difficulty for this visit
              </Label>
              <span className="text-[13px] font-semibold text-ink">
                {level} {LEVEL_NAMES[level]}
                {level === c.difficulty && <span className="font-normal text-ink-3"> (written at)</span>}
              </span>
            </div>
            <input id={`lvl-${c.id}`} type="range" min={1} max={5} step={1} value={level} onChange={(e) => setLevel(Number(e.target.value))} className="mt-3 w-full cursor-pointer accent-[var(--color-brand-600)]" aria-valuetext={`Level ${level}, ${LEVEL_NAMES[level]}`} />
            <div className="mt-1 flex justify-between text-[11.5px] text-ink-3">
              {[1, 2, 3, 4, 5].map((l) => (
                <span key={l} className={l === level ? "font-semibold text-ink" : ""}>
                  {l}
                </span>
              ))}
            </div>
            <p className="mb-2 mt-3 text-[12.5px] text-ink-3">The facts stay the same at every level. What changes is how hard the patient is to interview:</p>
            <LevelEffects level={level} />
          </div>

          {c.attempts > 0 && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line p-3 text-[13.5px] text-ink-2">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-brand-600)]" checked={vary} onChange={(e) => setVary(e.target.checked)} />
              <span>
                <span className="flex items-center gap-1.5 font-semibold text-ink">
                  <Shuffle className="h-3.5 w-3.5" aria-hidden />
                  Vary the patient this time
                </span>
                Their mood and delivery change; the clinical facts do not.
              </span>
            </label>
          )}

          <div className="text-[13px] text-ink-3">
            {c.attempts === 0 ? (
              "Not attempted yet"
            ) : (
              <>
                {c.attempts} attempt{c.attempts === 1 ? "" : "s"}
                {c.best !== null && (
                  <>
                    {" "}
                    · best <span className="font-semibold text-ink">{Math.round(c.best)}%</span>
                  </>
                )}
                {c.lastId && (
                  <>
                    {" "}
                    ·{" "}
                    <Link href={feedbackUrl(c.lastId)} className="font-medium text-brand-700 hover:underline">
                      Last feedback
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
          {c.activeId && (
            <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900 ring-1 ring-inset ring-amber-200">
              <History className="h-4 w-4 shrink-0" aria-hidden />
              <span>
                You have a visit with this patient in progress.{" "}
                <Link href={visitUrl(c.activeId)} className="font-semibold underline">
                  Resume it
                </Link>
              </span>
            </p>
          )}
        </div>
        <div className="space-y-3 border-t border-line p-5">
          {c.attempts > 0 && (
            <p className="text-[12.5px] leading-relaxed text-ink-3">
              <span className="font-semibold text-ink-2">Follow-up visit:</span> {c.patientFirstName} remembers you, what they told you is already in the chart, and their trust is where you left it. <span className="font-semibold text-ink-2">Start over</span> is a clean repetition.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {c.attempts > 0 && <StartVisit size="lg" body={{ caseId: c.id, mode: "practice", level, followUp: true }} label="Follow-up visit" variant="secondary" />}
            <StartVisit size="lg" body={{ caseId: c.id, mode: "practice", level, perturb: c.attempts > 0 && vary }} label={c.attempts > 0 ? "Start over" : "Start visit"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CaseCard({ c, onOpen }: { c: PracticeCase; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="press group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface text-left transition-[border-color,box-shadow] hover:border-brand-300 hover:shadow-e2">
      <div className="relative aspect-[4/3.6] w-full overflow-hidden bg-stage">
        <Portrait c={c} className="transition-transform duration-500 ease-[var(--ease-out-ui)] group-hover:scale-[1.03]" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-10">
          <div className="font-display text-[19px] font-semibold leading-tight text-white">
            {c.patientFirstName}
            {c.age !== null && <span className="font-normal text-white/80">, {c.age}</span>}
          </div>
        </div>
        <span className="absolute left-2.5 top-2.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[11.5px] font-medium text-white backdrop-blur-sm">
          Level {c.difficulty} {LEVEL_NAMES[c.difficulty]}
        </span>
        {c.activeId && <span className="absolute right-2.5 top-2.5 rounded-md bg-amber-400 px-1.5 py-0.5 text-[11.5px] font-semibold text-amber-950">In progress</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="text-[13.5px] font-medium leading-snug text-ink">{sentence(c.encounterType) || "Visit"}</div>
        {c.specialty && <div className="text-[12.5px] text-ink-3">{c.specialty}</div>}
        {c.aiDraft && <TrustLabel kind="ai-draft" className="self-start" />}
        <div className="mt-auto flex items-center justify-between pt-1.5 text-[12.5px] text-ink-3">
          <span>{c.attempts === 0 ? "Not attempted yet" : `${c.attempts} attempt${c.attempts === 1 ? "" : "s"}${c.best !== null ? ` · best ${Math.round(c.best)}%` : ""}`}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
            {c.activeId ? <PlayCircle className="h-3.5 w-3.5" aria-hidden /> : null}
            {c.attempts > 0 ? "Again" : "Start"}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </button>
  );
}

export default function PracticeLibrary({ cases, professionNames, myProfession }: { cases: PracticeCase[]; professionNames: Record<string, string>; myProfession: string | null }) {
  const profs = useMemo(() => [...new Set(cases.flatMap((c) => c.professions))].sort((a, b) => (professionNames[a] || a).localeCompare(professionNames[b] || b)), [cases, professionNames]);
  const [prof, setProf] = useState(myProfession || "");
  const [specialty, setSpecialty] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const inRole = cases.filter((c) => !prof || c.professions.includes(prof));
  const specialties = [...new Set(inRole.map((c) => c.specialty).filter(Boolean))].sort();
  const shown = inRole.filter((c) => (!specialty || c.specialty === specialty) && (!level || c.difficulty === Number(level)) && (!status || (status === "new" ? c.attempts === 0 : c.attempts > 0)));
  // The role list always offers the student's own role, even before a patient exists for it.
  const roleOptions = myProfession && !profs.includes(myProfession) ? [myProfession, ...profs] : profs;
  const opened = cases.find((c) => c.id === openId) || null;

  return (
    <div>
      <div className="mb-4 grid gap-3 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="f-role">Role</Label>
          <Select
            id="f-role"
            value={prof}
            onChange={(e) => {
              setProf(e.target.value);
              setSpecialty("");
            }}
          >
            <option value="">All roles</option>
            {roleOptions.map((p) => (
              <option key={p} value={p}>
                {professionNames[p] || p}
                {p === myProfession ? " (your role)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="f-spec">Specialty</Label>
          <Select id="f-spec" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
            <option value="">All specialties</option>
            {specialties.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="f-level">Level the patient was written at</Label>
          <Select id="f-level" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">All levels</option>
            {[1, 2, 3, 4, 5].map((l) => (
              <option key={l} value={l}>
                {l} {LEVEL_NAMES[l]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="f-status">Your history</Label>
          <Select id="f-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All patients</option>
            <option value="new">Not attempted yet</option>
            <option value="done">Attempted before</option>
          </Select>
        </div>
      </div>
      <p className="mb-4 text-[13px] text-ink-3">
        <span className="font-semibold text-ink">{shown.length}</span> patient{shown.length === 1 ? "" : "s"}
        {prof && prof !== myProfession && myProfession ? ". You are browsing another role; you will act in that role for the visit." : "."} Pick one to choose the difficulty and start.
      </p>
      {shown.length === 0 ? (
        <Empty>{prof && inRole.length === 0 ? `There are no published patients for ${professionNames[prof] || prof} yet. Choose "All roles" to practise with patients written for other roles.` : "No patients match those filters."}</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {shown.map((c) => (
            <CaseCard key={c.id} c={c} onOpen={() => setOpenId(c.id)} />
          ))}
        </div>
      )}
      {opened && <StartSheet key={opened.id} c={opened} professionNames={professionNames} onClose={() => setOpenId(null)} />}
    </div>
  );
}
