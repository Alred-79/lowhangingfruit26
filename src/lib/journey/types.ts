// Care Journeys domain types. Pure data and constants: safe to import from client components.

export interface Stage {
  id: string;
  order: number;
  /** A role from data/professions.json. Resolved at runtime; unknown ids fall back gracefully. */
  professionId: string;
  /** How this professional is named in the journey, e.g. "Emergency medicine attending". */
  roleTitle: string;
  /** Row in `clinicians`. The AI plays this persona when the student is not in the stage. */
  clinicianId: string;
  /** What this professional is there to do. */
  focus: string;
  /** Simulated date/time label, used as the provenance time. */
  simTime: string;
  /** Short description of the kind of contact, e.g. "ED follow-up video call". */
  visitLabel?: string;
}

export interface JourneySpec {
  summary: string;
  stages: Stage[];
}

export type EntryStatus = "established" | "patient_reported" | "uncertain" | "disputed" | "open_question" | "resolved";
export type EntrySource = "record" | "patient" | "exam" | "test" | "clinician" | "consult" | "huddle";
export type EntryKind =
  | "record"
  | "finding"
  | "result"
  | "assessment"
  | "interpretation"
  | "recommendation"
  | "referral"
  | "plan_item"
  | "goal"
  | "uncertainty"
  | "open_question"
  | "disagreement"
  | "follow_up"
  | "consult"
  | "callout"
  | "resolution"
  | "plan_change";
export type Relation = "uses" | "confirms" | "contradicts" | "updates" | "answers" | "resolves";

export interface Evidence {
  /** Where the quote lives. */
  where: "visit" | "note" | "record" | "consult" | "huddle" | "sbar";
  turn?: number;
  speaker?: string;
  quote?: string;
  /** False when a model-cited quote could not be found and the entry was downgraded. */
  verified?: boolean;
  ref?: string;
}

export interface StateEntry {
  id: string;
  runId: string;
  kind: EntryKind;
  category: string;
  text: string;
  /** Status as written. Never edited. */
  status: EntryStatus;
  /** Status after later entries are taken into account (contradicted, resolved, answered). */
  effectiveStatus: EntryStatus;
  source: EntrySource;
  contributorRole: string;
  contributorName: string;
  contributorIsAi: boolean;
  stageId: string;
  stageOrder: number;
  encounterId: string | null;
  factId: string | null;
  evidence: Evidence | null;
  simTime: string;
  createdAt: string;
  meta: { unverifiedValues?: string[]; owner?: string; importance?: string; abnormal?: boolean; flags?: string[] } | null;
}

export interface StateLink {
  id: number;
  from: string;
  to: string;
  relation: Relation;
  stageId: string;
  evidence: Evidence | null;
  createdAt: string;
}

export interface Sbar {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}
export const SBAR_FIELDS: { key: keyof Sbar; label: string; prompt: string }[] = [
  { key: "situation", label: "Situation", prompt: "What is happening with the patient right now?" },
  { key: "background", label: "Background", prompt: "What relevant background does the next professional need?" },
  { key: "assessment", label: "Assessment", prompt: "What did you find, and what do you conclude? Say which is which, and what you are unsure of." },
  { key: "recommendation", label: "Recommendation", prompt: "What do you need the next professional to do, consider or follow up on?" },
];

export type Observed = "yes" | "no" | "na";

export interface BehaviourDef {
  key: string;
  domain: "Communication" | "Situation monitoring" | "Mutual support" | "Leadership and coordination";
  label: string;
  question: string;
  /** Behaviours that can be judged from an SBAR alone. */
  sbar?: boolean;
}

