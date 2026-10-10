import { loadEncounter, messagesOf, type MessageRow } from "../engine/encounter";
import { chatJSON, MODELS } from "../llm";
import { get } from "../db";
import { aliasing, approvedCorpus, entryLine, unverifiedValues } from "./context";
import { addEntry, addLink, entriesOf, norm, quoteIn, RECORD_STAGE, studentNameOf, who, type LoadedRun } from "./store";
import type { EntryKind, EntrySource, EntryStatus, Evidence, Relation, Stage } from "./types";

/** Stage 0: the record that existed before anyone on this team saw the patient. */
export function seedRecord(run: LoadedRun) {
  if (get("SELECT 1 FROM state_entries WHERE run_id = ? AND stage_id = ?", run.row.id, RECORD_STAGE)) return;
  const base = { runId: run.row.id, status: "established" as const, source: "record" as const, contributorRole: "Existing record", contributorName: "Patient chart", contributorIsAi: false, stageId: RECORD_STAGE, stageOrder: 0, simTime: "Before the journey" };
  for (const item of run.c.chartAtStart || []) {
    addEntry({ ...base, kind: "record", category: item.label, text: `${item.label}: ${item.value}`, evidence: { where: "record", ref: item.label, quote: item.value, verified: true } });
  }
  for (const d of (run.c.artifacts || []).filter((a) => a.release.when === "start")) {
    addEntry({ ...base, kind: "record", category: "Documents on file", text: `Document on file: ${d.title}${d.date ? ` (${d.date})` : ""}${d.author ? `, ${d.author}` : ""}`, evidence: { where: "record", ref: d.id, verified: true } });
  }
}

const ACTION_SOURCE: Record<string, EntrySource> = { exam: "exam", vitals: "test", lab: "test", imaging: "test", test: "test", assessment: "test", procedure: "test", record: "record" };

const MODEL_KINDS = ["assessment", "interpretation", "recommendation", "referral", "plan_item", "goal", "uncertainty", "open_question", "disagreement", "follow_up"] as const;
const RELATIONS: Relation[] = ["uses", "confirms", "contradicts", "updates", "answers", "resolves"];

const str = { type: "string" };
const SCHEMA = {
  type: "object",
  required: ["entries", "uses"],
  properties: {
    entries: {
      type: "array",
      description: "New contributions made by the clinician in THIS encounter. Do not repeat patient facts or results already listed for this encounter.",
      items: {
        type: "object",
        required: ["kind", "text", "status", "where", "quote"],
        properties: {
          kind: { type: "string", enum: [...MODEL_KINDS] },
          text: { type: "string", description: "One self-contained sentence in chart language. No values, doses or diagnoses that are not in the transcript, note or listed entries." },
          status: { type: "string", enum: ["established", "uncertain", "open_question", "disputed", "patient_reported"] },
          where: { type: "string", enum: ["visit", "note"], description: "Where the evidence is: the visit transcript or the clinician's written note" },
          turn: { type: "integer", description: "Turn number when where = visit" },
          quote: { type: "string", description: "5-25 words copied EXACTLY from that turn or from the note" },
          relates_to: { type: "string", description: "Label (e.g. E7) of the one entry this most directly builds on, answers, contradicts or updates. Omit if none." },
          relation: { type: "string", enum: RELATIONS },
        },
      },
    },
    uses: {
      type: "array",
      description: "Each moment in the visit where the clinician asked about, checked or explicitly built on an entry from an EARLIER encounter or the existing record.",
      items: {
        type: "object",
        required: ["turn", "entry", "quote"],
        properties: { turn: { type: "integer" }, entry: { type: "string", description: "Label of the earlier entry, e.g. E4" }, quote: { type: "string", description: "The clinician's exact words in that turn (5-25 words)" } },
      },
    },
  },
};

