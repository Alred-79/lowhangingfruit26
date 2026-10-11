"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Megaphone, Plus, Route, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Button, Input, Label, Select, Textarea, cx } from "@/components/ui";
import type { Stage } from "@/lib/journey/types";
import { post, Spinner } from "./shared";

interface Props {
  cases: { id: string; title: string; patient: string }[];
  clinicians: { id: string; name: string; role: string }[];
  professions: { id: string; name: string }[];
  initial?: { id: string; title: string; summary: string; caseId: string; status: string; stages: Stage[] };
}

const GENERIC = ["Jordan Ellis", "Morgan Reyes", "Casey Whitfield", "Avery Okafor", "Riley Sandoval", "Quinn Abernathy"];
const blank = (i: number, clinicianId: string): Stage => ({ id: `s${i + 1}`, order: i + 1, professionId: "", roleTitle: "", clinicianId, focus: "", simTime: `Week 1, day ${i + 1}`, visitLabel: "" });

/** Faculty builder: pick a published case, let the AI guide propose encounters, edit them, save or publish. */
export default function JourneyBuilder({ cases, clinicians, professions, initial }: Props) {
  const router = useRouter();
  const [caseId, setCaseId] = useState(initial?.caseId || cases[0]?.id || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [summary, setSummary] = useState(initial?.summary || "");
  const [stages, setStages] = useState<Stage[]>(initial?.stages || []);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState("");
  const [guideErr, setGuideErr] = useState("");
  // Anything that is not a sentence written for people (a stack message, a provider error) is replaced by one that is.
  const readable = (e?: string) => (e && /^[A-Z][^{}()<>=]*[.!?]$/.test(e.trim()) && !/is not a function|undefined|null|token|exception|ECONN|credential/i.test(e) ? e : "The guide could not propose encounters this time. Try again in a moment, or add the encounters by hand.");

  const set = (i: number, patch: Partial<Stage>) => setStages((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) =>
    setStages((s) => {
      const out = [...s];
      const j = i + d;
      if (j < 0 || j >= out.length) return s;
      [out[i], out[j]] = [out[j], out[i]];
      return out.map((x, k) => ({ ...x, order: k + 1 }));
    });

  async function propose() {
    setBusy("propose");
    setErr("");
    setGuideErr("");
    const r = await post<{ title: string; summary: string; stages: Stage[] }>("/api/journeys/propose", { caseId, brief });
    setBusy("");
    if (r.error || !Array.isArray(r.stages) || !r.stages.length) return setGuideErr(readable(r.error));
    setStages(r.stages);
    if (!title) setTitle(r.title || "");
    if (!summary) setSummary(r.summary || "");
  }

  async function save(publish: boolean) {
    setBusy(publish ? "publish" : "save");
    setErr("");
    setSaved("");
    const body = { title, summary, caseId, stages: stages.map((s, i) => ({ ...s, order: i + 1 })) };
    if (initial) {
      const res = await fetch(`/api/journeys/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, status: publish ? "published" : initial.status === "published" ? "published" : "draft" }) });
      const r = await res.json().catch(() => ({ error: "Could not save." }));
      setBusy("");
      if (r.error) return setErr(r.error);
      setSaved(publish ? "Published." : "Saved.");
      router.refresh();
    } else {
      const r = await post<{ id: string }>("/api/journeys", { ...body, publish });
      setBusy("");
      if (r.error || !r.id) return setErr(r.error || "Could not save.");
      router.push(`/faculty/journeys/${r.id}`);
    }
  }

  return (
    <div className="space-y-5">
      <BuilderSection n={1} icon={BookOpen} tone="bg-brand-600 text-white" title="Patient case" subtitle="A journey reuses one published case for every encounter, so the patient, the facts they can disclose and the approved results stay the same throughout.">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Published case</Label>
            <Select value={caseId} onChange={(e) => setCaseId(e.target.value)} disabled={!!initial}>
              {cases.map((c) => <option key={c.id} value={c.id}>{c.patient}: {c.title}</option>)}
            </Select>
          </div>
          <div>
            <Label>Anything the guide should aim for (optional)</Label>
            <Input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. include pharmacy; end with dietetics; four encounters" />
          </div>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button variant="secondary" onClick={propose} disabled={!caseId || !!busy}><Wand2 className="h-4 w-4 text-[var(--color-mastery)]" aria-hidden />{stages.length ? "Ask the guide for a new proposal" : "Ask the guide to propose encounters"}</Button>
            {busy === "propose" && <Spinner label="Reading the case and the clinician personas, then writing each encounter's brief" hint="Usually 30 to 60 seconds" />}
            {guideErr && busy !== "propose" && <span role="alert" className="rounded-xl bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200">{guideErr}</span>}
            <button onClick={() => setStages((s) => [...s, blank(s.length, clinicians[0]?.id || "")])} className="press inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-brand-700 hover:bg-brand-50 pointer-coarse:min-h-11"><Plus className="h-4 w-4" aria-hidden />Add an encounter by hand</button>
          </div>
        </div>
      </BuilderSection>

      <BuilderSection n={2} icon={Route} tone="bg-[var(--color-mastery)] text-white" title="Encounters, in order" subtitle="At least three. A student joins as one of these professionals; the AI plays the persona you choose for every other one. Every encounter is a telehealth visit with the patient at home. The focus steers the AI colleague; students see the brief and tasks instead.">
        {/* Live preview of the path students will see, redrawn as you edit roles or reorder. */}
        <div className="mb-4 rounded-2xl bg-surface-2 p-3.5 ring-1 ring-inset ring-line" aria-label="Preview of the journey path">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] font-bold text-ink-3">
            <span>Path preview</span>
            <span className={cx("rounded-full px-2 py-0.5", stages.length >= 3 ? "bg-[var(--color-xp)] text-ink" : "bg-amber-100 text-amber-900")}>{stages.length} of 3+ encounters</span>
          </div>
          <ol className="mt-2.5 flex flex-wrap items-center gap-y-2">
            {stages.map((s, i) => (
              <li key={i} className="flex items-center">
                {i > 0 && <span className="mx-1 h-[4px] w-5 rounded-full bg-brand-200" aria-hidden />}
                <span className="pop-spring inline-flex items-center gap-1.5 rounded-full bg-surface py-1 pl-1 pr-3 text-[12.5px] font-bold text-ink shadow-e1 ring-1 ring-inset ring-line" style={{ ["--i" as string]: i }}>
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-600 font-mono text-[11px] font-black text-white">{i + 1}</span>
                  {s.roleTitle || <span className="italic text-ink-3">Untitled role</span>}
                </span>
              </li>
            ))}
            {[0, 1, 2].slice(stages.length).map((k) => (
              <li key={`g${k}`} className="flex items-center">
                {stages.length + k > 0 && <span className="mx-1 h-[4px] w-5 rounded-full bg-brand-100" aria-hidden />}
                <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-dashed border-brand-200 font-mono text-[11px] text-ink-3">{stages.length + k + 1}</span>
              </li>
            ))}
            <li className="flex items-center"><span className="mx-1 h-[4px] w-5 rounded-full bg-brand-100" aria-hidden /><span className="rounded-full bg-ink px-2.5 py-1 text-[11.5px] font-bold text-white">Huddle, then care plan</span></li>
          </ol>
        </div>
        <div className="space-y-3">
          {!stages.length && <p className="rounded-2xl border-2 border-dashed border-brand-200 px-4 py-5 text-center text-sm text-ink-3">No encounters yet. Ask the guide for a proposal or add one by hand.</p>}
          {stages.map((s, i) => (
            <div key={i} className="rise rounded-[20px] bg-surface p-4 ring-1 ring-inset ring-line" style={{ ["--i" as string]: i }}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 font-display text-[15px] font-black text-white clay">{i + 1}</span>
                  <span className="font-display text-[16px] font-extrabold text-ink">Encounter {i + 1}{s.roleTitle ? <span className="font-semibold text-ink-3"> · {s.roleTitle}</span> : null}</span>
                </span>
                <span className="flex gap-1 text-xs">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="press inline-flex min-h-8 items-center gap-1 rounded-lg px-2 font-bold text-ink-2 hover:bg-brand-50 disabled:text-slate-300 disabled:hover:bg-transparent pointer-coarse:min-h-11"><ArrowUp className="h-3.5 w-3.5" aria-hidden />Move up</button>
                  <button onClick={() => move(i, 1)} disabled={i === stages.length - 1} className="press inline-flex min-h-8 items-center gap-1 rounded-lg px-2 font-bold text-ink-2 hover:bg-brand-50 disabled:text-slate-300 disabled:hover:bg-transparent pointer-coarse:min-h-11"><ArrowDown className="h-3.5 w-3.5" aria-hidden />Move down</button>
                  <button onClick={() => setStages((x) => x.filter((_, k) => k !== i).map((y, k) => ({ ...y, order: k + 1 })))} className="press inline-flex min-h-8 items-center gap-1 rounded-lg px-2 font-bold text-rose-700 hover:bg-rose-50 pointer-coarse:min-h-11"><Trash2 className="h-3.5 w-3.5" aria-hidden />Remove</button>
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <Label>Role title</Label>
                  <Input value={s.roleTitle} onChange={(e) => set(i, { roleTitle: e.target.value })} placeholder="Clinical pharmacist" />
                </div>
                <div>
                  <Label>Role in the catalog</Label>
                  <Select value={professions.some((p) => p.id === s.professionId) ? s.professionId : ""} onChange={(e) => set(i, { professionId: e.target.value })}>
                    <option value="">{s.professionId && !professions.some((p) => p.id === s.professionId) ? `${s.professionId} (closest match is used)` : "Choose"}</option>
                    {professions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>AI persona when no student takes it</Label>
                  <Select value={s.clinicianId} onChange={(e) => set(i, { clinicianId: e.target.value })}>
                    {clinicians.map((c) => <option key={c.id} value={c.id}>{c.name}, {c.role}</option>)}
                    {s.clinicianId.startsWith("generic:") && <option value={s.clinicianId}>{s.clinicianId.slice(8).split("|")[0]} (no provided persona of this profession; a plain clinician)</option>}
                    {!s.clinicianId.startsWith("generic:") && <option value={`generic:${GENERIC[i % GENERIC.length]}|${s.roleTitle || "Clinician"}`}>A plain clinician of this profession (no provided persona fits)</option>}
                  </Select>
                </div>
                <div>
                  <Label>Simulated time</Label>
                  <Input value={s.simTime} onChange={(e) => set(i, { simTime: e.target.value })} placeholder="Week 1, Mon 10:30" />
                </div>
                <div className="md:col-span-3">
                  <Label>Focus: what this professional is there to do</Label>
                  <Textarea rows={2} value={s.focus} onChange={(e) => set(i, { focus: e.target.value })} />
                </div>
                <div>
                  <Label>Kind of contact</Label>
                  <Input value={s.visitLabel || ""} onChange={(e) => set(i, { visitLabel: e.target.value })} placeholder="video follow-up" />
                </div>
                <div className="mt-1 rounded-2xl bg-[var(--color-mastery-soft)] p-3.5 md:col-span-4">
                  <p className="mb-3 flex items-start gap-2 text-xs text-ink-2"><Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-mastery-ink)]" aria-hidden />What a student who takes this role, and the patient, are told. Topics only: none of this may give away a finding the patient has not yet disclosed. Left empty, a neutral default built from the role is used (never the source case&apos;s own brief).</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Brief shown to the student in the waiting room</Label>
                      <Textarea rows={4} value={s.brief || ""} onChange={(e) => set(i, { brief: e.target.value })} placeholder="You are the ... seeing ... by video. Explore ... and hand off with an SBAR." />
                    </div>
                    <div>
                      <Label>Student tasks, one per line</Label>
                      <Textarea rows={4} value={(s.tasks || []).join("\n")} onChange={(e) => set(i, { tasks: e.target.value.split("\n") })} placeholder={"Read the handoff and the shared state\nExplore ...\nWrite an SBAR handoff to ..."} />
                    </div>
                    <div>
                      <Label>Why the patient is on this call, in the patient&apos;s own words</Label>
                      <Textarea rows={2} value={s.patientReason || ""} onChange={(e) => set(i, { patientReason: e.target.value })} placeholder="They told me the heart doctor wanted to follow up with me." />
                    </div>
                    <div>
                      <Label>Booked reason shown in the chart header</Label>
                      <Input value={s.reason || ""} onChange={(e) => set(i, { reason: e.target.value })} placeholder="Cardiology video follow-up" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </BuilderSection>

      <BuilderSection n={3} icon={Sparkles} tone="bg-[var(--color-xp)] text-ink" title="Name and publish">
        <div className="space-y-3">
          <div>
            <Label>Journey title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Summary shown to students before they choose a role</Label>
            <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => save(true)} disabled={!!busy || !title.trim() || stages.length < 3}>{initial?.status === "published" ? "Save changes" : "Publish to students"}</Button>
            {initial?.status !== "published" && <Button variant="secondary" onClick={() => save(false)} disabled={!!busy || !title.trim()}>Save as draft</Button>}
            {stages.length < 3 && <span className="text-xs font-semibold text-amber-800">Add at least three encounters to publish.</span>}
            {(busy === "save" || busy === "publish") && <Spinner label="Saving" />}
            {saved && <span className="pop-in rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-900">{saved}</span>}
            {err && <span className="text-sm font-semibold text-rose-700">{err}</span>}
          </div>
        </div>
      </BuilderSection>
    </div>
  );
}

function BuilderSection({ n, icon: Icon, tone, title, subtitle, children }: { n: number; icon: typeof Route; tone: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rise rounded-[24px] border border-line/80 bg-surface shadow-e1" style={{ ["--i" as string]: n }}>
      <header className="flex items-start gap-3 px-5 pb-3 pt-5">
        <span className={cx("relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl clay", tone)}>
          <Icon className="h-5 w-5" aria-hidden />
          <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink font-mono text-[10.5px] font-bold text-white">{n}</span>
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[20px] font-black tracking-[-0.025em] text-ink"><span className="sr-only">{n}. </span>{title}</h2>
          {subtitle && <p className="mt-0.5 max-w-3xl text-[13px] leading-relaxed text-ink-3">{subtitle}</p>}
        </div>
      </header>
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}
