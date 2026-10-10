import { chatJSON, MODELS } from "../llm";
import type { CaseProfile, ClinicalAction, EncounterState, Fact, Knobs } from "../types";

export interface GateResult {
  question_type: "open" | "focused" | "closed" | "leading" | "multiple" | "statement" | "greeting" | "other";
  asks: { fact_id: string; directness: "direct" | "related" }[];
  signals: {
    introduced_self: boolean;
    explained_purpose: boolean;
    empathy: boolean;
    validated_emotion: boolean;
    sensitive_framing: boolean;
    judgmental: boolean;
    dismissive: boolean;
    jargon: boolean;
    rushed: boolean;
  };
  patient_emotion: string;
}

const bool = { type: "boolean" };
const SCHEMA = {
  type: "object",
  required: ["question_type", "asks", "signals", "patient_emotion"],
  properties: {
    question_type: { type: "string", enum: ["open", "focused", "closed", "leading", "multiple", "statement", "greeting", "other"] },
    asks: {
      type: "array",
      description: "Locked facts that a truthful answer to the student's latest message would include. Empty if none.",
      items: {
        type: "object",
        required: ["fact_id", "directness"],
        properties: {
          fact_id: { type: "string" },
          directness: { type: "string", enum: ["direct", "related"], description: "direct = the student specifically asked about this topic; related = an open or broad question that this fact would naturally come up in" },
        },
      },
    },
    signals: {
      type: "object",
      required: ["introduced_self", "explained_purpose", "empathy", "validated_emotion", "sensitive_framing", "judgmental", "dismissive", "jargon", "rushed"],
      properties: {
        introduced_self: bool,
        explained_purpose: bool,
        empathy: { ...bool, description: "expressed genuine empathy or warmth" },
        validated_emotion: { ...bool, description: "named or validated what the patient is feeling" },
        sensitive_framing: { ...bool, description: "normalised, asked permission, or explained why before a sensitive question" },
        judgmental: bool,
        dismissive: { ...bool, description: "ignored or brushed past something the patient just raised" },
        jargon: { ...bool, description: "used medical jargon without explaining it" },
        rushed: { ...bool, description: "curt, interrupting, or stacking questions" },
      },
    },
    patient_emotion: { type: "string", description: "1-3 words for how the patient feels after this message" },
  },
};

const SYSTEM = `You are the disclosure controller of a virtual-patient simulator. You do not speak to the student. You read the student's latest message and decide which of the patient's still-locked facts it legitimately asks about, and how the student communicated.

Rules:
- Only list a fact if the student's message actually asks for it. A question about "medications" matches medication facts, not alcohol use. Be strict: vague small talk matches nothing.
- An open invitation ("what brings you in", "tell me more", "anything else?") can match facts as "related", most relevant first.
- A closed or specific question matches only the facts on that exact topic, as "direct".
- If the student is explaining, counselling or stating something rather than asking, asks is empty.
- Judge the signals from the student's latest message only.`;

export async function gatekeep(args: {
  locked: Fact[];
  recent: { speaker: string; text: string }[];
  message: string;
}): Promise<GateResult> {
  const facts = args.locked.map((f) => `${f.id} | ${f.category} | ${f.topic} | ${f.chart}`).join("\n");
  const convo = args.recent.map((m) => `${m.speaker.toUpperCase()}: ${m.text}`).join("\n");
  try {
    return await chatJSON<GateResult>({
      model: MODELS.fast,
      system: SYSTEM,
      schema: SCHEMA,
      maxTokens: 700,
      temperature: 0,
      messages: [
        {
          role: "user",
          text: `LOCKED FACTS (id | category | topic | content):\n${facts || "(none left)"}\n\nRECENT CONVERSATION:\n${convo || "(start of visit)"}\n\nSTUDENT'S LATEST MESSAGE:\n${args.message}`,
        },
      ],
    });
  } catch {
    // Fail closed: nothing new is disclosed if the controller is unavailable.
    return {
      question_type: "other",
      asks: [],
      signals: { introduced_self: false, explained_purpose: false, empathy: false, validated_emotion: false, sensitive_framing: false, judgmental: false, dismissive: false, jargon: false, rushed: false },
      patient_emotion: "neutral",
    };
  }
}

