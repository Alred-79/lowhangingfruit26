import type { CaseProfile } from "../types";
import { clinician, handoffsOf, messagesOfRun, RECORD_STAGE, type LoadedRun } from "./store";
import { STATUS_LABEL, type Handoff, type Stage, type StateEntry } from "./types";

/** Short per-call aliases (E1, E2, ...) so prompts stay small and models cannot mangle long ids. */
export function aliasing(entries: StateEntry[]) {
  const toAlias = new Map<string, string>();
  const fromAlias = new Map<string, string>();
  entries.forEach((e, i) => {
    toAlias.set(e.id, `E${i + 1}`);
    fromAlias.set(`E${i + 1}`, e.id);
  });
  const resolve = (a: unknown): string | null => {
    if (typeof a !== "string") return null;
    const m = a.trim().toUpperCase().match(/E?(\d+)/);
    return (m && fromAlias.get(`E${m[1]}`)) || null;
  };
  return { toAlias, fromAlias, resolve };
}

/** Removes prompt-only entry labels (E12) that a model let slip into text people will read. */
export const clean = (s: string | undefined | null) =>
  (s || "")
    .replace(/\s*[\[(](?:E\d{1,3}(?:\s*[,;&]\s*|\s+and\s+)?)+[\])]/g, "")
    .replace(/\b(?:entry|entries|item)\s+E\d{1,3}\b/gi, "this item")
    .replace(/\bE\d{1,3}\b/g, "this item")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

export function entryLine(e: StateEntry, alias?: string) {
  const by = e.stageId === RECORD_STAGE ? "existing record" : `${e.contributorName}, ${e.contributorRole}, ${e.simTime}`;
  return `${alias ? `[${alias}] ` : "- "}(${STATUS_LABEL[e.effectiveStatus]}; ${e.kind.replace("_", " ")}; ${by}) ${e.text}`;
}

/** The shared state as text, oldest stage first. Used for clinician prompts and for cfg.journey.priorContext. */
export function renderState(entries: StateEntry[], stages: Stage[], opts: { aliases?: Map<string, string>; max?: number } = {}): string {
  const groups: { title: string; items: StateEntry[] }[] = [{ title: "EXISTING RECORD (before this journey)", items: entries.filter((e) => e.stageId === RECORD_STAGE) }];
  for (const s of stages) {
    const items = entries.filter((e) => e.stageId === s.id);
    if (items.length) groups.push({ title: `ENCOUNTER ${s.order}: ${s.roleTitle} (${s.simTime})`, items });
  }
  const max = opts.max ?? 400;
  return groups
    .filter((g) => g.items.length)
    .map((g) => `${g.title}\n${g.items.slice(0, max).map((e) => entryLine(e, opts.aliases?.get(e.id))).join("\n")}`)
    .join("\n\n");
}

export function renderSbar(h: Handoff): string {
  return `SBAR handoff from ${h.authorName} (${h.authorRole}) to ${h.toName || "the team"}\nSituation: ${h.sbar.situation}\nBackground: ${h.sbar.background}\nAssessment: ${h.sbar.assessment}\nRecommendation: ${h.sbar.recommendation}`;
}

/** The handoff addressed to a stage (the one written by the stage before it). */
export function handoffTo(runId: string, stageId: string): Handoff | null {
  return handoffsOf(runId).filter((h) => h.toStage === stageId).pop() || null;
}

/** Consults, clarifications and call-outs a stage's professional has received from colleagues so far. */
export function inboxFor(runId: string, stageId: string): string {
  const msgs = messagesOfRun(runId).filter((m) => (m.thread === `consult:${stageId}` || m.kind === "callout") && m.thread !== "huddle");
  if (!msgs.length) return "";
  return msgs.map((m) => `${m.fromName} (${m.fromRole})${m.kind === "callout" ? " [call-out to the whole team]" : ""}: ${m.text}`).join("\n");
}

/**
 * What the patient remembers of earlier visits. Built without a model: who they saw, when, which
 * topics came up and which checks were done. The facts themselves reach the patient prompt through
 * the engine's disclosed-facts list, so the patient cannot "remember" anything that was not approved.
 */
export function patientMemory(run: LoadedRun, upcoming: Stage, entries: StateEntry[], upcomingName: string): string {
  const c: CaseProfile = run.c;
  const lines: string[] = [];
  for (const s of run.stages) {
    if (s.order >= upcoming.order) continue;
    const mine = entries.filter((e) => e.stageId === s.id);
    if (!mine.length) continue;
    const isStudent = s.id === run.row.student_stage_id;
    const name = isStudent ? "a student clinician" : clinician(s.clinicianId).name;
    const topics = [...new Set(mine.filter((e) => e.factId).map((e) => c.facts.find((f) => f.id === e.factId)?.topic).filter(Boolean))].slice(0, 10);
    const checks = mine.filter((e) => e.kind === "result").map((e) => e.text.split(":")[0]).slice(0, 5);
    lines.push(
      `- ${s.simTime}: you spoke with ${name} (${s.roleTitle})${s.visitLabel ? `, ${s.visitLabel}` : ""}.` +
        (topics.length ? ` You talked about: ${topics.join(", ")}.` : "") +
        (checks.length ? ` They looked at: ${checks.join(", ")}.` : ""),
    );
  }
  const today = `TODAY (${upcoming.simTime}) you are speaking with ${upcomingName}, ${upcoming.roleTitle}${upcoming.visitLabel ? ` (${upcoming.visitLabel})` : ""}. It is a different person from the earlier visits and part of the same care team.`;
  if (!lines.length) return `${today}\nThis is your first contact with this care team.`;
  return `${lines.join("\n")}\n${today}\nYou remember those earlier conversations. Anything you already told the team (it is in the list of things you have said) you do not need to be coaxed into saying again; you may say "like I told the other one..." when it comes up. You expect the team to have talked to each other, and you notice if they have not.`;
}

/**
 * Guardrail for model-written clinical text: returns dose/lab-style values that do not appear in the
 * approved case content or in entries already on record. Callers flag them; they never pass silently.
 */
export function unverifiedValues(text: string, corpus: string): string[] {
  const squash = (s: string) => s.toLowerCase().replace(/[\s,]+/g, "");
  const hay = squash(corpus);
  const out = new Set<string>();
  const re = /\d+(?:\.\d+)?\s?(?:mg\/dl|meq\/l|mmhg|mcg|mg|kg|lbs?|%|bpm|g\/dl|ml\/min|units?)(?![a-z])|\b\d{2,3}\/\d{2,3}\b/gi;
  for (const m of text.match(re) || []) {
    const num = m.match(/\d+(?:\.\d+)?(?:\/\d+)?/)![0];
    const unit = squash(m.replace(num, ""));
    if (!hay.includes(squash(m)) && !hay.includes(num + unit) && !(unit === "" && hay.includes(num))) out.add(m.trim());
  }
  return [...out];
}

/** Every approved string of a case, for the value guardrail. */
export function approvedCorpus(c: CaseProfile, entries: StateEntry[]): string {
  return [
    ...c.chartAtStart.map((x) => `${x.label} ${x.value}`),
    ...c.facts.flatMap((f) => [f.chart, f.says]),
    ...c.actions.flatMap((a) => [a.name, a.result]),
    ...c.artifacts.flatMap((a) => [a.title, a.body || "", ...(a.table?.rows || []).flatMap((r) => r.cells)]),
    ...entries.filter((e) => e.source !== "clinician" && e.source !== "consult" && e.source !== "huddle").map((e) => e.text),
  ].join(" \n ");
}
