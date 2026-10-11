import { get, parse } from "../db";
import { chatJSON, MODELS } from "../llm";
import { professions } from "../professions";
import type { CaseProfile } from "../types";
import { arr } from "./context";
import { allClinicians, clinician, genericClinicianId, resolveProfession, type ClinicianInfo } from "./store";
import type { Stage } from "./types";

const str = { type: "string" };

// ---------- Which persona may play which role ----------

const PHARMACY = ["clinical-pharmacy", "community-pharmacy"];
const NURSING = ["nursing", "critical-care-nursing", "emergency-nursing", "oncology-nursing", "pediatric-nursing", "psychiatric-nursing", "public-health-nursing", "case-management", "nurse-practitioner", "nurse-midwife", "crna"];
const PHYSICIAN_END = "pmr"; // the catalog lists physician specialties first, ending with this id

/** Broad professional family of a catalog role: a physician persona must not be cast as a nurse, and so on. */
function roleFamily(professionId: string, roleTitle: string): string {
  const id = resolveProfession({ professionId, roleTitle }).id;
  const list = professions().map((p) => p.id);
  if (PHARMACY.includes(id)) return "pharmacy";
  if (NURSING.includes(id)) return "nursing";
  if (id === "dietetics") return "dietetics";
  if (id === "physician-assistant") return "physician-assistant";
  const end = list.indexOf(PHYSICIAN_END);
  if (end >= 0 && list.indexOf(id) >= 0 && list.indexOf(id) <= end) return "physician";
  return id;
}
function personaFamily(cl: ClinicianInfo): string {
  const cred = String((cl.profile.clinician_overview as { credentials?: string } | undefined)?.credentials || "");
  if (/\bPharmD\b/.test(cred)) return "pharmacy";
  if (/\b(RD|RDN)\b/.test(cred)) return "dietetics";
  if (/\b(RN|BSN|MSN|DNP|NP|CRNA|CNM)\b/.test(cred)) return "nursing";
  if (/\b(MD|DO|MBBS)\b/.test(cred)) return "physician";
  if (/\bPA(-C)?\b/.test(cred)) return "physician-assistant";
  return cl.id.startsWith("generic:") ? "generic" : "other";
}
/** True when the persona's own profession fits the stage's role. Generic clinicians fit anything. */
export function personaFits(clinicianId: string, professionId: string, roleTitle: string): boolean {
  if (clinicianId.startsWith("generic:")) return true;
  return personaFamily(clinician(clinicianId)) === roleFamily(professionId, roleTitle);
}
const GENERIC_NAMES = ["Jordan Ellis", "Morgan Reyes", "Casey Whitfield", "Avery Okafor", "Riley Sandoval", "Quinn Abernathy"];

// ---------- Text a student will read ----------

/** Clinical details that would give the case away if they appeared in student-facing text: values, doses and drug names from the case that are not already on the record at start. */
function leaks(text: string, c: CaseProfile): string[] {
  const record = (c.chartAtStart || []).map((x) => `${x.label} ${x.value}`).join(" ").toLowerCase();
  const hidden = [...(c.facts || []).flatMap((f) => [f.chart, f.says]), ...(c.actions || []).map((a) => a.result), ...(c.answerKey ? [JSON.stringify(c.answerKey)] : [])].join(" ").toLowerCase();
  const out = new Set<string>();
  const t = (text || "").toLowerCase();
  // Numbers with units, and long drug-like or finding-like words that occur in hidden content but not in the record at start.
  for (const m of t.match(/\d+(?:\.\d+)?\s?(?:mg|mcg|%|lb|lbs|kg|mmhg|mg\/dl|bpm)/g) || []) if (!record.includes(m.replace(/\s/g, "")) && !record.includes(m)) out.add(m);
  for (const w of new Set(t.match(/[a-z][a-z-]{8,}/g) || [])) if (hidden.includes(w) && !record.includes(w) && /(azole|prim|mycin|cillin|statin|pril|sartan|olol|formin|gliptin|flozin|parin|oxacin|sone|lone|pine|zepam|codone|profen)$/.test(w)) out.add(w);
  return [...out];
}