/** TeamSTEPPS-aligned behaviours evaluated in a run. Adding a behaviour here is all that is needed to evaluate it. */
export const BEHAVIOURS: BehaviourDef[] = [
  { key: "com_situation", domain: "Communication", label: "Situation", question: "Clearly stated what is happening with the patient right now.", sbar: true },
  { key: "com_background", domain: "Communication", label: "Relevant background", question: "Gave the background the receiving professional needs, without burying it.", sbar: true },
  { key: "com_findings", domain: "Communication", label: "Important findings", question: "Passed on the important findings from this encounter.", sbar: true },
  { key: "com_finding_vs_interp", domain: "Communication", label: "Findings distinguished from interpretation", question: "Made clear what was observed or reported versus what is the professional's own interpretation.", sbar: true },
  { key: "com_uncertainty", domain: "Communication", label: "Uncertainty stated", question: "Named what remains uncertain or unverified.", sbar: true },
  { key: "com_next_action", domain: "Communication", label: "Next action requested", question: "Asked the receiving professional for a specific next action.", sbar: true },
  { key: "sm_prior", domain: "Situation monitoring", label: "Reviewed prior information", question: "Used relevant information from earlier encounters or the incoming handoff." },
  { key: "sm_changes", domain: "Situation monitoring", label: "Recognised changes", question: "Recognised what has changed since the earlier encounters or the record." },
  { key: "sm_contradictions", domain: "Situation monitoring", label: "Noticed contradictions", question: "Noticed where the patient's account, the record or a colleague's entry disagree." },
  { key: "sm_unresolved", domain: "Situation monitoring", label: "Identified unresolved concerns", question: "Picked up concerns left open by earlier professionals." },
  { key: "sm_missing", domain: "Situation monitoring", label: "Recognised missing information", question: "Recognised information the team still does not have." },
  { key: "ms_clarify", domain: "Mutual support", label: "Asked for clarification", question: "Asked a colleague to clarify when something was unclear or incomplete." },
  { key: "ms_respond", domain: "Mutual support", label: "Responded to requests", question: "Responded to what a colleague asked for in a handoff or message." },
  { key: "ms_acknowledge", domain: "Mutual support", label: "Acknowledged a colleague's contribution", question: "Explicitly acknowledged or built on another professional's contribution." },
  { key: "ms_escalate", domain: "Mutual support", label: "Escalated appropriately", question: "Escalated a safety or urgent concern to the right person." },
  { key: "lc_responsibilities", domain: "Leadership and coordination", label: "Responsibilities", question: "Made clear who is responsible for what." },
  { key: "lc_next_steps", domain: "Leadership and coordination", label: "Next steps", question: "Set out concrete next steps." },
  { key: "lc_goals", domain: "Leadership and coordination", label: "Patient goals", question: "Brought the patient's own goals and preferences into the team's plan." },
  { key: "lc_coordinated", domain: "Leadership and coordination", label: "Coordinated recommendations", question: "Aligned own recommendations with those of other professions rather than adding a separate list." },
];

export interface BehaviourResult {
  key: string;
  observed: Observed;
  /** Human-readable evidence location, e.g. "SBAR -> Recommendation", "Visit, turn 4", "Consult with Dr. Bennet". */
  location: string;
  quote: string;
  /** True when the quote was found verbatim at the stated location. */
  verified: boolean;
  feedback: string;
}

export interface TraceEvaluation {
  scope: "sbar" | "stage";
  subject: string;
  behaviours: BehaviourResult[];
  summary: string;
  evaluatedAt: string;
}

export interface Handoff {
  id: string;
  fromStage: string;
  toStage: string | null;
  authorRole: string;
  authorName: string;
  authorIsAi: boolean;
  toName: string;
  sbar: Sbar;
  /** Entry ids the author drew on (AI handoffs only; validated). */
  cites: string[];
  evaluation: TraceEvaluation | null;
  createdAt: string;
}

export interface TeamMessage {
  id: number;
  thread: string;
  kind: string;
  fromRole: string;
  fromName: string;
  fromIsAi: boolean;
  toRole: string | null;
  text: string;
  meta: {
    stageId?: string;
    cites?: string[];
    /** request | question | information | checkback | confirmation | callout | acknowledgement | answer | readback | other */
    act?: string;
    loop?: "opened" | "read_back" | "closed";
    itemId?: string;
    entryId?: string;
    duringStage?: string;
  } | null;
  createdAt: string;
}

