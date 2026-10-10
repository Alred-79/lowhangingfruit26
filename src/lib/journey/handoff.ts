import { get, newId, parse, run as sql } from "../db";
import { messagesOf } from "../engine/encounter";
import { chatJSON, MODELS } from "../llm";
import { handoffTo, renderSbar } from "./context";
import { entriesOf, handoffsOf, linksOf, messagesOfRun, quoteIn, stageRun, studentNameOf, who, type LoadedRun } from "./store";
import { BEHAVIOURS, SBAR_FIELDS, type BehaviourResult, type Handoff, type Observed, type Sbar, type Stage, type TraceEvaluation } from "./types";

export function saveHandoff(run: LoadedRun, stage: Stage, sbar: Sbar, opts: { cites?: string[]; unverified?: string[] } = {}): string {
  const next = run.stages.find((s) => s.order === stage.order + 1) || null;
  const student = studentNameOf(run.row.user_id);
  const from = who(run, stage, student);
  const to = next ? who(run, next, student) : null;
  const id = newId("ho_");
  sql(
    "INSERT INTO handoffs (id, run_id, from_stage, to_stage, author_role, author_is_ai, sbar) VALUES (?,?,?,?,?,?,?)",
    id,
    run.row.id,
    stage.id,
    next?.id || null,
    stage.roleTitle,
    from.isAi ? 1 : 0,
    JSON.stringify({ ...sbar, authorName: from.name, toName: to ? `${to.name} (${to.role})` : "the care team", cites: opts.cites || [], unverified: opts.unverified || [] }),
  );
  return id;
}

const str = { type: "string" };
const SBAR_SCHEMA = {
  type: "object",
  required: ["behaviours", "summary"],
  properties: {
    behaviours: {
      type: "array",
      items: {
        type: "object",
        required: ["key", "observed", "section", "quote", "feedback"],
        properties: {
          key: str,
          observed: { type: "string", enum: ["yes", "no", "na"] },
          section: { type: "string", enum: ["situation", "background", "assessment", "recommendation", "none"], description: "The SBAR section where the behaviour is shown, or where it should have been" },
          quote: { type: "string", description: "Words copied EXACTLY from that section that show the behaviour. Empty when not observed." },
          feedback: { type: "string", description: "1-2 sentences: what was done or missed and exactly what to write next time" },
        },
      },
    },
    summary: { type: "string", description: "2 sentences on how usable this handoff is for the receiver" },
  },
};

const EVAL_RULES = `You evaluate interprofessional communication in a clinical training simulation against TeamSTEPPS-aligned behaviours. You produce an explainable behavioural trace, not a score.

Rules:
- For each behaviour decide: observed "yes", "no", or "na" (the situation gave no opportunity).
- "yes" requires a quote copied exactly from the stated location. If you cannot quote it, it is "no".
- For "no", name the location where it should have appeared and say exactly what was missing.
- Feedback is addressed to the author as "you", concrete and kind: what the receiver could or could not do with what was written, and example wording.
- Judge against what was actually known in this encounter (listed for you). Do not expect things that were never found.`;

function check(observed: Observed, quote: string, located: boolean, feedback: string): Pick<BehaviourResult, "observed" | "verified" | "feedback"> {
  if (observed === "yes" && !located) return { observed: "no", verified: false, feedback: `${feedback} (The evaluator could not point to the exact words for this, so it is not credited.)` };
  return { observed, verified: observed === "yes" ? true : !!quote && located, feedback };
}

