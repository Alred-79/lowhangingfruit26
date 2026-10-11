import type { EncounterConfig, EncounterState, PatientEnded } from "../types";
import type { GateResult } from "./gatekeeper";

/** Never end a call before this many student messages. */
export const MIN_TURN_TO_END = 4;
/** The "bottom band" in patient.ts, where the patient is curt and may want to stop. */
export const UPSET_BELOW = 25;

const ASKS = new Set(["open", "focused", "closed", "leading", "multiple"]);

/** True when the patient's last words invite an answer ("...does that make sense?"). */
export function patientAsked(lastPatientText: string | undefined): boolean {
  if (!lastPatientText) return false;
  return /\?/.test(lastPatientText.trim().slice(-140));
}

/** Student messages that are hostile this turn, counted as a consecutive run. Pure helper for runTurn. */
export function nextHostileRun(state: EncounterState, gate: GateResult): number {
  return gate.signals.judgmental || gate.signals.dismissive ? (state.hostileRun || 0) + 1 : 0;
}

export interface EndInput {
  cfg: EncounterConfig;
  /** State before this turn is applied, except `turn`, which is already this turn's number. */
  state: EncounterState;
  gate: GateResult;
  message: string;
  lastPatientText?: string;
  /** Rapport after this turn's signals. */
  rapportAfter: number;
  hostileRun: number;
  /** Whether the patient would be answering a clinical question this turn. */
  answering: boolean;
  elapsedMin: number;
}

/**
 * Deterministic: may the patient end the call on this turn? The language model only words the goodbye.
 * Conservative on purpose; the care-journey AI clinician never gets hung up on.
 */
export function decideEnd(i: EndInput): PatientEnded["reason"] | null {
  const { cfg, state, gate } = i;
  if (cfg.journey?.ai) return null;
  if (state.endedBy) return null;
  if (state.turn < MIN_TURN_TO_END) return null;

  // Sustained mistreatment: already in the bottom band before this message, still there, and a run of hostile messages.
  if (state.rapport < UPSET_BELOW && i.rapportAfter < UPSET_BELOW && i.hostileRun >= 2 && (gate.signals.judgmental || gate.signals.dismissive)) return "upset";

  // A clear, question-free goodbye that leaves no question of the patient's unanswered.
  const asking = ASKS.has(gate.question_type) || /\?/.test(i.message);
  if (gate.signals.closing === true && !asking && !patientAsked(i.lastPatientText) && i.message.length <= 300) return "closed";

  // Well past the natural length: the patient has to go, but never in the middle of answering a clinical question in an exam.
  const limit = cfg.knobs.timeLimitMin;
  if (limit && i.elapsedMin >= limit + Math.max(5, Math.round(limit * 0.25)) && !(cfg.mode === "exam" && i.answering)) return "time";
  return null;
}

/** Prompt block that replaces the disclosure instructions when the patient is ending the call. */
export function endingDirective(reason: PatientEnded["reason"]): string {
  const base = "THE CALL ENDS IN THIS REPLY. Say one or two short sentences in your own voice, then you hang up. Do not share any new medical information or ask a new question.";
  if (reason === "closed") return `${base} The student has wrapped up the visit. Say a brief, natural goodbye (thank them if the visit went well, or just sign off), as a real patient would.`;
  if (reason === "upset") return `${base} You have felt disrespected for a while. Say calmly and firmly that you would like to stop here and end the call. No insults and no shouting; make it clear why in a few words (you do not feel listened to).`;
  return `${base} The visit has run well past the time you had set aside. Say politely that you have to get going now and will end the call.`;
}
