import { chatJSON, MODELS } from "./llm";
import { profession } from "./professions";
import type { CaseProfile, Fact, ClinicalAction, Artifact } from "./types";

const str = { type: "string" };
const strArr = { type: "array", items: str };

/** JSON Schema the model must fill. Mirrors CaseProfile (ids are assigned by the model, then checked). */
export const CASE_SCHEMA = {
  type: "object",
  required: ["title", "summary", "specialty", "setting", "encounterType", "difficulty", "patient", "persona", "scenario", "chartAtStart", "facts", "actions", "artifacts", "objectives", "answerKey"],
  properties: {
    title: { type: "string", description: "Faculty-facing title, e.g. 'New-onset exertional chest pain in a 58-year-old smoker'" },
    summary: { type: "string", description: "2-3 sentence faculty-facing summary of the case and what it teaches" },
    specialty: str,
    setting: { type: "string", description: "Always a telehealth video visit; say where the patient is calling from, e.g. 'Telehealth video visit, patient at home'" },
    encounterType: { type: "string", description: "e.g. diagnostic interview, counseling, follow-up, medication review, discharge teaching, intake assessment" },
    difficulty: { type: "integer", minimum: 1, maximum: 5 },
    patient: {
      type: "object",
      required: ["name", "age", "sex", "pronouns", "ethnicity", "occupation", "language", "appearance"],
      properties: { name: str, age: { type: "integer" }, sex: str, pronouns: str, ethnicity: str, occupation: str, language: str, appearance: { type: "string", description: "What the student sees on the video call: posture, affect, surroundings" } },
    },
    persona: {
      type: "object",
      required: ["personality", "communicationStyle", "healthLiteracy", "emotionalState", "background", "speechExamples", "concerns"],
      properties: {
        personality: str,
        communicationStyle: str,
        healthLiteracy: { type: "string", enum: ["low", "moderate", "high"] },
        emotionalState: str,
        background: { type: "string", description: "Non-clinical life story the patient can chat about freely: family, work, hobbies, daily routine. No health facts here." },
        speechExamples: { type: "array", items: str, description: "3-5 short lines showing how this person talks" },
        concerns: { type: "array", items: str, description: "Worries/questions the patient may raise themselves" },
      },
    },
    scenario: {
      type: "object",
      required: ["studentBrief", "chiefComplaint", "openingLine", "tasks", "timeLimitMin"],
      properties: {
        studentBrief: { type: "string", description: "What the learner is told before joining the call: their role, the patient's name/age, reason for visit. Must not give away findings." },
        chiefComplaint: str,
        openingLine: { type: "string", description: "What the patient says when asked what brings them in. Must only contain 'initial' tier information." },
        tasks: { type: "array", items: str, description: "3-5 things the learner is expected to accomplish in this visit" },
        timeLimitMin: { type: "integer" },
      },
    },
    chartAtStart: {
      type: "array",
      description: "Header-level record items already in the EHR before the visit. Use these labels where they apply: 'Reason for visit', 'Problem list', 'Medications', 'Allergies', 'Last vitals', 'Immunizations', 'Care team', 'Code status'. Must be consistent with facts.",
      items: { type: "object", required: ["label", "value"], properties: { label: str, value: str } },
    },
    facts: {
      type: "array",
      description: "25-40 atomic facts the patient can disclose. Include pertinent negatives. Every fact is one idea.",
      items: {
        type: "object",
        required: ["id", "category", "topic", "chart", "says", "tier", "importance"],
        properties: {
          id: { type: "string", description: "f1, f2, ..." },
          category: { type: "string", enum: ["chief_complaint", "hpi", "pmh", "psh", "medications", "allergies", "family", "social", "substance", "sexual", "ros", "nutrition", "function", "psychosocial", "goals", "adherence", "other"] },
          topic: { type: "string", description: "2-4 word neutral topic label that does NOT reveal the answer, e.g. 'alcohol use', 'chest pain timing'" },
          chart: { type: "string", description: "Clinician wording for the chart, e.g. 'Drinks 4-6 beers nightly x 3 years'" },
          says: { type: "string", description: "The patient's own words, in character" },
          tier: { type: "string", enum: ["initial", "discoverable", "reluctant", "hidden"], description: "initial = volunteers readily; discoverable = shares when asked about the topic; reluctant = only when asked directly AND trust is established; hidden = only with strong rapport and a direct, sensitive question" },
          importance: { type: "string", enum: ["critical", "important", "minor"] },
          distractor: { type: "boolean", description: "true for a plausible red herring that is not relevant to the main problem (include 1-3)" },
        },
      },
    },
    actions: {
      type: "array",
      description: "8-18 things the learner in this role can do, request or order, each with a fixed approved result. Because this is telehealth, exams are guided remote exams (patient self-palpation, camera inspection, home devices) or results reported from the record/lab. Include normal results for reasonable-but-unhelpful tests too.",
      items: {
        type: "object",
        required: ["id", "kind", "name", "result", "importance"],
        properties: {
          id: { type: "string", description: "a1, a2, ..." },
          kind: { type: "string", enum: ["exam", "vitals", "lab", "imaging", "test", "record", "assessment", "procedure"] },
          name: str,
          aliases: strArr,
          result: { type: "string", description: "The finding/result text written to the chart" },
          abnormal: { type: "boolean" },
          importance: { type: "string", enum: ["critical", "important", "minor"] },
          artifactIds: strArr,
        },
      },
    },
    artifacts: {
      type: "array",
      description: "3-7 electronic health record documents: lab report (use table with reference ranges and H/L flags), ECG/imaging report (body text), prior visit or referral note, medication list (table), vitals flowsheet (table), and at least one trend chart when there is data over time. Values must exactly match the facts/actions.",
      items: {
        type: "object",
        required: ["id", "type", "title", "release"],
        properties: {
          id: { type: "string", description: "d1, d2, ..." },
          type: { type: "string", enum: ["lab_report", "ecg", "imaging", "note", "medication_list", "flowsheet", "chart", "form", "other"] },
          title: str,
          date: { type: "string", description: "Relative or absolute date of the document" },
          author: { type: "string", description: "Author or performing service" },
          body: str,
          chart: {
            type: "object",
            description: "Optional plotted data when a graph is the natural format: lab or vital trends over time, home BP/glucose logs, growth curve, audiogram (kind 'audiogram', x = frequency in Hz, y = dB HL, invertY true, series 'Right ear'/'Left ear'), spirometry, weight history.",
            required: ["kind", "xLabel", "yLabel", "series"],
            properties: {
              kind: { type: "string", enum: ["line", "bar", "audiogram"] },
              xLabel: str,
              yLabel: str,
              invertY: { type: "boolean" },
              refLow: { type: "number" },
              refHigh: { type: "number" },
              series: { type: "array", items: { type: "object", required: ["name", "points"], properties: { name: str, points: { type: "array", items: { type: "object", required: ["x", "y"], properties: { x: str, y: { type: "number" } } } } } } },
            },
          },
          table: {
            type: "object",
            required: ["columns", "rows"],
            properties: {
              columns: strArr,
              rows: { type: "array", items: { type: "object", required: ["cells"], properties: { cells: strArr, flag: { type: "string", enum: ["H", "L", "A", ""] } } } },
            },
          },
          release: {
            type: "object",
            required: ["when"],
            properties: { when: { type: "string", enum: ["start", "action", "fact"], description: "start = in chart from the beginning; action = appears when action `ref` is done; fact = appears when fact `ref` is disclosed" }, ref: str },
          },
        },
      },
    },
    objectives: {
      type: "array",
      description: "3-6 learning objectives, each linked to the facts/actions that demonstrate it",
      items: { type: "object", required: ["id", "text", "factIds", "actionIds"], properties: { id: { type: "string", description: "o1, o2, ..." }, text: str, factIds: strArr, actionIds: strArr } },
    },
    mismatches: {
      type: "array",
      description: "1-2 deliberate, realistic conflicts between what the patient says and what the record shows (e.g. says they take every dose, but the refill history or a lab says otherwise). The patient's claim must be one of the facts; the evidence must be in an artifact or action result.",
      items: {
        type: "object",
        required: ["id", "patientClaim", "recordEvidence", "teachingPoint"],
        properties: { id: { type: "string", description: "m1, m2" }, patientClaim: str, recordEvidence: str, teachingPoint: str, factId: str, artifactId: str },
      },
    },
    answerKey: {
      type: "object",
      required: ["primaryProblem", "differential", "keyFindings", "plan", "redFlags", "educationPoints"],
      properties: { primaryProblem: str, differential: strArr, keyFindings: strArr, plan: strArr, redFlags: strArr, educationPoints: strArr },
    },
  },
} as const;

