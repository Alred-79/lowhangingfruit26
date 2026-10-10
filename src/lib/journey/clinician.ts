import { run as sql } from "../db";
import { createEncounter, loadEncounter, messagesOf, runAction, runTurn } from "../engine/encounter";
import { chatJSON, MODELS } from "../llm";
import { aliasing, approvedCorpus, clean, handoffTo, inboxFor, patientMemory, renderSbar, renderState, unverifiedValues } from "./context";
import { clinician, entriesOf, personaBrief, resolveProfession, type LoadedRun } from "./store";
import type { Sbar, Stage, StateEntry } from "./types";

export type StageEvent =
  | { type: "stage_start"; stageId: string; encounterId: string }
  | { type: "clinician"; stageId: string; turn: number; text: string; uses: string[] }
  | { type: "patient_delta"; stageId: string; turn: number; text: string }
  | { type: "patient"; stageId: string; turn: number; text: string; newFacts: number }
  | { type: "action"; stageId: string; turn: number; text: string }
  | { type: "phase"; stageId: string; label: string }
  | { type: "stage_done"; stageId: string }
  | { type: "idle" }
  | { type: "error"; stageId?: string; message: string };

export const AI_TURNS = Math.max(3, Math.min(10, Number(process.env.JOURNEY_AI_TURNS) || 5));

/** Creates the engine encounter that carries a stage, with continuity from every earlier stage. */
export function createStageEncounter(run: LoadedRun, stage: Stage, opts: { ai: boolean; visitorName: string }): string {
  const entries = entriesOf(run.row.id).filter((e) => e.stageOrder < stage.order);
  const handoff = handoffTo(run.row.id, stage.id);
  const priorContext = [handoff ? renderSbar(handoff) : "", renderState(entries, run.stages)].filter(Boolean).join("\n\n");
  const initialDisclosed = [...new Set(entries.map((e) => e.factId).filter((x): x is string => !!x))];
  return createEncounter({
    userId: run.row.user_id,
    caseId: run.journey.case_id,
    professionId: resolveProfession(stage).id,
    mode: "journey",
    // AI colleagues interview at a forgiving level so their visit is productive in a few turns;
    // the student gets the case's own difficulty, capped so a journey stays about teamwork.
    level: opts.ai ? 2 : Math.min(run.c.difficulty || 3, 3),
    knobs: { timeLimitMin: null, hints: !opts.ai },
    assignmentId: opts.ai ? null : run.row.assignment_id,
    journeyRunId: run.row.id,
    journey: { runId: run.row.id, stageId: stage.id, priorContext, patientMemory: patientMemory(run, stage, entries, opts.visitorName) },
    initialDisclosed,
  });
}

const TURN_SCHEMA = {
  type: "object",
  required: ["say", "uses", "order"],
  properties: {
    say: { type: "string", description: "What you say to the patient now: 1-3 sentences, plain language, one question at a time." },
    uses: { type: "array", items: { type: "string" }, description: "At most 2 labels (e.g. E4) of entries from the record or EARLIER encounters that specifically prompted this question. Empty for general questions, introductions and your closing summary." },
    order: { type: "string", description: "Optional: name ONE check from AVAILABLE CHECKS to review or perform now. Empty string for none." },
  },
};

function clinicianSystem(run: LoadedRun, stage: Stage, turns: number) {
  const cl = clinician(stage.clinicianId);
  const p = run.c.patient;
  return `You are ${cl.name}, conducting a telehealth visit with a patient as part of an interprofessional care team in a clinical training simulation. A learner is watching to see how a good colleague works. Stay in role.

WHO YOU ARE
${personaBrief(cl)}

THIS VISIT
The patient: ${p.name}, ${p.age}, ${p.sex}. Encounter ${stage.order} of ${run.stages.length} in their care journey (${stage.simTime}${stage.visitLabel ? `, ${stage.visitLabel}` : ""}). Your role here: ${stage.roleTitle}.
Your purpose: ${stage.focus}

HOW TO WORK
- You have ${turns} exchanges. Use them: open by introducing yourself and your role, then go where your profession adds something the team does not have yet.
- Read the shared record and the handoff first. Do not re-ask what is already on record. Follow up on it instead: when a colleague found something relevant to your role, say so to the patient ("Dr. Lee mentioned that...") and dig one level deeper. List those entries in "uses".
- If what the patient tells you does not fit the record or a colleague's entry, ask about the mismatch directly and kindly.
- Be warm and respectful. Explain why you ask before a sensitive question. No jargon without explanation. Ask one thing at a time.
- Clinical facts are ONLY what is in the shared record and in CONFIRMED IN THIS VISIT. If the patient mentions something clinical that is not in those lists, treat it as unconfirmed: do not build on it, do not repeat it back as fact, and leave it out of your summary.
- Ask open, non-leading questions. Do not suggest symptoms, events or history that are not on record ("you came in because of...", "you mentioned...") unless the record or the confirmed list says so.
- Do not announce a diagnosis, admission or medication change to the patient. Your interpretation goes in your note to the team.
- Never tell the patient a test value, dose or diagnosis that is not in the shared record or the results of this visit.
- You may review or perform checks relevant to your role by naming one in "order" (at most three in the visit). Results come from the case file.
- In your final exchange, summarise what you heard, say what you will pass on to the team, and close.`;
}