const SYSTEM = `You maintain the shared patient state for an interprofessional care team in a clinical training simulation. After each encounter you record what the clinician contributed, with evidence.

Rules:
- Patient-reported facts and exam/test results for this encounter are already recorded from the simulation's disclosure ledger. Never re-enter them and never add new patient facts, values or results.
- Record only what the clinician actually said in the visit or wrote in the note: assessments, interpretations, recommendations, referrals, care-plan items, patient goals or preferences the clinician elicited that are not already listed, and explicitly: uncertainties, unanswered or open questions, and disagreements with an earlier entry (including when what the patient says does not match the record or a colleague's entry).
- kind "disagreement" needs relates_to = the entry it disagrees with and relation "contradicts". kind "follow_up" is for when the clinician checked an earlier entry and it was confirmed or updated; give relates_to and relation.
- An entry that answers an earlier unanswered question uses relation "answers"; one that settles an earlier uncertainty or dispute uses "resolves".
- The simulated patient sometimes says clinical things that are not in the case file. The lists of recorded entries are the only confirmed clinical facts. If a clinician's conclusion depends on a symptom or event that appears only in the patient's words and not in any recorded entry, either leave it out or record it as "uncertain" and say in the text that it is not confirmed in the record.
- Status: "established" only for something the clinician states firmly; "uncertain" for hedged or provisional judgements; "open_question" for things nobody knows yet; "disputed" for disagreements.
- Every entry needs a quote copied exactly from the stated turn or from the note. If you cannot quote it, do not record it.
- "uses": list every turn where the clinician's question or statement clearly draws on a specific earlier entry. Be strict: the link must be recognisable from the words used.
- 4 to 10 entries is typical. Prefer fewer, precise entries over many vague ones.`;

export interface StageExtraction {
  deterministic: number;
  extracted: number;
  dropped: number;
  downgraded: number;
  uses: number;
}

/**
 * Updates the shared state after a stage's encounter. Deterministic entries come from the engine's
 * disclosure ledger; clinician contributions are model-extracted and each quote is checked against
 * the transcript or note before the entry is kept.
 */