export interface StageView {
  stage: Stage;
  professionName: string;
  clinicianName: string;
  clinicianRole: string;
  isStudent: boolean;
  status: string;
  encounterId: string | null;
  encounterStatus: string | null;
  error: string | null;
  note: string | null;
  transcript: { id: number; turn: number; speaker: string; text: string }[];
}

export interface PlanItem {
  id: string;
  action: string;
  ownerRoles: string[];
  timeframe: string;
  rationale: string;
  restsOn: string[];
  /** Distinct professions among the entries this item rests on; computed, not model-written. */
  professions: string[];
  revisions?: { at: string; by: string; from: string; to: string; reason: string }[];
}
export interface PlanProblem {
  id: string;
  title: string;
  patientGoal: string;
  summary: string;
  items: PlanItem[];
}
export interface Synthesis {
  patientSummary: string;
  summaryCites: string[];
  problems: PlanProblem[];
  droppedItems: number;
  generatedAt: string;
}

export interface HuddleItem {
  entryId: string;
  /** Why it is on the agenda. */
  reason: "disputed" | "open_question" | "uncertain";
  positions: { stageId: string; name: string; role: string; text: string; cites: string[] }[];
  outcome?: { decision: "resolved" | "still_open"; text: string; entryId: string; owner?: string; teamResponse: string };
}
export interface Huddle {
  status: "open" | "closed";
  items: HuddleItem[];
  startedAt: string;
  closedAt?: string;
}

export interface ChainStep {
  label: string;
  detail: string;
  who: string;
  stageOrder: number;
  entryId?: string;
  quote?: string;
  kind: "discovered" | "handed_off" | "asked" | "new_information" | "incorporated" | "plan";
}
export interface Chain {
  id: string;
  title: string;
  steps: ChainStep[];
  stagesSpanned: number;
}

export interface PillarRow {
  stageId: string;
  role: string;
  name: string;
  isStudent: boolean;
  used: number;
  contributed: number;
  identified: number;
  communicated: boolean;
}

export interface RunView {
  id: string;
  status: string;
  journey: { id: string; title: string; summary: string };
  patient: { name: string; age: number; sex: string; summary: string };
  caseTitle: string;
  studentStageId: string;
  studentName: string;
  viewerIsOwner: boolean;
  stages: StageView[];
  entries: StateEntry[];
  links: StateLink[];
  handoffs: Handoff[];
  messages: TeamMessage[];
  huddle: Huddle | null;
  synthesis: Synthesis | null;
  evaluation: TraceEvaluation | null;
  chains: Chain[];
  pillars: PillarRow[];
  /** A background worker is advancing this run right now. */
  busy: boolean;
  /** What the student should do next. */
  next: { kind: "wait" | "start_visit" | "continue_visit" | "write_handoff" | "huddle" | "finish" | "done" | "error"; stageId?: string; label: string };
}

export const STATUS_LABEL: Record<EntryStatus, string> = {
  established: "Established",
  patient_reported: "Patient-reported",
  uncertain: "Uncertain",
  disputed: "Disputed",
  open_question: "Unanswered question",
  resolved: "Resolved",
};

export const KIND_LABEL: Record<string, string> = {
  record: "Existing record",
  finding: "Finding",
  result: "Exam or test result",
  assessment: "Assessment",
  interpretation: "Interpretation",
  recommendation: "Recommendation",
  referral: "Referral",
  plan_item: "Care-plan item",
  goal: "Patient goal or preference",
  uncertainty: "Uncertainty",
  open_question: "Unanswered question",
  disagreement: "Disagreement",
  follow_up: "Follow-up on earlier information",
  consult: "Consult",
  callout: "Call-out",
  resolution: "Huddle resolution",
  plan_change: "Care-plan change",
};

export const SOURCE_LABEL: Record<string, string> = {
  record: "Existing record",
  patient: "Patient",
  exam: "Examination",
  test: "Test or measurement",
  clinician: "Clinician's judgement",
  consult: "Team consult",
  huddle: "Team huddle",
};