/**
 * Runs a stage as an AI clinician. The clinician model only writes the clinician's lines; every
 * patient reply goes through the encounter engine, so the gatekeeper and the tier/rapport rules
 * decide what the patient reveals, exactly as they would for a student.
 */
export async function runAiVisit(run: LoadedRun, stage: Stage, encounterId: string, emit: (e: StageEvent) => void) {
  const cl = clinician(stage.clinicianId);
  const prior = entriesOf(run.row.id).filter((e) => e.stageOrder < stage.order);
  const { toAlias, resolve } = aliasing(prior);
  const handoff = handoffTo(run.row.id, stage.id);
  const inbox = inboxFor(run.row.id, stage.id);
  const system = clinicianSystem(run, stage, AI_TURNS);
  const declaredUses: { turn: number; entryIds: string[]; quote: string }[] = [];
  const enc0 = loadEncounter(encounterId)!;
  const checks = enc0.c.actions.map((a) => a.name);
  let orders = 0;

  for (let i = 1; i <= AI_TURNS; i++) {
    const enc = loadEncounter(encounterId)!;
    const msgs = messagesOf(encounterId).filter((m) => m.speaker === "student" || m.speaker === "patient" || m.speaker === "system");
    const convo = msgs.map((m) => `${m.speaker === "student" ? "YOU" : m.speaker === "patient" ? "PATIENT" : "CHART"}: ${m.text}`).join("\n");
    const doneChecks = enc.c.actions.filter((a) => enc.state.actions[a.id]).map((a) => a.name);
    // What the engine's ledger says has really been established in this visit, as opposed to anything the patient model merely said.
    const confirmed = [
      ...enc.c.facts.filter((f) => enc.state.disclosed[f.id] && enc.state.disclosed[f.id].how !== "record").map((f) => `- Patient reported: ${f.chart}`),
      ...enc.c.actions.filter((a) => enc.state.actions[a.id]).map((a) => `- ${a.name}: ${a.result}`),
    ];
    const out = await chatJSON<{ say: string; uses: string[]; order: string }>({
      model: MODELS.chat,
      system,
      schema: TURN_SCHEMA,
      maxTokens: 500,
      temperature: 0.6,
      messages: [
        {
          role: "user",
          text: `SHARED PATIENT RECORD SO FAR
${renderState(prior, run.stages, { aliases: toAlias })}

${handoff ? "HANDOFF YOU RECEIVED\n" + renderSbar(handoff) : "No handoff: you are the first professional in this journey."}
${inbox ? "\nMESSAGES FROM COLLEAGUES\n" + inbox : ""}

CONFIRMED IN THIS VISIT (from the case file)
${confirmed.join("\n") || "(nothing yet)"}

AVAILABLE CHECKS (${3 - orders} left): ${orders >= 3 ? "none" : checks.filter((c) => !doneChecks.includes(c)).join("; ")}

THIS VISIT SO FAR (exchange ${i} of ${AI_TURNS}${i === AI_TURNS ? ", your final one: summarise and close" : ""})
${convo || "(not started. The patient has just joined the call.)"}`,
        },
      ],
    });
    const say = clean(out.say);
    if (!say) break;
    const usedIds = i === AI_TURNS ? [] : [...new Set((out.uses || []).map(resolve).filter((x): x is string => !!x))].slice(0, 2);
    if (usedIds.length) declaredUses.push({ turn: i, entryIds: usedIds, quote: say });
    emit({ type: "clinician", stageId: stage.id, turn: i, text: say, uses: usedIds });

    let ok = false;
    for await (const ev of runTurn(encounterId, say)) {
      if (ev.type === "delta") emit({ type: "patient_delta", stageId: stage.id, turn: i, text: ev.text });
      else if (ev.type === "done") {
        ok = true;
        emit({ type: "patient", stageId: stage.id, turn: i, text: ev.text, newFacts: ev.newFactIds.length });
      } else if (ev.type === "error") throw new Error(ev.message);
    }
    if (!ok) throw new Error("The patient did not reply.");

    const order = (out.order || "").trim();
    if (order && orders < 3 && i < AI_TURNS) {
      orders++;
      try {
        const res = await runAction(encounterId, order);
        const lines = res.done.filter((d) => !d.repeat).map((d) => `${d.name}: ${d.result}`);
        if (lines.length) emit({ type: "action", stageId: stage.id, turn: i, text: lines.join("\n") });
      } catch (e) {
        console.error("[journey] order failed", e);
      }
    }
  }
  return { clinician: cl, declaredUses };
}