export interface Decision {
  reveal: Fact[];
  deflect: Fact[];
  rapport: number;
  rapportDelta: number;
  how: Record<string, "volunteered" | "asked">;
}

/**
 * Deterministic policy: given what the student asked and the current trust level, decide what is
 * released. The LLM proposes matches; this function alone decides disclosure.
 */
export function decide(gate: GateResult, facts: Fact[], state: EncounterState, knobs: Knobs, lowLiteracy: boolean): Decision {
  const s = gate.signals;
  let delta = 0;
  if (s.introduced_self && state.turn <= 3) delta += 4;
  if (s.explained_purpose && state.turn <= 4) delta += 3;
  if (s.empathy) delta += 6;
  if (s.validated_emotion) delta += 5;
  if (s.sensitive_framing) delta += 5;
  if (gate.question_type === "open") delta += 2;
  if (s.judgmental) delta -= 10;
  if (s.dismissive) delta -= 7;
  if (s.jargon) delta -= lowLiteracy ? 5 : 2;
  if (s.rushed) delta -= 4;
  if (gate.question_type === "multiple") delta -= 2;
  if (gate.question_type === "leading") delta -= 1;
  delta = Math.max(-12, Math.min(12, delta));
  const rapport = Math.max(0, Math.min(100, state.rapport + delta));

  const byId = new Map(facts.map((f) => [f.id, f]));
  const reveal: Fact[] = [];
  const deflect: Fact[] = [];
  const how: Record<string, "volunteered" | "asked"> = {};
  const candidates = gate.asks
    .map((a) => ({ fact: byId.get(a.fact_id), direct: a.directness === "direct" }))
    .filter((a): a is { fact: Fact; direct: boolean } => !!a.fact && !state.disclosed[a.fact.id])
    .sort((a, b) => Number(b.direct) - Number(a.direct));

  for (const { fact, direct } of candidates) {
    if (fact.distractor && !knobs.distractors) continue;
    let ok = false;
    if (fact.tier === "initial") ok = true;
    else if (fact.tier === "discoverable") ok = direct || knobs.volunteers;
    else if (fact.tier === "reluctant") {
      // A second direct, respectful ask lowers the bar a little, as it does with real patients.
      const bar = knobs.reluctantAt - (state.deflected[fact.id] ? 6 : 0) - (s.sensitive_framing ? 8 : 0);
      ok = direct && rapport >= bar;
      if (direct && !ok) deflect.push(fact);
    } else if (fact.tier === "hidden") {
      const bar = knobs.hiddenAt - (state.deflected[fact.id] ? 5 : 0) - (s.sensitive_framing ? 8 : 0);
      ok = direct && rapport >= bar;
      if (direct && !ok) deflect.push(fact);
    }
    if (ok && reveal.length < knobs.factsPerTurn) {
      reveal.push(fact);
      how[fact.id] = direct ? "asked" : "volunteered";
    }
  }

  // An open question with nothing matched still gets the patient's opening concerns.
  if (!reveal.length && gate.question_type === "open") {
    for (const f of facts) {
      if (reveal.length >= Math.min(2, knobs.factsPerTurn)) break;
      if (f.tier === "initial" && !state.disclosed[f.id] && !(f.distractor && !knobs.distractors)) {
        reveal.push(f);
        how[f.id] = "volunteered";
      }
    }
  }
  return { reveal, deflect, rapport, rapportDelta: delta, how };
}

// ---------- Orders and exams ----------

const ORDER_SCHEMA = {
  type: "object",
  required: ["matched", "unmatched"],
  properties: {
    matched: { type: "array", items: { type: "string" }, description: "ids of approved actions the request clearly asks for" },
    unmatched: { type: "array", items: { type: "string" }, description: "short names of requested exams/tests/records that have no approved action" },
  },
};