const SYSTEM = `You are an expert clinical educator and simulation case writer for a health professions school. You write standardized-patient cases for a telehealth (video visit) simulator used by students of every health profession.

Quality bar:
- Clinically accurate and internally consistent: history, medications, vitals, labs, artifacts and the answer key must all agree (doses, units, dates, values).
- Realistic people, not textbook vignettes: lay language, partial understanding, real-life barriers, culture and context treated with respect.
- Progressive disclosure: sort facts into tiers. Sensitive or embarrassing things are 'reluctant' or 'hidden'. The main concern is 'initial'.
- 'says' is the patient's voice (no jargon unless the persona would use it). 'chart' is concise clinician wording.
- 'topic' labels must never reveal the answer.
- Scope everything to what the learner's profession actually does in a telehealth visit. Actions must be ones that role would perform or request remotely.
- Build in one or two patient-versus-chart mismatches: the patient sincerely says one thing while a chart document shows another. Spotting and gently exploring this is part of the exercise.
- Include pertinent negatives as facts so the patient can answer common screening questions.
- Keep lab values physiologically plausible with correct units and reference ranges.
- Do not include real people or identifiable data. This is synthetic educational content.`;

export interface GenerateInput {
  professionId: string;
  /** Free-text description from faculty, or a structured sample profile as JSON. */
  description: string;
  level?: number;
  /** Extra guidance (e.g. learning objectives, syllabus excerpt). */
  guidance?: string;
  portrait?: string;
}

