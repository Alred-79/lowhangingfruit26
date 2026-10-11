"use client";
import { SlidersHorizontal, Users } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { FilterChips } from "@/components/game/controls";
import { usePrefersReducedMotion } from "@/components/motion";
import PatientCard from "@/components/practice/PatientCard";
import StartSheet from "@/components/practice/StartSheet";
import type { PracticeCase } from "@/components/practice/types";
import { cx, Empty, Label, Select } from "@/components/ui";
import { LEVEL_NAMES } from "@/lib/engine/difficulty";
import "@/components/practice/practice.css";

export type { PracticeCase };

type Status = "" | "new" | "active" | "done";
const STATUS_TEST: Record<Status, (c: PracticeCase) => boolean> = {
  "": () => true,
  new: (c) => c.attempts === 0,
  active: (c) => !!c.activeId,
  done: (c) => c.attempts > 0,
};

/** A small titled row of chips. */
function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("grid gap-2 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-center", className)}>
      <p className="text-[12.5px] font-bold text-ink-2">{label}</p>
      {children}
    </div>
  );
}

export default function PracticeLibrary({ cases, professionNames, myProfession }: { cases: PracticeCase[]; professionNames: Record<string, string>; myProfession: string | null }) {
  const profs = useMemo(() => [...new Set(cases.flatMap((c) => c.professions))].sort((a, b) => (professionNames[a] || a).localeCompare(professionNames[b] || b)), [cases, professionNames]);
  const [prof, setProf] = useState(myProfession || "");
  const [specialty, setSpecialty] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState<Status>("");
  const [more, setMore] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const reduced = usePrefersReducedMotion();
  const close = useCallback(() => setOpenId(null), []);

  // Filter changes reflow the grid with a View Transition when the browser has one (cards glide to their
  // new place); otherwise, and under reduced motion, the change is instant.
  const animate = (fn: () => void) => {
    const d = document as Document & {
      startViewTransition?: (cb: () => void) => unknown;
    };
    if (reduced || !d.startViewTransition) return fn();
    d.startViewTransition(() => flushSync(fn));
  };

  const inRole = cases.filter((c) => !prof || c.professions.includes(prof));
  const specialties = [...new Set(inRole.map((c) => c.specialty).filter(Boolean))].sort();
  const bySpec = (c: PracticeCase) => !specialty || c.specialty === specialty;
  const byLevel = (c: PracticeCase) => !level || c.difficulty === Number(level);
  const byStatus = STATUS_TEST[status];
  const shown = inRole
    .filter((c) => bySpec(c) && byLevel(c) && byStatus(c))
    // Visits in progress lead; everything else keeps the library order.
    .sort((a, b) => Number(!!b.activeId) - Number(!!a.activeId));
  // The role list always offers the student's own role, even before a patient exists for it.
  const roleOptions = myProfession && !profs.includes(myProfession) ? [myProfession, ...profs] : profs;
  const opened = cases.find((c) => c.id === openId) || null;

  // Live counts: each group counts what the other filters leave, so a chip says what choosing it would show.
  const countRole = (p: string) => cases.filter((c) => (!p || c.professions.includes(p)) && bySpec(c) && byLevel(c) && byStatus(c)).length;
  const statusBase = inRole.filter((c) => bySpec(c) && byLevel(c));
  const specBase = inRole.filter((c) => byLevel(c) && byStatus(c));
  const levelBase = inRole.filter((c) => bySpec(c) && byStatus(c));
  const extra = (specialty ? 1 : 0) + (level ? 1 : 0);

  const setRole = (p: string) =>
    animate(() => {
      setProf(p);
      setSpecialty("");
    });

  return (
    <div>
      <div className="rise mb-4 space-y-3 rounded-[24px] border border-line/80 bg-surface p-4 shadow-e1 sm:p-5" style={{ ["--i" as string]: 3 }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-bold text-ink-2">
              <Users className="h-4 w-4 text-brand-600" aria-hidden />
              Whose patients
            </p>
            <FilterChips
              label="Whose patients"
              value={prof === myProfession && myProfession ? "mine" : prof === "" ? "all" : "other"}
              onChange={(id) => id !== "other" && setRole(id === "mine" ? myProfession || "" : "")}
              options={[
                ...(myProfession
                  ? [
                      {
                        id: "mine" as const,
                        label: "For you",
                        count: countRole(myProfession),
                      },
                    ]
                  : []),
                {
                  id: "all" as const,
                  label: "All roles",
                  count: countRole(""),
                },
                ...(prof && prof !== myProfession
                  ? [
                      {
                        id: "other" as const,
                        label: professionNames[prof] || prof,
                        count: countRole(prof),
                        tone: "bg-[var(--color-flame-2)] text-ink",
                      },
                    ]
                  : []),
              ]}
            />
          </div>
          <div className="w-full sm:w-80">
            <Label htmlFor="f-role">Role</Label>
            <Select id="f-role" value={prof} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              {roleOptions.map((p) => (
                <option key={p} value={p}>
                  {professionNames[p] || p}
                  {p === myProfession ? " (your role)" : ""}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <Row label="Your history" className="border-t border-line/70 pt-3">
          <FilterChips
            label="Your history"
            value={status}
            onChange={(s) => animate(() => setStatus(s))}
            options={[
              {
                id: "" as Status,
                label: "All patients",
                count: statusBase.length,
              },
              {
                id: "new" as Status,
                label: "Not attempted yet",
                count: statusBase.filter(STATUS_TEST.new).length,
              },
              {
                id: "active" as Status,
                label: "In progress",
                count: statusBase.filter(STATUS_TEST.active).length,
                tone: "bg-[var(--color-flame-2)] text-ink",
              },
              {
                id: "done" as Status,
                label: "Attempted before",
                count: statusBase.filter(STATUS_TEST.done).length,
              },
            ]}
          />
        </Row>

        <button
          type="button"
          aria-expanded={more}
          aria-controls="more-filters"
          onClick={() => setMore((m) => !m)}
          className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-2 px-3.5 text-[13.5px] font-bold text-ink-2 ring-1 ring-inset ring-line lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Specialty and level
          {extra > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-brand-600 px-1.5 font-mono text-[12px] text-white">{extra}</span>}
        </button>
        <div id="more-filters" className={cx("space-y-3 border-t border-line/70 pt-3 lg:block", more ? "block" : "hidden")}>
          <Row label="Specialty">
            {specialties.length <= 6 ? (
              <FilterChips
                label="Specialty"
                value={specialty}
                onChange={(s) => animate(() => setSpecialty(s))}
                options={[
                  { id: "", label: "All specialties", count: specBase.length },
                  ...specialties.map((s) => ({
                    id: s,
                    label: s,
                    count: specBase.filter((c) => c.specialty === s).length,
                  })),
                ]}
              />
            ) : (
              <div className="max-w-md">
                <Select id="f-spec" aria-label="Specialty" value={specialty} onChange={(e) => animate(() => setSpecialty(e.target.value))}>
                  <option value="">All specialties ({specBase.length})</option>
                  {specialties.map((s) => (
                    <option key={s} value={s}>
                      {s} ({specBase.filter((c) => c.specialty === s).length})
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </Row>
          <Row label="Level the patient was written at">
            <FilterChips
              label="Level the patient was written at"
              value={level}
              onChange={(l) => animate(() => setLevel(l))}
              options={[
                { id: "", label: "All levels", count: levelBase.length },
                ...[1, 2, 3, 4, 5].map((l) => ({
                  id: String(l),
                  label: `${l} ${LEVEL_NAMES[l]}`,
                  count: levelBase.filter((c) => c.difficulty === l).length,
                })),
              ]}
            />
          </Row>
        </div>
      </div>

      <p className="mb-4 text-[13.5px] text-ink-3" aria-live="polite">
        <span className="font-display text-[17px] font-black text-ink">{shown.length}</span> patient{shown.length === 1 ? "" : "s"}
        {prof && prof !== myProfession && myProfession ? ". You are browsing another role; you will act in that role for the visit." : "."} Pick one to choose the difficulty and start.
      </p>
      {shown.length === 0 ? (
        <Empty title={prof && inRole.length === 0 ? "No patients for this role yet" : "Nothing matches"} icon={<Users className="h-6 w-6" aria-hidden />}>
          {prof && inRole.length === 0 ? `There are no published patients for ${professionNames[prof] || prof} yet. Choose "All roles" to practise with patients written for other roles.` : "No patients match those filters."}
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {shown.map((c, i) => (
            <PatientCard key={c.id} c={c} i={i} onOpen={() => setOpenId(c.id)} />
          ))}
        </div>
      )}
      {opened && <StartSheet key={opened.id} c={opened} professionNames={professionNames} onClose={close} />}
    </div>
  );
}