export async function matchActions(request: string, actions: ClinicalAction[]): Promise<{ matched: string[]; unmatched: string[] }> {
  const list = actions.map((a) => `${a.id} | ${a.kind} | ${a.name}${a.aliases?.length ? " (" + a.aliases.join(", ") + ")" : ""}`).join("\n");
  const res = await chatJSON<{ matched: string[]; unmatched: string[] }>({
    model: MODELS.fast,
    temperature: 0,
    maxTokens: 400,
    schema: ORDER_SCHEMA,
    system:
      "You map a clinician's free-text exam/order request to a fixed list of approved actions for a simulation case. Match only when the request clearly means that action (a 'CBC' request matches a 'Complete blood count'; 'bloods' matches nothing specific). A panel request may match several actions. Anything requested that is not on the list goes in unmatched. Never invent ids.",
    messages: [{ role: "user", text: `APPROVED ACTIONS (id | kind | name):\n${list}\n\nREQUEST:\n${request}` }],
  });
  const ids = new Set(actions.map((a) => a.id));
  return { matched: (res.matched || []).filter((id) => ids.has(id)), unmatched: res.unmatched || [] };
}

export const caseFacts = (c: CaseProfile, knobs: Knobs) => c.facts.filter((f) => !(f.distractor && !knobs.distractors));

// ---------- Grounding audit ----------

const AUDIT_SCHEMA = {
  type: "object",
  required: ["unsupported", "not_conveyed"],
  properties: {
    unsupported: {
      type: "array",
      description: "Clinical details the patient asserted as true that are not supported by the approved list. Empty if none.",
      items: { type: "string", description: "The unsupported claim, in a few words, quoting the patient where possible" },
    },
    not_conveyed: {
      type: "array",
      description: "ids from the NEW THIS TURN list whose content the reply did not actually communicate. Empty if all were conveyed.",
      items: { type: "string" },
    },
  },
};

export interface Audit {
  unsupported: string[];
  /** ids of facts that were released this turn but that the patient did not actually say. */
  notConveyed: string[];
}

/**
 * Checks a finished patient reply against the facts the patient was allowed to use:
 * (1) anything clinical asserted beyond the approved facts is reported so it can be flagged;
 * (2) any fact released this turn that the patient did not actually say is reported so the
 *     ledger only records what was really disclosed.
 */
export async function auditReply(reply: string, known: Fact[], reveal: Fact[], background: string, openingLine: string, memory = ""): Promise<Audit> {
  try {
    const res = await chatJSON<{ unsupported: string[]; not_conveyed: string[] }>({
      model: MODELS.fast,
      temperature: 0,
      maxTokens: 400,
      schema: AUDIT_SCHEMA,
      system:
        "You audit a simulated patient's reply for a medical education simulator. You are given the only clinical facts the patient was approved to state, plus their non-medical background.\n1. unsupported: list clinical details the reply ASSERTS AS TRUE that are not supported by that material: new symptoms, diagnoses, medications or doses, test results, numbers, dates of medical events, or family members' health. Do not list denials, 'I don't know', vague non-answers, feelings and opinions, everyday non-medical life details, reasonable rewording of an approved fact, or the patient repeating back what a clinician told them. Be strict about real additions and silent about everything else.\n2. not_conveyed: for each fact under NEW THIS TURN, decide whether the reply communicated its substance (paraphrase counts). List the ids that were not communicated at all.",
      messages: [
        {
          role: "user",
          text: `ALREADY SHARED EARLIER:\n${known.map((f) => `- ${f.chart} (patient wording: ${f.says})`).join("\n") || "(none)"}\n- Reason for visit, in the patient's words: ${openingLine}\n\nNEW THIS TURN:\n${reveal.map((f) => `${f.id}: ${f.chart} (patient wording: ${f.says})`).join("\n") || "(none)"}\n\nNON-MEDICAL BACKGROUND:\n${background}${memory ? `\n\nWHAT THE PATIENT REMEMBERS FROM EARLIER VISITS (repeating what a clinician said or advised then is allowed, and so is anything the student has just said in this conversation):\n${memory}` : ""}\n\nPATIENT REPLY TO AUDIT:\n${reply}`,
        },
      ],
    });
    const ids = new Set(reveal.map((f) => f.id));
    return {
      unsupported: (res.unsupported || []).filter((x) => typeof x === "string" && x.trim()).slice(0, 4),
      notConveyed: (res.not_conveyed || []).filter((id) => ids.has(id)),
    };
  } catch {
    return { unsupported: [], notConveyed: [] };
  }
}