const STAGE_PROPS = {
  professionId: { type: "string", description: "id from the ROLE CATALOG that best fits; if none fits, a short snake_case id for the role" },
  roleTitle: { type: "string", description: "How this professional is named, e.g. 'Clinical pharmacist'" },
  clinicianId: { type: "string", description: "id from the CLINICIAN PERSONAS whose own profession matches this role (a physician persona for a physician role, the pharmacist for a pharmacy role, the dietitian for a nutrition role); each persona at most once. If no persona's profession fits the role (for example a nursing or social work role), write exactly 'generic'." },
  focus: { type: "string", description: "For faculty and the AI colleague, 2 sentences: what this professional is there to do and what they should pick up from earlier encounters. Do not reveal facts the patient has not disclosed." },
  simTime: { type: "string", description: "Simulated time label, e.g. 'Week 1, Mon 10:30'; later encounters are later" },
  visitLabel: { type: "string", description: "Kind of contact, always a telehealth contact, e.g. 'pharmacist medication review by video'" },
  brief: { type: "string", description: "Shown to a STUDENT who takes this role, in the waiting room. 2-3 sentences addressed as 'You are the ...': the role, that it is a telehealth video visit, what to explore and that they hand off with an SBAR. Topics only. No diagnoses, findings, values, drug names or anything the patient has not yet said." },
  tasks: { type: "array", items: str, description: "3-4 short tasks for the student in this role, within that profession's scope. Topics and actions only, no findings. The last one is writing the SBAR handoff." },
  patientReason: { type: "string", description: "Why the patient is on THIS call today, in the patient's own first-person words and voice, 1-2 sentences, said to this professional (e.g. 'They told me the heart doctor wanted to check in with me after I talked to the other doctor.'). Must not mention any other profession as the person they are here to see, and must not reveal anything the patient has not disclosed." },
  reason: { type: "string", description: "Booked reason for this visit as it appears in the chart header, under 12 words, e.g. 'Cardiology video follow-up after urgent triage call'. No findings." },
};

type RawStage = { professionId: string; roleTitle: string; clinicianId: string; focus: string; simTime: string; visitLabel: string; brief: string; tasks: string[]; patientReason: string; reason: string };