export async function generateCase(input: GenerateInput): Promise<CaseProfile> {
  const p = profession(input.professionId);
  const raw = await chatJSON<Omit<CaseProfile, "version" | "professions" | "knowledge" | "rubricId">>({
    model: MODELS.smart,
    system: SYSTEM,
    maxTokens: 20000,
    schema: CASE_SCHEMA as unknown as Record<string, unknown>,
    messages: [
      {
        role: "user",
        text: `Write a complete telehealth simulation case.

LEARNER ROLE: ${p.name} (${p.roleTitle})
ROLE SCOPE: ${p.scope}
TYPICAL ENCOUNTERS: ${p.encounterTypes.join(", ")}
ACTION KINDS THIS ROLE USES: ${p.actionKinds.join(", ")}
DOCUMENTATION FORMAT: ${p.noteFormat}
${input.level ? `TARGET INTRINSIC DIFFICULTY: ${input.level} of 5` : ""}
${input.guidance ? `FACULTY GUIDANCE:\n${input.guidance}\n` : ""}
CASE DESCRIPTION FROM FACULTY (treat every detail given here as fixed; fill in only what is missing):
${input.description}`,
      },
    ],
  });
  const profile: CaseProfile = {
    version: 1,
    ...raw,
    professions: [p.id],
    knowledge: [],
    rubricId: "default",
  };
  if (input.portrait) profile.patient.portrait = input.portrait;
  return normalizeCase(profile);
}

/** Repairs ids and dangling references so the engine can trust the profile. */
/** Models occasionally return an array as a JSON string; accept both. */
function asArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) return p as T[];
    } catch {}
  }
  return [];
}

export function normalizeCase(c: CaseProfile): CaseProfile {
  const fix = <T extends { id: string }>(arr: T[] | undefined, prefix: string): T[] => {
    const seen = new Set<string>();
    return asArray<T>(arr).map((x, i) => {
      let id = (x.id || "").trim() || `${prefix}${i + 1}`;
      while (seen.has(id)) id = `${id}_${i + 1}`;
      seen.add(id);
      return { ...x, id };
    });
  };
  c.facts = fix<Fact>(c.facts, "f");
  c.actions = fix<ClinicalAction>(c.actions, "a");
  c.artifacts = fix<Artifact>(c.artifacts, "d");
  c.objectives = fix(c.objectives, "o");
  if (!c.facts.length) throw new Error("Generation returned no patient facts; please try again.");
  c.chartAtStart = asArray(c.chartAtStart);
  c.scenario.tasks = asArray(c.scenario.tasks);
  c.persona.speechExamples = asArray(c.persona.speechExamples);
  c.persona.concerns = asArray(c.persona.concerns);
  for (const k of ["differential", "keyFindings", "plan", "redFlags", "educationPoints"] as const) c.answerKey[k] = asArray(c.answerKey[k]);
  for (const o of c.objectives) {
    o.factIds = asArray(o.factIds);
    o.actionIds = asArray(o.actionIds);
  }
  for (const a of c.actions) a.artifactIds = asArray(a.artifactIds);
  const factIds = new Set(c.facts.map((f) => f.id));
  const actionIds = new Set(c.actions.map((a) => a.id));
  const artifactIds = new Set(c.artifacts.map((a) => a.id));
  for (const a of c.actions) a.artifactIds = (a.artifactIds || []).filter((id) => artifactIds.has(id));
  for (const o of c.objectives) {
    o.factIds = (o.factIds || []).filter((id) => factIds.has(id));
    o.actionIds = (o.actionIds || []).filter((id) => actionIds.has(id));
  }
  for (const d of c.artifacts) {
    if (!d.release) d.release = { when: "start" };
    if (d.release.when === "action" && !actionIds.has(d.release.ref || "")) {
      // Fall back to whichever action lists this artifact, else show from the start.
      const owner = c.actions.find((a) => a.artifactIds?.includes(d.id));
      d.release = owner ? { when: "action", ref: owner.id } : { when: "start" };
    }
    if (d.release.when === "fact" && !factIds.has(d.release.ref || "")) d.release = { when: "start" };
  }
  // Make action -> artifact links symmetrical.
  for (const d of c.artifacts) {
    if (d.release.when === "action") {
      const a = c.actions.find((x) => x.id === d.release.ref);
      if (a && !a.artifactIds!.includes(d.id)) a.artifactIds!.push(d.id);
    }
  }
  c.difficulty = Math.max(1, Math.min(5, Math.round(c.difficulty || 3)));
  c.scenario.timeLimitMin = Math.max(5, Math.min(60, Math.round(c.scenario.timeLimitMin || 20)));
  c.knowledge = c.knowledge || [];
  c.rubricId = c.rubricId || "default";
  c.professions = c.professions?.length ? c.professions : ["medicine"];
  c.variants = c.variants || [];
  c.mismatches = asArray(c.mismatches);
  return c;
}