export async function extractStage(run: LoadedRun, stage: Stage, encounterId: string, note: string, declaredUses: { turn: number; entryIds: string[]; quote: string }[] = [], opts: { ledgerOnly?: boolean } = {}): Promise<StageExtraction> {
  const enc = loadEncounter(encounterId);
  if (!enc) throw new Error("Stage encounter not found");
  const runId = run.row.id;
  const msgs = messagesOf(encounterId);
  const w = who(run, stage, studentNameOf(run.row.user_id));
  const base = { runId, contributorRole: w.role, contributorName: w.name, contributorIsAi: w.isAi, stageId: stage.id, stageOrder: stage.order, encounterId, simTime: stage.simTime };
  const stats: StageExtraction = { deterministic: 0, extracted: 0, dropped: 0, downgraded: 0, uses: 0 };
  const patientAt = (turn: number) => msgs.find((m) => m.turn === turn && m.speaker === "patient");
  const already = entriesOf(runId).filter((e) => e.stageId === stage.id);

  // ----- Deterministic: the ledger decides what was disclosed and which results came back -----
  for (const f of enc.c.facts) {
    const d = enc.state.disclosed[f.id];
    if (!d || d.how === "record" || d.turn <= 0) continue; // on record from an earlier stage
    if (already.some((e) => e.factId === f.id)) continue;
    addEntry({
      ...base,
      kind: f.category === "goals" ? "goal" : "finding",
      category: f.category,
      text: f.chart,
      status: "patient_reported",
      source: "patient",
      factId: f.id,
      evidence: { where: "visit", turn: d.turn, speaker: "patient", quote: (patientAt(d.turn)?.text || f.says).slice(0, 400), verified: true },
      meta: { importance: f.importance, flags: d.how === "volunteered" ? ["volunteered"] : [] },
    });
    stats.deterministic++;
  }
  for (const a of enc.c.actions) {
    const d = enc.state.actions[a.id];
    if (!d) continue;
    const text = `${a.name}: ${a.result}`;
    if (already.some((e) => e.text === text)) continue;
    addEntry({
      ...base,
      kind: "result",
      category: a.kind,
      text,
      status: "established",
      source: ACTION_SOURCE[a.kind] || "test",
      evidence: { where: "visit", turn: d.turn, speaker: "chart", quote: `Requested: ${d.request}`, verified: true },
      meta: { importance: a.importance, abnormal: !!a.abnormal },
    });
    stats.deterministic++;
  }
  // Faculty-authored patient-versus-record conflicts become disputes the moment the patient's claim is on record.
  for (const m of enc.c.mismatches || []) {
    const d = m.factId ? enc.state.disclosed[m.factId] : undefined;
    if (!d || d.how === "record") continue;
    const text = `Patient's account ("${m.patientClaim}") does not match the record: ${m.recordEvidence}`;
    if (already.some((e) => e.text === text)) continue;
    const target = entriesOf(runId).find((e) => e.factId === m.factId);
    addEntry({ ...base, kind: "disagreement", category: "Patient versus record", text, status: "disputed", source: "record", evidence: { where: "record", ref: m.artifactId || m.id, quote: m.recordEvidence, verified: true }, relatesTo: target?.id, relation: target ? "contradicts" : null });
    stats.deterministic++;
  }

  if (opts.ledgerOnly) return stats;

  // ----- Model-extracted clinician contributions, evidence-checked -----
  const all = entriesOf(runId);
  const visible = all.filter((e) => e.stageOrder <= stage.order);
  const { toAlias, resolve } = aliasing(visible);
  const prior = visible.filter((e) => e.stageOrder < stage.order);
  const mine = visible.filter((e) => e.stageId === stage.id);
  const spoken = msgs.filter((m) => m.speaker === "student" || m.speaker === "patient" || m.speaker === "system");
  const transcript = spoken.map((m) => `[T${m.turn}] ${m.speaker === "student" ? "CLINICIAN" : m.speaker === "patient" ? "PATIENT" : "CHART"}: ${m.text}`).join("\n");

  type Raw = {
    entries: { kind: string; text: string; status: string; where: string; turn?: number; quote: string; relates_to?: string; relation?: string }[];
    uses: { turn: number; entry: string; quote: string }[];
  };
  let raw: Raw = { entries: [], uses: [] };
  if (spoken.length || note.trim()) {
    raw = await chatJSON<Raw>({
      model: MODELS.smart,
      system: SYSTEM,
      schema: SCHEMA,
      maxTokens: 5000,
      messages: [
        {
          role: "user",
          text: `THIS ENCOUNTER: encounter ${stage.order}, ${w.name} (${stage.roleTitle}), ${stage.simTime}. Purpose: ${stage.focus}

ENTRIES FROM THE EXISTING RECORD AND EARLIER ENCOUNTERS
${prior.map((e) => entryLine(e, toAlias.get(e.id))).join("\n") || "(none)"}

ALREADY RECORDED FOR THIS ENCOUNTER (from the disclosure ledger; do not repeat)
${mine.map((e) => entryLine(e, toAlias.get(e.id))).join("\n") || "(none)"}

VISIT TRANSCRIPT
${transcript || "(no conversation)"}

CLINICIAN'S WRITTEN NOTE
${note.trim() || "(none)"}`,
        },
      ],
    });
  }

  const corpus = approvedCorpus(enc.c, all);
  const byTurn = (turn: number) => spoken.filter((m) => m.turn === turn);
  const locate = (where: string, turn: number | undefined, quote: string, clinicianOnly = false): Evidence | null => {
    if (where === "note") return quoteIn(quote, note) ? { where: "note", quote, verified: true } : null;
    const ok = (m: MessageRow) => (!clinicianOnly || m.speaker === "student") && quoteIn(quote, m.text);
    const hit = (turn !== undefined ? byTurn(turn).find(ok) : undefined) || spoken.find(ok);
    if (hit) return { where: "visit", turn: hit.turn, speaker: hit.speaker === "student" ? "clinician" : hit.speaker, quote, verified: true };
    return quoteIn(quote, note) ? { where: "note", quote, verified: true } : null;
  };

  const seen = new Set(mine.map((e) => norm(e.text)));
  const created: { id: string; turn?: number; relatesTo?: string }[] = [];
  for (const r of raw.entries || []) {
    if (!MODEL_KINDS.includes(r.kind as (typeof MODEL_KINDS)[number]) || !r.text?.trim()) continue;
    const key = norm(r.text);
    if (seen.has(key)) continue;
    const kind = r.kind as EntryKind;
    let ev = locate(r.where, r.turn, r.quote || "");
    let status: EntryStatus = kind === "open_question" ? "open_question" : kind === "disagreement" ? "disputed" : kind === "uncertainty" ? "uncertain" : kind === "goal" ? "patient_reported" : r.status === "uncertain" ? "uncertain" : "established";
    if (!ev) {
      // No verifiable evidence: claims about what happened are dropped, judgements are kept as uncertain and marked.
      if (kind === "disagreement" || kind === "follow_up" || kind === "goal") {
        stats.dropped++;
        continue;
      }
      if (status === "established") status = "uncertain";
      ev = { where: r.where === "note" ? "note" : "visit", turn: r.turn, quote: r.quote, verified: false };
      stats.downgraded++;
    }
    let relatesTo = resolve(r.relates_to);
    let relation = RELATIONS.includes(r.relation as Relation) ? (r.relation as Relation) : null;
    if (relatesTo && !relation) relation = "uses";
    if (!relatesTo) relation = null;
    if (kind === "disagreement") {
      if (!relatesTo) {
        stats.dropped++;
        continue;
      }
      relation = "contradicts";
    }
    if ((relation === "answers" || relation === "resolves") && relatesTo) {
      const t = visible.find((e) => e.id === relatesTo);
      if (!t || !["open_question", "uncertain", "disputed"].includes(t.effectiveStatus)) relation = "uses";
    }
    if (kind === "follow_up" && !relatesTo) {
      stats.dropped++;
      continue;
    }
    const bad = unverifiedValues(r.text, corpus + " " + note + " " + transcript);
    const flagged = unverifiedValues(r.text, corpus);
    if (bad.length) {
      // A value that appears nowhere: not in the case, not even in what the clinician said. Never stored.
      stats.dropped++;
      continue;
    }
    const id = addEntry({
      ...base,
      kind,
      category: kind === "goal" ? "goals" : "",
      text: r.text,
      status,
      source: kind === "goal" ? "patient" : "clinician",
      evidence: ev,
      relatesTo,
      relation,
      meta: flagged.length ? { unverifiedValues: flagged } : null,
    });
    seen.add(key);
    created.push({ id, turn: ev.where === "visit" ? ev.turn : undefined, relatesTo: relatesTo || undefined });
    stats.extracted++;
  }

  // ----- "Uses": which earlier entries shaped this visit -----
  const uses: { turn: number; entryId: string; quote: string }[] = [];
  for (const u of raw.uses || []) {
    const id = resolve(u.entry);
    const target = prior.find((e) => e.id === id);
    const ev = locate("visit", u.turn, u.quote || "", true);
    if (target && ev?.turn !== undefined) uses.push({ turn: ev.turn, entryId: target.id, quote: u.quote });
  }
  for (const d of declaredUses) for (const id of d.entryIds) if (prior.some((e) => e.id === id) && !uses.some((u) => u.turn === d.turn && u.entryId === id)) uses.push({ turn: d.turn, entryId: id, quote: d.quote });

  const now = entriesOf(runId).filter((e) => e.stageId === stage.id);
  for (const u of uses) {
    const ev: Evidence = { where: "visit", turn: u.turn, speaker: "clinician", quote: u.quote.slice(0, 400), verified: true };
    const learned = now.filter((e) => e.evidence?.where === "visit" && e.evidence.turn === u.turn && (e.source === "patient" || e.kind === "result"));
    const target = prior.find((e) => e.id === u.entryId)!;
    if (learned.length) {
      for (const e of learned) addLink(runId, e.id, u.entryId, "uses", stage.id, ev);
    } else if (target.stageOrder > 0 && !created.some((c) => c.relatesTo === u.entryId) && !now.some((e) => e.kind === "follow_up" && e.text.includes(target.text.slice(0, 60)))) {
      addEntry({ ...base, kind: "follow_up", text: `Asked about earlier information ("${target.text.slice(0, 160)}"); nothing new was disclosed in reply.`, status: "established", source: "clinician", evidence: ev, relatesTo: u.entryId, relation: "uses" });
    }
    stats.uses++;
  }
  return stats;
}