/** The faculty guide: proposes an ordered set of encounters for a case from the persona roster and role catalog. */
export async function proposeStages(caseId: string, brief = ""): Promise<{ title: string; summary: string; stages: Stage[] }> {
  const row = get<{ profile: string }>("SELECT profile FROM cases WHERE id = ?", caseId);
  if (!row) throw new Error("Choose a published patient case first.");
  const c = parse<CaseProfile>(row.profile, {} as CaseProfile);
  const roster = allClinicians();
  const roles = professions();
  const ask = () =>
    chatJSON<{ title: string; summary: string; stages: RawStage[] | string }>({
      model: MODELS.smart,
      maxTokens: 4000,
      schema: {
        type: "object",
        required: ["title", "summary", "stages"],
        properties: {
          title: { type: "string", description: "Short journey title for faculty: patient name and the thread that connects the encounters" },
          summary: { type: "string", description: "2-3 sentences for students: who the patient is (name, age) and which professions see them. No diagnoses that are not on the record at start, no findings, no drug names, no test values." },
          stages: {
            type: "array",
            description: "3 to 5 encounters in the order they would realistically happen. An array of objects, not a string.",
            items: { type: "object", required: Object.keys(STAGE_PROPS), properties: STAGE_PROPS },
          },
        },
      },
      system: `You help health-professions faculty turn one patient case into a connected, interprofessional care journey for a telehealth simulation: several encounters with the same patient by different professionals, where each depends on what the earlier ones found. Choose professions whose lenses genuinely differ for this patient, order them so information flows forward naturally, and give each a focus that builds on the previous encounter.

Every encounter is an outpatient telehealth video visit with the patient at home. Nobody admits the patient or changes treatment during the journey; professionals assess, advise and recommend to the team.

Personas: use only the supplied clinician personas, and only in a role of their own profession. Never cast a physician persona as a nurse, pharmacist, dietitian or therapist, or the reverse. If no persona fits a role you want, use clinicianId "generic" and the system will supply a plain named clinician of that profession.

Student-facing text (summary, brief, tasks, reason) and the patient's reason for the visit must be written only from the record at start: name topics to explore, never findings, behaviours, attitudes, medicines or results that the patient has not yet disclosed, and never tell a later professional what an earlier one will have found.`,
      messages: [
        {
          role: "user",
          text: `PATIENT: ${c.patient?.name}, ${c.patient?.age}, ${c.patient?.sex}. Specialty of the source case: ${c.specialty}\nRecord at start (this is ALL that is known before the first encounter):\n${(c.chartAtStart || []).map((x) => `- ${x.label}: ${x.value}`).join("\n")}\nHow the patient talks: ${c.persona?.communicationStyle || ""}\nTopics the patient can be asked about: ${[...new Set((c.facts || []).map((f) => f.category))].join(", ")}\nApproved checks: ${(c.actions || []).map((a) => a.name).slice(0, 25).join("; ")}\n\nCLINICIAN PERSONAS\n${roster.map((r) => `${r.id}: ${r.name}, ${r.role}`).join("\n")}\n\nROLE CATALOG\n${roles.map((r) => `${r.id}: ${r.name}`).join("\n")}\n\n${brief ? "FACULTY REQUEST: " + brief : ""}`,
        },
      ],
    });

  // The model occasionally returns `stages` as a JSON string or leaves it empty: parse what it gave, and ask once more before giving up.
  let out = await ask();
  let rawStages = arr<RawStage>(out.stages).filter((s) => s && typeof s === "object" && s.roleTitle);
  if (rawStages.length < 3) {
    out = await ask();
    rawStages = arr<RawStage>(out.stages).filter((s) => s && typeof s === "object" && s.roleTitle);
  }
  if (rawStages.length < 2) throw new Error("The guide could not produce a usable set of encounters this time. Try again, or add the encounters by hand.");

  const used = new Set<string>();
  let g = 0;
  const stages: Stage[] = rawStages.slice(0, 6).map((s, i) => {
    const roleTitle = String(s.roleTitle || "Clinician").trim();
    const professionId = String(s.professionId || "medicine");
    let clinicianId = String(s.clinicianId || "");
    // A persona is used once, must exist, and must be of the role's own profession; otherwise a generic clinician plays the role.
    if (!roster.some((r) => r.id === clinicianId) || used.has(clinicianId) || !personaFits(clinicianId, professionId, roleTitle)) {
      const fit = roster.find((r) => !used.has(r.id) && personaFits(r.id, professionId, roleTitle) && !rawStages.some((o) => o !== s && o.clinicianId === r.id));
      clinicianId = fit ? fit.id : genericClinicianId(GENERIC_NAMES[g++ % GENERIC_NAMES.length], roleTitle);
    }
    used.add(clinicianId);
    const safe = (t: unknown) => (typeof t === "string" && !leaks(t, c).length ? t.trim() : "");
    return {
      id: `s${i + 1}`,
      order: i + 1,
      professionId,
      roleTitle,
      clinicianId,
      focus: String(s.focus || ""),
      simTime: String(s.simTime || `Week 1, day ${i + 1}`),
      visitLabel: String(s.visitLabel || ""),
      brief: safe(s.brief),
      tasks: arr<string>(s.tasks).map(String).filter((t) => !leaks(t, c).length).slice(0, 5),
      patientReason: safe(s.patientReason),
      reason: safe(s.reason),
    };
  });
  const titles = stages.map((x) => x.roleTitle.toLowerCase());
  const neutral = `${c.patient?.name}, ${c.patient?.age}, is seen in turn by ${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}. Each professional starts from what the others recorded, adds their own findings, and hands off with an SBAR. Join as any one of them; the AI plays the rest.`;
  const summary = out.summary?.trim() || "";
  return {
    title: out.title?.trim() || `${c.patient?.name}: a connected care journey across ${stages.length} professions`,
    // A summary that names a hidden medicine or value is replaced by the neutral one.
    summary: summary && !leaks(summary, c).length ? summary : neutral,
    stages,
  };
}

/** Cleans a faculty-edited spec before it is stored. */
export function normaliseStages(input: unknown): Stage[] {
  const roster = allClinicians();
  const list = Array.isArray(input) ? input : [];
  return list
    .map((raw, i) => {
      const s = (raw || {}) as Partial<Stage>;
      const generic = typeof s.clinicianId === "string" && s.clinicianId.startsWith("generic:");
      const cl = generic ? clinician(s.clinicianId) : roster.find((r) => r.id === s.clinicianId) || roster[0];
      const text = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);
      const tasks = (Array.isArray(s.tasks) ? s.tasks : typeof s.tasks === "string" ? String(s.tasks).split("\n") : []).map((t) => String(t).trim()).filter(Boolean).slice(0, 6).map((t) => t.slice(0, 200));
      return {
        id: `s${i + 1}`,
        order: i + 1,
        professionId: String(s.professionId || "medicine"),
        roleTitle: String(s.roleTitle || cl?.role || "Clinician").slice(0, 80),
        clinicianId: cl?.id || "",
        focus: String(s.focus || "").slice(0, 800),
        simTime: String(s.simTime || `Encounter ${i + 1}`).slice(0, 60),
        visitLabel: s.visitLabel ? String(s.visitLabel).slice(0, 80) : undefined,
        brief: text(s.brief, 900),
        tasks: tasks.length ? tasks : undefined,
        patientReason: text(s.patientReason, 400),
        reason: text(s.reason, 160),
      };
    })
    .filter((s) => s.clinicianId);
}