/** Communication behaviours judged from one SBAR. Used for every handoff, AI or student. */
export async function evaluateSbar(run: LoadedRun, handoffId: string): Promise<TraceEvaluation> {
  const h = handoffsOf(run.row.id).find((x) => x.id === handoffId);
  if (!h) throw new Error("Handoff not found");
  const stage = run.stages.find((s) => s.id === h.fromStage)!;
  const entries = entriesOf(run.row.id);
  const mine = entries.filter((e) => e.stageId === stage.id);
  const defs = BEHAVIOURS.filter((b) => b.sbar);
  const raw = await chatJSON<{ behaviours: { key: string; observed: Observed; section: string; quote: string; feedback: string }[]; summary: string }>({
    model: MODELS.smart,
    system: EVAL_RULES,
    schema: SBAR_SCHEMA,
    maxTokens: 2500,
    messages: [
      {
        role: "user",
        text: `HANDOFF: ${h.authorName} (${h.authorRole}) to ${h.toName}.

SBAR
Situation: ${h.sbar.situation || "(blank)"}
Background: ${h.sbar.background || "(blank)"}
Assessment: ${h.sbar.assessment || "(blank)"}
Recommendation: ${h.sbar.recommendation || "(blank)"}

WHAT WAS LEARNED IN THE AUTHOR'S ENCOUNTER (so you can judge whether the important findings and uncertainties were passed on)
${mine.map((e) => `- (${e.kind}, ${e.effectiveStatus}${e.meta?.importance ? ", " + e.meta.importance : ""}) ${e.text}`).join("\n") || "(nothing recorded)"}

BEHAVIOURS TO EVALUATE (return one result per key, same order)
${defs.map((b) => `${b.key}: ${b.label}. ${b.question}`).join("\n")}`,
      },
    ],
  });
  const behaviours: BehaviourResult[] = defs.map((b) => {
    const r = raw.behaviours?.find((x) => x.key === b.key);
    if (!r) return { key: b.key, observed: "no", location: "SBAR", quote: "", verified: false, feedback: "Not evaluated." };
    let section = SBAR_FIELDS.find((f) => f.key === r.section);
    let located = !!section && quoteIn(r.quote, h.sbar[section.key]);
    if (!located && r.quote) {
      const found = SBAR_FIELDS.find((f) => quoteIn(r.quote, h.sbar[f.key]));
      if (found) {
        section = found;
        located = true;
      }
    }
    const c = check(r.observed, r.quote, located, r.feedback || "");
    return { key: b.key, ...c, location: section ? `SBAR -> ${section.label}` : "SBAR", quote: located ? r.quote : "" };
  });
  const ev: TraceEvaluation = { scope: "sbar", subject: `${h.authorName} (${h.authorRole})`, behaviours, summary: raw.summary || "", evaluatedAt: new Date().toISOString() };
  sql("UPDATE handoffs SET evaluation = ? WHERE id = ?", JSON.stringify(ev), handoffId);
  return ev;
}

const STAGE_SCHEMA = {
  type: "object",
  required: ["behaviours", "summary"],
  properties: {
    behaviours: {
      type: "array",
      items: {
        type: "object",
        required: ["key", "observed", "source", "quote", "feedback"],
        properties: {
          key: str,
          observed: { type: "string", enum: ["yes", "no", "na"] },
          source: { type: "string", enum: ["visit", "note", "sbar", "consult", "huddle", "none"], description: "Which labelled source the evidence is in (or where it should have been)" },
          turn: { type: "integer", description: "Turn number when source = visit" },
          quote: { type: "string", description: "The learner's words copied EXACTLY from that source. Empty when not observed." },
          feedback: { type: "string", description: "1-2 sentences, concrete, with example wording" },
        },
      },
    },
    summary: { type: "string", description: "3-4 sentences on how the learner worked as a member of this team" },
  },
};

/**
 * The learner's full behavioural trace for the run: their visit, note, SBAR, consults and huddle.
 * Communication behaviours are carried over from the SBAR evaluation so the two never disagree.
 */
