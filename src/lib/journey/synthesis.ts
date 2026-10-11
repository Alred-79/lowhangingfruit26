import { run as sql } from "../db";
import { chatJSON, MODELS } from "../llm";
import { aliasing, approvedCorpus, arr, clean, unverifiedValues } from "./context";
import { entriesOf, linksOf, RECORD_STAGE, type LoadedRun } from "./store";
import { professionsOf, STATUS_LABEL, type PlanProblem, type StateEntry, type Synthesis } from "./types";

const str = { type: "string" };
const labels = { type: "array", items: str };
const SCHEMA = {
  type: "object",
  required: ["patientSummary", "summaryCites", "problems"],
  properties: {
    patientSummary: { type: "string", description: "4-6 sentences: who this patient is, what matters to them, and what the team now understands that no single professional saw alone." },
    summaryCites: labels,
    problems: {
      type: "array",
      description: "3-6 patient problems or goals, most important to the patient first. NOT one per profession.",
      items: {
        type: "object",
        required: ["title", "patientGoal", "summary", "items"],
        properties: {
          title: { type: "string", description: "The problem or goal in plain words, e.g. 'Eating enough without worsening fluid overload'" },
          patientGoal: { type: "string", description: "What the patient wants here, in their terms, if the record says; otherwise empty" },
          summary: { type: "string", description: "1-2 sentences on how the professions' findings fit together for this problem, naming any unresolved point" },
          items: {
            type: "array",
            items: {
              type: "object",
              required: ["action", "ownerRoles", "timeframe", "rationale", "restsOn"],
              properties: {
                action: { type: "string", description: "One concrete action. No doses or targets that are not in the listed entries." },
                ownerRoles: { type: "array", items: str, description: "Role titles from the team list that own this action (lead first)" },
                timeframe: str,
                rationale: { type: "string", description: "Why, in one sentence. If you say whose finding it rests on, name the role shown as the contributor of that cited entry, exactly." },
                restsOn: { type: "array", items: str, description: "Labels (E..) of the entries this action rests on. At least one; prefer entries from more than one profession when they exist." },
              },
            },
          },
        },
      },
    },
  },
};

/**
 * The integrated care plan. Model-written, organised by patient problem rather than by profession,
 * and every item must rest on entries that exist: unknown labels are removed and an item left with
 * no valid entry is dropped.
 */
export async function synthesise(run: LoadedRun): Promise<Synthesis> {
  let out = await attempt(run);
  // If validation removed most of the plan, the citations were malformed: ask once more.
  if (out.problems.reduce((n, p) => n + p.items.length, 0) < Math.max(3, out.droppedItems)) out = await attempt(run);
  sql("UPDATE journey_runs SET synthesis = ? WHERE id = ?", JSON.stringify(out), run.row.id);
  return out;
}