const WRAP_SCHEMA = {
  type: "object",
  required: ["note", "situation", "background", "assessment", "recommendation", "cites"],
  properties: {
    note: { type: "string", description: "Your visit note, 5-9 short sentences under the plain headings Findings / Assessment / Uncertain or unanswered / Recommendations." },
    situation: { type: "string" },
    background: { type: "string" },
    assessment: { type: "string" },
    recommendation: { type: "string" },
    cites: { type: "array", items: { type: "string" }, description: "Labels of the entries from THIS encounter that the handoff passes on" },
  },
};

/**
 * The AI clinician's note and SBAR handoff, written from this stage's entries only (plus the
 * transcript for wording). Values not found in approved content are returned so the UI can mark them.
 */
export async function writeNoteAndHandoff(run: LoadedRun, stage: Stage, encounterId: string, next: { name: string; role: string } | null) {
  const cl = clinician(stage.clinicianId);
  const all = entriesOf(run.row.id);
  const mine = all.filter((e) => e.stageId === stage.id);
  const prior = all.filter((e) => e.stageOrder < stage.order);
  const { toAlias, resolve } = aliasing(all);
  void encounterId;
  const out = await chatJSON<Sbar & { note: string; cites: string[] }>({
    model: MODELS.chat,
    schema: WRAP_SCHEMA,
    maxTokens: 1500,
    temperature: 0.4,
    system: `You are ${cl.name}. You have just finished a telehealth visit and now write (1) a brief visit note and (2) an SBAR handoff to ${next ? `${next.name}, ${next.role}, who sees the patient next` : "the whole care team ahead of the team huddle"}.

${personaBrief(cl)}

Rules:
- Use only what is in the entries from your encounter and the earlier record. They are the complete, verified account of the visit. Do not introduce any symptom, value, dose, result, age or diagnosis that is not listed there, even if you believe it came up.
- Keep findings (what the patient reported, what a check showed) separate from your interpretation, and label the interpretation as yours.
- State plainly what you are unsure of, what does not fit, and what you could not find out.
- The Recommendation must ask the receiving professional for specific things within their role.
- Write in your own voice. SBAR fields are 1-3 sentences each.`,
    messages: [
      {
        role: "user",
        text: `PATIENT: ${run.c.patient.name}, ${run.c.patient.age}, ${run.c.patient.sex}.
YOUR ROLE IN THIS ENCOUNTER: ${stage.roleTitle}. Purpose: ${stage.focus}

RECORD BEFORE YOUR VISIT (for reference)
${prior.map((e) => `- ${e.text}`).join("\n").slice(0, 3500)}

ENTRIES FROM YOUR ENCOUNTER (cite these labels)
${mine.map((e) => `[${toAlias.get(e.id)}] (${e.kind}, ${e.status}) ${e.text}`).join("\n") || "(nothing new was disclosed)"}`,
      },
    ],
  });
  const corpus = approvedCorpus(run.c, all);
  out.note = clean(out.note);
  const sbar: Sbar = { situation: clean(out.situation), background: clean(out.background), assessment: clean(out.assessment), recommendation: clean(out.recommendation) };
  const cites = [...new Set((out.cites || []).map(resolve).filter((x): x is string => !!x && mine.some((e) => e.id === x)))];
  return { note: out.note || "", sbar, cites, unverified: unverifiedValues(`${out.note} ${Object.values(sbar).join(" ")}`, corpus) };
}

/** AI-stage encounters are closed without scoring so they never count as an attempt by the student. */
export function closeAiEncounter(encounterId: string, note: string) {
  sql("UPDATE encounters SET status = 'abandoned', wrapup = ?, ended_at = datetime('now') WHERE id = ?", JSON.stringify({ note }), encounterId);
}

export type { StateEntry };