export async function evaluateStudent(run: LoadedRun): Promise<TraceEvaluation> {
  const runId = run.row.id;
  const stage = run.stages.find((s) => s.id === run.row.student_stage_id)!;
  const sr = stageRun(runId, stage.id);
  const student = studentNameOf(run.row.user_id);
  const entries = entriesOf(runId);
  const links = linksOf(runId);
  const handoffs = handoffsOf(runId);
  const mineH = handoffs.find((h) => h.fromStage === stage.id) || null;
  const received = handoffTo(runId, stage.id);
  const enc = sr?.encounter_id ? get<{ wrapup: string | null }>("SELECT wrapup FROM encounters WHERE id = ?", sr.encounter_id) : undefined;
  const msgs = sr?.encounter_id ? messagesOf(sr.encounter_id).filter((m) => m.speaker === "student" || m.speaker === "patient" || m.speaker === "system") : [];
  const note = Object.values(parse<Record<string, string>>(enc?.wrapup, {})).filter(Boolean).join("\n");
  const team = messagesOfRun(runId);
  const consults = team.filter((m) => m.thread.startsWith("consult:") || m.kind === "callout");
  const huddle = team.filter((m) => m.thread === "huddle");
  const byId = new Map(entries.map((e) => [e.id, e]));
  const myEntryIds = new Set(entries.filter((e) => e.stageId === stage.id).map((e) => e.id));
  const used = links.filter((l) => l.relation === "uses" && l.stageId === stage.id && myEntryIds.has(l.from) && byId.get(l.to) && byId.get(l.to)!.stageOrder < stage.order);
  const priorOpen = entries.filter((e) => e.stageOrder < stage.order && ["uncertain", "disputed", "open_question"].includes(e.status));

  let sbarEval = mineH?.evaluation || null;
  if (mineH && !sbarEval) sbarEval = await evaluateSbar(run, mineH.id);
  const defs = BEHAVIOURS.filter((b) => !b.sbar);

  const sbarText = mineH ? SBAR_FIELDS.map((f) => `${f.label}: ${mineH.sbar[f.key]}`).join("\n") : "";
  const consultText = consults.map((m) => `${m.fromIsAi ? m.fromName : "LEARNER"} -> ${m.toRole || "team"}: ${m.text}`).join("\n");
  const huddleText = huddle.map((m) => `${m.fromIsAi ? m.fromName : "LEARNER"}: ${m.text}`).join("\n");

  const raw = await chatJSON<{ behaviours: { key: string; observed: Observed; source: string; turn?: number; quote: string; feedback: string }[]; summary: string }>({
    model: MODELS.smart,
    system: EVAL_RULES + "\n- Only the LEARNER's own words count as evidence of the learner's behaviour. Colleagues' words are context.",
    schema: STAGE_SCHEMA,
    maxTokens: 5000,
    messages: [
      {
        role: "user",
        text: `LEARNER: ${student}, acting as ${stage.roleTitle} in encounter ${stage.order} of ${run.stages.length}. Purpose of their encounter: ${stage.focus}

WHAT THE LEARNER RECEIVED
${received ? renderSbar(received) : "No handoff (first encounter)."}
Earlier entries that were uncertain, disputed or unanswered when the learner started:
${priorOpen.map((e) => `- (${e.status}) ${e.text}`).join("\n") || "(none)"}

SYSTEM-RECORDED FACTS ABOUT THE LEARNER'S USE OF PRIOR INFORMATION (reliable)
${used.length ? used.map((l) => `- Turn ${l.evidence?.turn}: built on "${byId.get(l.to)!.text}" (from ${byId.get(l.to)!.contributorName})`).join("\n") : "- No turn in the learner's visit was linked to an earlier entry."}

SOURCE visit: THE LEARNER'S VISIT
${msgs.map((m) => `[T${m.turn}] ${m.speaker === "student" ? "LEARNER" : m.speaker === "patient" ? "PATIENT" : "CHART"}: ${m.text}`).join("\n") || "(no conversation)"}

SOURCE note: THE LEARNER'S WRITTEN NOTE
${note || "(blank)"}

SOURCE sbar: THE LEARNER'S SBAR HANDOFF
${sbarText || "(not written)"}

SOURCE consult: MESSAGES BETWEEN THE LEARNER AND COLLEAGUES OUTSIDE THE FIXED ORDER
${consultText || "(the learner did not contact any colleague)"}

SOURCE huddle: TEAM HUDDLE
${huddleText || "(no huddle contributions)"}

BEHAVIOURS TO EVALUATE (one result per key, same order)
${defs.map((b) => `${b.key}: [${b.domain}] ${b.label}. ${b.question}`).join("\n")}`,
      },
    ],
  });

  const visitText = (turn?: number) => msgs.filter((m) => m.speaker === "student" && (turn === undefined || m.turn === turn)).map((m) => m.text);
  const sources: { key: string; label: (turn?: number) => string; texts: (turn?: number) => string[] }[] = [
    { key: "visit", label: (t) => (t !== undefined ? `Visit, turn ${t}` : "Visit"), texts: visitText },
    { key: "note", label: () => "Written note", texts: () => [note] },
    { key: "sbar", label: () => "SBAR handoff", texts: () => (mineH ? Object.values(mineH.sbar) : []) },
    { key: "consult", label: () => "Messages with colleagues", texts: () => consults.filter((m) => !m.fromIsAi).map((m) => m.text) },
    { key: "huddle", label: () => "Team huddle", texts: () => huddle.filter((m) => !m.fromIsAi).map((m) => m.text) },
  ];
  const locate = (source: string, turn: number | undefined, quote: string): string | null => {
    const s = sources.find((x) => x.key === source);
    if (s && s.texts(turn).some((t) => quoteIn(quote, t))) return detail(s.key, turn, quote);
    if (s?.key === "visit") {
      const m = msgs.find((x) => x.speaker === "student" && quoteIn(quote, x.text));
      if (m) return detail("visit", m.turn, quote);
    }
    for (const o of sources) if (o.texts(undefined).some((t) => quoteIn(quote, t))) return detail(o.key, o.key === "visit" ? msgs.find((x) => x.speaker === "student" && quoteIn(quote, x.text))?.turn : undefined, quote);
    return null;
  };
  function detail(key: string, turn: number | undefined, quote: string): string {
    if (key === "sbar" && mineH) {
      const f = SBAR_FIELDS.find((x) => quoteIn(quote, mineH.sbar[x.key]));
      return f ? `SBAR -> ${f.label}` : "SBAR handoff";
    }
    if (key === "consult") {
      const m = consults.find((x) => !x.fromIsAi && quoteIn(quote, x.text));
      return m ? (m.kind === "callout" ? "Call-out to the team" : `Consult with ${m.toRole || "a colleague"}`) : "Messages with colleagues";
    }
    return sources.find((s) => s.key === key)!.label(turn);
  }

  const rest: BehaviourResult[] = defs.map((b) => {
    const r = raw.behaviours?.find((x) => x.key === b.key);
    if (!r) return { key: b.key, observed: "no", location: "", quote: "", verified: false, feedback: "Not evaluated." };
    const loc = r.quote ? locate(r.source, r.turn, r.quote) : null;
    const c = check(r.observed, r.quote, !!loc, r.feedback || "");
    const fallback = sources.find((s) => s.key === r.source)?.label(r.source === "visit" ? r.turn : undefined) || "";
    return { key: b.key, ...c, location: loc || fallback, quote: loc ? r.quote : "" };
  });
  const com: BehaviourResult[] = sbarEval
    ? sbarEval.behaviours
    : BEHAVIOURS.filter((b) => b.sbar).map((b) => ({ key: b.key, observed: "no" as Observed, location: "SBAR", quote: "", verified: false, feedback: "No SBAR handoff was written." }));
  const ev: TraceEvaluation = { scope: "stage", subject: `${student} (${stage.roleTitle})`, behaviours: [...com, ...rest], summary: raw.summary || "", evaluatedAt: new Date().toISOString() };
  sql("UPDATE journey_runs SET evaluation = ? WHERE id = ?", JSON.stringify(ev), runId);
  return ev;
}

export type { Handoff };