async function attempt(run: LoadedRun): Promise<Synthesis> {
  const runId = run.row.id;
  const links = linksOf(runId);
  const entries = entriesOf(runId, links);
  const { toAlias, resolve } = aliasing(entries);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const team = run.stages.map((s) => s.roleTitle);
  const raw = await chatJSON<{ patientSummary: string; summaryCites: string[]; problems: { title: string; patientGoal: string; summary: string; items: { action: string; ownerRoles: string[]; timeframe: string; rationale: string; restsOn: string[] }[] }[] }>({
    model: MODELS.smart,
    schema: SCHEMA,
    maxTokens: 6000,
    system: `You write the integrated care plan for an interprofessional team at the end of a patient's care journey in a clinical training simulation.

Rules:
- Organise by the patient's problems and goals, not by profession. An action usually draws on more than one profession's findings; say how they combine (for example: a pharmacist's adherence finding and a dietitian's meal-timing finding lead to one shared action).
- Use only the entries listed. Do not add clinical facts, values, doses or diagnoses that are not in them. Where the team's information is uncertain, disputed or unanswered, make the action about closing that gap and say who owns it.
- Entries marked Resolved (and huddle resolutions) override the entries they resolve.
- Every action cites the entry labels it rests on (in restsOn only; never write a label such as E12 inside any text) and names owner roles from the team list.
- Respect the patient's stated goals and constraints (money, energy, independence, preferences).
- Attribution: each entry line says which ROLE contributed it and in which encounter. When you credit a finding to someone, use the role on that entry's own line and nothing else. Never credit a role with something another role's entry contains, and never refer to a person by name or by anything other than their role in this journey.
- Every encounter was an outpatient telehealth visit. Nobody admitted the patient, ordered tests beyond the listed results, or changed a medicine. Do not write actions that assume otherwise (for example "confirm whether he was admitted"). Recommendations in the entries are recommendations, not things already done.`,
    messages: [
      {
        role: "user",
        text: `PATIENT: ${run.c.patient.name}, ${run.c.patient.age}, ${run.c.patient.sex}.
TEAM (owner roles to choose from): ${team.join("; ")}; Patient; Primary care (outside this team)

SHARED PATIENT STATE (label, status, kind, contributor)
${entries.map((e) => line(e, toAlias.get(e.id)!)).join("\n")}

RELATIONS
${links.map((l) => `${toAlias.get(l.from)} ${l.relation} ${toAlias.get(l.to)}`).join("; ") || "(none)"}`,
      },
    ],
  });

  const corpus = approvedCorpus(run.c, entries) + " " + entries.map((e) => e.text).join(" ");
  const stageIds = run.stages.map((s) => s.id);
  let dropped = 0;
  type RawItem = { action: string; ownerRoles: string[]; timeframe: string; rationale: string; restsOn: string[] };
  type RawProblem = { title: string; patientGoal: string; summary: string; items: RawItem[] };
  const problems: PlanProblem[] = arr<RawProblem>(raw.problems).map((p, pi) => ({
    id: `p${pi + 1}`,
    title: clean(p.title),
    patientGoal: clean(p.patientGoal),
    summary: clean(p.summary),
    items: arr<RawItem>(p.items)
      .map((it, ii) => {
        const restsOn = [...new Set(arr(it.restsOn).map(resolve).filter((x): x is string => !!x))];
        // Professions are the journey roles whose entries the action rests on; the record and the huddle are not professions.
        const professions = professionsOf(restsOn, entries, stageIds);
        return { id: `p${pi + 1}i${ii + 1}`, action: clean(it.action), ownerRoles: arr<string>(it.ownerRoles).map(String), timeframe: it.timeframe || "", rationale: attribution(clean(it.rationale), restsOn, byId, run), restsOn, professions };
      })
      .filter((it) => {
        // An action with no real entry behind it, or with a value found nowhere in the state, is not shown.
        const ok = it.restsOn.length > 0 && unverifiedValues(it.action, corpus).length === 0;
        if (!ok) console.warn("[journey] plan item dropped", it.restsOn.length, unverifiedValues(it.action, corpus), it.action);
        if (!ok) dropped++;
        return ok;
      }),
  }));
  const out: Synthesis = {
    patientSummary: clean(raw.patientSummary),
    summaryCites: [...new Set(arr(raw.summaryCites).map(resolve).filter((x): x is string => !!x))],
    problems: problems.filter((p) => p.items.length),
    droppedItems: dropped,
    generatedAt: new Date().toISOString(),
  };
  return out;
}

/** An entry as the plan writer sees it: status, kind, and the ROLE that contributed it (no personal names, which models mistake for roles). */
function line(e: StateEntry, alias: string): string {
  const by = e.stageId === RECORD_STAGE ? "existing record" : e.stageId === "huddle" ? "team huddle" : `contributed by the ${e.contributorRole}${e.contributorIsAi ? "" : " (the student)"}, encounter ${e.stageOrder}`;
  return `[${alias}] (${STATUS_LABEL[e.effectiveStatus]}; ${e.kind.replace("_", " ")}; ${by}) ${e.text}`;
}

/**
 * Attribution check. If a rationale credits a team role none of whose entries the action cites, the
 * credit is wrong: the sentence is replaced by one computed from the cited entries' real contributors.
 */
function attribution(rationale: string, restsOn: string[], byId: Map<string, StateEntry>, run: LoadedRun): string {
  const cited = restsOn.map((id) => byId.get(id)).filter((e): e is StateEntry => !!e);
  const roles = new Set(cited.map((e) => e.contributorRole));
  const keys = (title: string) => title.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 5 && !["attending", "registered", "clinical", "internal", "medicine"].includes(w)).map((w) => w.slice(0, 7));
  const text = rationale.toLowerCase();
  const wrong = run.stages.filter((s) => !roles.has(s.roleTitle) && keys(s.roleTitle).some((k) => new RegExp(`\\b${k}[a-z]*('s|s')?\\s+(finding|findings|assessment|review|visit|note|report|observation|recommendation|reconciliation|history|interview)`).test(text) || new RegExp(`(found|noted|identified|elicited|reported|documented|raised|flagged) by (the )?${k}`).test(text)));
  if (!wrong.length) return rationale;
  const who = [...new Set(cited.filter((e) => e.stageId !== RECORD_STAGE && e.stageId !== "huddle").map((e) => `the ${e.contributorRole.toLowerCase()} (encounter ${e.stageOrder})`))];
  const record = cited.some((e) => e.stageId === RECORD_STAGE);
  return `Rests on what was recorded by ${[...who, ...(record ? ["the existing record"] : [])].join(", ") || "the team huddle"}.`;
}
