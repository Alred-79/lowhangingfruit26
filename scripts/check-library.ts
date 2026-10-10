/**
 * Quality gate for the seed case library. Loads every data/seed/cases/*.json and reports problems.
 *
 * Run:  npx tsx scripts/check-library.ts [filter] [--all] [--json]
 *   filter   substring of the file name
 *   --all    also list cases with no problems
 *   --json   machine-readable output
 *   --generated   skip the faculty sample-*.json files
 * Exit code 1 when any case has an ERROR-level problem.
 *
 * Clinical review (needs Bedrock credentials, so add --env-file=.env.local):
 *   --review        ask the smart model to audit each case as a clinician-educator would and write
 *                   data/seed/cases/.review/<case>.json: a list of issues, each with an exact find/replace.
 *                   Skips cases that already have a review file (delete it to re-review).
 *   --apply         apply the high and medium severity find/replace edits from those review files.
 * The review is an aid for a human reader, not a substitute: read the issue list before applying.
 *
 * ERROR = the case should be fixed or regenerated before it is shown. WARN = worth a look.
 */
import fs from "node:fs";
import path from "node:path";
import { FACT_CATEGORIES } from "../src/lib/types";
import type { CaseProfile, Profession } from "../src/lib/types";
import { chatJSON, MODELS } from "../src/lib/llm";

const dir = path.join("data", "seed", "cases");
const roles: Profession[] = JSON.parse(fs.readFileSync(path.join("data", "professions.json"), "utf8"));
const args = process.argv.slice(2);
const filter = (args.find((a) => !a.startsWith("--")) || "").toLowerCase();
const showAll = args.includes("--all");
const asJson = args.includes("--json");

const TIERS = ["initial", "discoverable", "reluctant", "hidden"];
const KINDS = ["exam", "vitals", "lab", "imaging", "test", "record", "assessment", "procedure"];
const empty = (v: unknown) => v === undefined || v === null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);
/** A result cell that carries a number needs a unit in the row; a qualitative result ("Negative") does not. */
const hasNumber = (s: string) => /\d/.test(s);

interface Report {
  file: string;
  role: string;
  errors: string[];
  warnings: string[];
  stats: string;
}

function check(file: string): Report {
  const errors: string[] = [];
  const warnings: string[] = [];
  const E = (m: string) => errors.push(m);
  const W = (m: string) => warnings.push(m);
  let wrapper: { origin?: string; reviewed?: boolean; profile?: CaseProfile };
  try {
    wrapper = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  } catch (e) {
    return { file, role: "?", errors: ["file is not valid JSON: " + (e as Error).message], warnings, stats: "" };
  }
  const c = wrapper.profile as CaseProfile;
  if (!c || typeof c !== "object") return { file, role: "?", errors: ["no profile object"], warnings, stats: "" };
  if (!wrapper.origin) E("wrapper has no origin");
  if (typeof wrapper.reviewed !== "boolean") E("wrapper has no reviewed flag");
  if (wrapper.origin === "ai_draft" && wrapper.reviewed) E("ai_draft case is marked reviewed");

  // ----- role -----
  const roleId = (c.professions || [])[0];
  const role = roles.find((r) => r.id === roleId);
  if (!role) E(`profession "${roleId}" is not in data/professions.json`);
  else if (!file.startsWith("sample-") && !file.startsWith(role.id + "-")) W(`file name does not start with its profession id "${role.id}"`);

  // ----- top-level fields -----
  for (const k of ["title", "summary", "specialty", "setting", "encounterType"] as const) if (empty(c[k])) E(`empty ${k}`);
  if (!(c.difficulty >= 1 && c.difficulty <= 5)) E(`difficulty ${c.difficulty} out of range 1-5`);
  if (c.setting && !/tele|video|virtual|remote|phone/i.test(c.setting)) W(`setting does not read as a telehealth visit: "${c.setting}"`);
  const pt = c.patient || ({} as CaseProfile["patient"]);
  for (const k of ["name", "sex", "pronouns", "ethnicity", "occupation", "language", "appearance"] as const) if (empty(pt[k])) E(`empty patient.${k}`);
  if (typeof pt.age !== "number" || pt.age < 0 || pt.age > 110) E(`patient.age implausible: ${pt.age}`);
  if (pt.portrait) {
    const f = path.join("public", pt.portrait.replace(/^\//, ""));
    if (!fs.existsSync(f)) E(`portrait file missing: ${pt.portrait}`);
  }
  const pe = c.persona || ({} as CaseProfile["persona"]);
  for (const k of ["personality", "communicationStyle", "emotionalState", "background"] as const) if (empty(pe[k])) E(`empty persona.${k}`);
  if (!["low", "moderate", "high"].includes(pe.healthLiteracy)) E(`persona.healthLiteracy invalid: ${pe.healthLiteracy}`);
  if ((pe.speechExamples || []).length < 2) W("fewer than 2 speech examples");
  if (empty(pe.concerns)) W("no patient concerns");

  // ----- scenario -----
  const sc = c.scenario || ({} as CaseProfile["scenario"]);
  if (empty(sc.openingLine)) E("opening line is empty");
  if (empty(sc.studentBrief)) E("student brief is empty");
  if (empty(sc.chiefComplaint)) E("chief complaint is empty");
  if ((sc.tasks || []).length < 2) E(`only ${(sc.tasks || []).length} scenario tasks`);
  if (!(sc.timeLimitMin >= 10 && sc.timeLimitMin <= 45)) E(`time limit ${sc.timeLimitMin} min out of range 10-45`);
  if ((c.chartAtStart || []).length < 2) W(`only ${(c.chartAtStart || []).length} chartAtStart rows`);
  for (const r of c.chartAtStart || []) if (empty(r.label) || empty(r.value)) E("chartAtStart row with empty label or value");

  // ----- facts -----
  const facts = c.facts || [];
  const factIds = new Set(facts.map((f) => f.id));
  if (facts.length < 20) E(`only ${facts.length} facts (minimum 20)`);
  else if (facts.length < 25) W(`${facts.length} facts (25+ expected)`);
  if (factIds.size !== facts.length) E("duplicate fact ids");
  if (!facts.some((f) => f.category === "chief_complaint" && f.tier === "initial")) E("no initial-tier chief_complaint fact");
  for (const f of facts) {
    for (const k of ["topic", "chart", "says"] as const) if (empty(f[k])) E(`fact ${f.id}: empty ${k}`);
    if (!TIERS.includes(f.tier)) E(`fact ${f.id}: invalid tier "${f.tier}"`);
    if (!(f.category in FACT_CATEGORIES)) E(`fact ${f.id}: unknown category "${f.category}"`);
    if (!["critical", "important", "minor"].includes(f.importance)) E(`fact ${f.id}: invalid importance "${f.importance}"`);
    if (f.distractor && f.importance === "critical") W(`fact ${f.id}: distractor marked critical`);
  }
  const tierCount = (t: string) => facts.filter((f) => f.tier === t).length;
  if (facts.length && tierCount("initial") / facts.length > 0.5) W(`${tierCount("initial")} of ${facts.length} facts are initial tier (little to discover)`);
  if (tierCount("discoverable") === 0) E("no discoverable-tier facts");
  if (tierCount("reluctant") + tierCount("hidden") === 0) W("no reluctant or hidden facts");
  if (!facts.some((f) => f.importance === "critical")) E("no critical facts");
  const critGated = facts.filter((f) => f.importance === "critical" && f.tier === "hidden").length;
  if (critGated > 2) W(`${critGated} critical facts are hidden tier (may be unreachable at low rapport)`);

  // ----- actions -----
  const actions = c.actions || [];
  const actionIds = new Set(actions.map((a) => a.id));
  if (actions.length < 6) E(`only ${actions.length} actions (minimum 6)`);
  if (actionIds.size !== actions.length) E("duplicate action ids");
  const offScope = new Set<string>();
  for (const a of actions) {
    if (empty(a.name)) E(`action ${a.id}: empty name`);
    if (empty(a.result)) E(`action ${a.id}: empty result`);
    if (!KINDS.includes(a.kind)) E(`action ${a.id}: invalid kind "${a.kind}"`);
    else if (role && !role.actionKinds.includes(a.kind)) offScope.add(`${a.id} (${a.kind}: ${a.name})`);
    for (const id of a.artifactIds || []) if (!(c.artifacts || []).some((d) => d.id === id)) E(`action ${a.id}: artifactId ${id} does not exist`);
  }
  if (offScope.size) E(`${offScope.size} action(s) of a kind ${role!.id} does not use [${role!.actionKinds.join(", ")}]: ${[...offScope].join("; ")}`);

  // ----- artifacts -----
  const arts = c.artifacts || [];
  const artIds = new Set(arts.map((d) => d.id));
  if (arts.length < 2) E(`only ${arts.length} artifacts`);
  if (!arts.some((d) => d.release?.when === "start")) W("no artifact is in the chart at the start");
  for (const d of arts) {
    if (empty(d.title)) E(`artifact ${d.id}: empty title`);
    const hasContent = !empty(d.body) || (d.table && d.table.rows?.length) || (d.chart && d.chart.series?.length) || d.fileUrl;
    if (!hasContent) E(`artifact ${d.id} "${d.title}": no body, table or chart`);
    const rel = d.release;
    if (!rel) E(`artifact ${d.id}: no release`);
    else if (rel.when === "action" && !actionIds.has(rel.ref || "")) E(`artifact ${d.id}: release ref "${rel.ref}" is not an action`);
    else if (rel.when === "fact" && !factIds.has(rel.ref || "")) E(`artifact ${d.id}: release ref "${rel.ref}" is not a fact`);
    if (d.table) {
      const cols = d.table.columns || [];
      if (!cols.length) E(`artifact ${d.id}: table has no columns`);
      for (const [i, r] of (d.table.rows || []).entries()) {
        const n = (r.cells || []).length;
        if (n === cols.length) continue;
        // A trailing "Flag" column with the flag carried on the row instead of in a cell still renders sensibly.
        if (n === cols.length - 1 && /flag/i.test(cols[cols.length - 1])) W(`artifact ${d.id} "${d.title}": has a Flag column but no flag cells (flag is on the row)`);
        else E(`artifact ${d.id} "${d.title}": row ${i + 1} has ${n} cells for ${cols.length} columns`);
        break;
      }
      if (d.type === "lab_report") {
        const col = (re: RegExp) => cols.findIndex((x) => re.test(x));
        const ci = { result: col(/result|value/i), unit: col(/unit/i), ref: col(/ref|range|normal/i) };
        if (ci.ref < 0) E(`artifact ${d.id} "${d.title}": lab table has no reference-range column`);
        if (ci.result < 0) W(`artifact ${d.id} "${d.title}": lab table has no result column`);
        const noUnit: string[] = [];
        const noRef: string[] = [];
        for (const r of d.table.rows || []) {
          const cells = r.cells || [];
          const result = ci.result >= 0 ? cells[ci.result] || "" : "";
          if (!hasNumber(result)) continue; // qualitative result
          const unit = ci.unit >= 0 ? cells[ci.unit] || "" : "";
          // Unit may live in its own column or inline in the result ("8.9 g/dL").
          const inline = /\d\s*[a-zA-Zµμ%×x/^]/.test(result) || /%|ratio|index|\bph\b|inr|specific gravity/i.test(cells[0] || "");
          if (empty(unit.replace(/^[-–—]$|^n\/?a$/i, "")) && !inline) noUnit.push(cells[0]);
          if (ci.ref >= 0 && empty((cells[ci.ref] || "").replace(/^[-–—]$/, ""))) noRef.push(cells[0]);
        }
        if (noUnit.length) E(`artifact ${d.id} "${d.title}": numeric lab rows without units: ${noUnit.join(", ")}`);
        if (noRef.length) E(`artifact ${d.id} "${d.title}": lab rows without a reference range: ${noRef.join(", ")}`);
      }
    } else if (d.type === "lab_report" && empty(d.body)) {
      E(`artifact ${d.id} "${d.title}": lab report has no table`);
    } else if (d.type === "lab_report") {
      W(`artifact ${d.id} "${d.title}": lab report is free text, not a table`);
    }
    if (d.chart) {
      for (const s of d.chart.series || []) {
        if ((s.points || []).length < 2) W(`artifact ${d.id}: chart series "${s.name}" has fewer than 2 points`);
        if ((s.points || []).some((p) => typeof p.y !== "number" || Number.isNaN(p.y))) E(`artifact ${d.id}: chart series "${s.name}" has a non-numeric point`);
      }
      if (empty(d.chart.xLabel) || empty(d.chart.yLabel)) W(`artifact ${d.id}: chart axis label missing`);
    }
  }

  // ----- objectives -----
  const objs = c.objectives || [];
  if (objs.length < 3) E(`only ${objs.length} objectives`);
  for (const o of objs) {
    if (empty(o.text)) E(`objective ${o.id}: empty text`);
    const links = (o.factIds || []).length + (o.actionIds || []).length;
    if (!links) E(`objective ${o.id} has no linked facts or actions`);
    for (const id of o.factIds || []) if (!factIds.has(id)) E(`objective ${o.id}: fact ${id} does not exist`);
    for (const id of o.actionIds || []) if (!actionIds.has(id)) E(`objective ${o.id}: action ${id} does not exist`);
  }

  // ----- mismatches -----
  const mm = c.mismatches || [];
  if (!mm.length) E("no patient-versus-chart mismatch");
  for (const m of mm) {
    for (const k of ["patientClaim", "recordEvidence", "teachingPoint"] as const) if (empty(m[k])) E(`mismatch ${m.id}: empty ${k}`);
    if (m.factId && !factIds.has(m.factId)) E(`mismatch ${m.id}: fact ${m.factId} does not exist`);
    if (m.artifactId && !artIds.has(m.artifactId)) E(`mismatch ${m.id}: artifact ${m.artifactId} does not exist`);
    if (!m.factId) W(`mismatch ${m.id}: not linked to a fact`);
  }

  // ----- answer key -----
  const ak = c.answerKey || ({} as CaseProfile["answerKey"]);
  if (empty(ak.primaryProblem)) E("answer key: empty primaryProblem");
  for (const k of ["keyFindings", "plan", "educationPoints"] as const) if (empty(ak[k])) E(`answer key: empty ${k}`);
  for (const k of ["differential", "redFlags"] as const) if (empty(ak[k])) W(`answer key: empty ${k}`);

  // ----- leakage -----
  // The opening line should not already state reluctant/hidden facts verbatim.
  const opening = (sc.openingLine || "").toLowerCase();
  for (const f of facts.filter((x) => x.tier === "reluctant" || x.tier === "hidden")) {
    const s = (f.says || "").toLowerCase().trim();
    if (s.length > 25 && opening.includes(s.slice(0, 40))) W(`opening line repeats ${f.tier} fact ${f.id}`);
  }

  const stats = `${facts.length}f (${TIERS.map((t) => tierCount(t)).join("/")}) ${actions.length}a ${arts.length}d ${objs.length}o ${mm.length}m L${c.difficulty} ${sc.timeLimitMin}min`;
  return { file, role: roleId || "?", errors, warnings, stats };
}

const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".json") && f.toLowerCase().includes(filter) && !(args.includes("--generated") && f.startsWith("sample-")))
  .sort();

// ---------------------------------------------------------------- clinical review
const reviewDir = process.env.REVIEW_DIR || path.join(dir, ".review");

interface Issue {
  severity: "high" | "medium" | "low";
  kind: string;
  where: string;
  problem: string;
  find?: string;
  replace?: string;
  actionId?: string;
  newResult?: string;
  deleteAction?: boolean;
}

const REVIEW_SYSTEM = `You are a senior clinician-educator and simulation director auditing an AI-drafted standardized-patient case before it is shown to health-professions faculty. You are exacting and you verify rather than assume. Check, in this order:
1. Clinical accuracy: drug doses and frequencies, units, reference ranges, H/L flags, score and grade calculations (work each one out: CTCAE grades, CHA2DS2-VASc, Wells, eGFR stage, BMI, percent weight change, pack-years, cumulative doses), guideline statements, contraindications, and whether the answer-key plan is safe and current.
2. Internal consistency: the same value, dose, date, age or name must agree across facts, actions, artifacts, chartAtStart, scenario, mismatches and the answer key. Timelines must add up.
3. Leakage: chartAtStart, the student brief, the opening line, artifacts released at "start", and fact topic labels must not give away reluctant/hidden facts or the diagnosis the learner is meant to work out. A record cannot contain something the patient has told nobody. Actions are things the learner does or reviews (examination, measurement, a named screening instrument, a record or result review); an action that is only an interview question ("Ask about...", "Explore...") and whose result hands over a reluctant or hidden fact bypasses the interview and is a leak: give a newResult that reports only what an observation or instrument would show, or set deleteAction when the action is nothing but a question.
4. Scope and feasibility: every action must be something this role does, and feasible in a video visit. The answer key must stay within the role's scope of practice.
5. Dignity: stereotyped, caricatured or disrespectful portrayal; dialect spellings; culture, income, faith, body size or immigration status used as the cause of the problem.
6. Mismatches: the stated record evidence must really be present in the named artifact or an action result.
Report only real problems you are confident about. Do not report style preferences, and do not ask for more content. If the case is sound, return an empty list.`;

const REVIEW_SCHEMA = {
  type: "object",
  required: ["verdict", "issues"],
  properties: {
    verdict: { type: "string", enum: ["sound", "minor_fixes", "major_fixes", "regenerate"], description: "regenerate only if the scenario itself is implausible, unsafe or offensive and cannot be fixed by text edits" },
    issues: {
      type: "array",
      description: "At most 12, most serious first",
      items: {
        type: "object",
        required: ["severity", "kind", "where", "problem"],
        properties: {
          severity: { type: "string", enum: ["high", "medium", "low"], description: "high = clinically wrong, unsafe, offensive, or gives the case away; medium = inconsistency a faculty reader would notice; low = cosmetic" },
          kind: { type: "string", enum: ["accuracy", "consistency", "leakage", "scope", "feasibility", "dignity", "mismatch", "other"] },
          where: { type: "string", description: "e.g. 'action a8 result', 'answerKey.plan[2]', 'artifact d3 row Potassium'" },
          problem: { type: "string", description: "What is wrong and what is correct, in one or two sentences" },
          find: { type: "string", description: "A verbatim substring of ONE string value in the case JSON (copy it exactly, 12-200 characters, no JSON punctuation around it) that should be replaced. Omit if the fix is not a simple text replacement." },
          replace: { type: "string", description: "The corrected text to put in place of `find`. Same register and length as the original." },
          actionId: { type: "string", description: "For a problem with a whole action result: the action id, with newResult or deleteAction" },
          newResult: { type: "string", description: "Full replacement text for that action's result" },
          deleteAction: { type: "boolean", description: "true to remove that action (only for actions that are purely interview questions)" },
        },
      },
    },
  },
};

async function reviewOne(file: string): Promise<{ verdict: string; issues: Issue[] }> {
  const c = (JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as { profile: CaseProfile }).profile;
  const role = roles.find((r) => r.id === c.professions?.[0]);
  const { version: _v, knowledge: _k, variants: _x, rubricId: _r, ...slim } = c;
  return chatJSON<{ verdict: string; issues: Issue[] }>({
    model: MODELS.smart,
    system: REVIEW_SYSTEM,
    maxTokens: 6000,
    schema: REVIEW_SCHEMA as unknown as Record<string, unknown>,
    messages: [
      {
        role: "user",
        text: `LEARNER ROLE: ${role?.name} (${role?.roleTitle})\nROLE SCOPE: ${role?.scope}\nACTION KINDS THIS ROLE USES: ${role?.actionKinds.join(", ")}\nEvery encounter is a telehealth video visit. Fact tiers: initial = volunteered; discoverable = shared when asked; reluctant / hidden = shared only with rapport and a direct, sensitive question.\n\nCASE JSON:\n${JSON.stringify(slim)}`,
      },
    ],
  });
}

/** Replaces `find` in every string value of the profile. Returns the number of replacements. */
function replaceEverywhere(node: unknown, find: string, replace: string): number {
  let n = 0;
  const walk = (v: unknown, set: (x: string) => void) => {
    if (typeof v === "string") {
      if (v.includes(find)) {
        n += v.split(find).length - 1;
        set(v.split(find).join(replace));
      }
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, (y) => (v[i] = y)));
    else if (v && typeof v === "object") for (const k of Object.keys(v)) walk((v as Record<string, unknown>)[k], (y) => ((v as Record<string, unknown>)[k] = y));
  };
  walk(node, () => {});
  return n;
}

async function reviewAll() {
  fs.mkdirSync(reviewDir, { recursive: true });
  const todo = files.filter((f) => !fs.existsSync(path.join(reviewDir, f)));
  console.log(`${todo.length} cases to review (${files.length - todo.length} already reviewed)`);
  let next = 0;
  let stop = false;
  await Promise.all(
    Array.from({ length: Number(process.env.CONCURRENCY) || 6 }, async () => {
      while (next < todo.length && !stop) {
        const f = todo[next++];
        const t = Date.now();
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const r = await reviewOne(f);
            r.issues = Array.isArray(r.issues) ? r.issues : [];
            fs.writeFileSync(path.join(reviewDir, f), JSON.stringify(r, null, 1));
            const by = (s: string) => r.issues.filter((i) => i.severity === s).length;
            console.log(`${r.verdict.padEnd(12)} ${f}  high ${by("high")}, medium ${by("medium")}, low ${by("low")}  ${Math.round((Date.now() - t) / 1000)}s`);
            break;
          } catch (e) {
            const msg = `${(e as Error).name}: ${(e as Error).message}`;
            console.error(`error ${f} attempt ${attempt}: ${msg.slice(0, 200)}`);
            if (/ExpiredToken|UnrecognizedClient|AccessDenied|security token/i.test(msg)) stop = true;
          }
        }
      }
    }),
  );
  if (stop) console.error("STOPPED: credentials problem.");
}

function applyAll() {
  let applied = 0;
  let skipped = 0;
  for (const f of files) {
    const rf = path.join(reviewDir, f);
    if (!fs.existsSync(rf)) continue;
    const r = JSON.parse(fs.readFileSync(rf, "utf8")) as { issues: (Issue & { applied?: number })[] };
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as { profile: CaseProfile };
    let touched = false;
    for (const i of r.issues) {
      if (i.applied !== undefined || i.severity === "low") continue;
      let n = 0;
      const c = data.profile;
      const act = i.actionId ? c.actions.find((a) => a.id === i.actionId) : undefined;
      if (act && i.deleteAction) {
        // Keep the case playable: never delete below 8 actions, and never orphan an objective or artifact.
        const orphans = c.objectives.some((o) => o.factIds.length + o.actionIds.filter((x) => x !== act.id).length === 0) || c.artifacts.some((d) => d.release.when === "action" && d.release.ref === act.id);
        if (c.actions.length > 8 && !orphans) {
          c.actions = c.actions.filter((a) => a.id !== act.id);
          for (const o of c.objectives) o.actionIds = o.actionIds.filter((x) => x !== act.id);
          n = 1;
        }
      } else if (act && i.newResult) {
        act.result = i.newResult;
        n = 1;
      } else if (i.find && i.replace !== undefined && i.find !== i.replace && i.find.length >= 8) {
        n = replaceEverywhere(c, i.find, i.replace);
      } else if (!i.find && !act) continue; // advisory only
      i.applied = n;
      if (n) {
        applied++;
        touched = true;
      } else {
        skipped++;
        console.log(`not applied  ${f}  [${i.severity}] ${i.where}: ${i.problem.slice(0, 160)}`);
      }
    }
    if (touched) fs.writeFileSync(path.join(dir, f), JSON.stringify(data, null, 1));
    fs.writeFileSync(rf, JSON.stringify(r, null, 1));
  }
  console.log(`${applied} edits applied, ${skipped} could not be located (fix those by hand).`);
}

function structural() {
const reports = files.map(check);

// Coverage: every role should have at least one case.
const covered = new Set(reports.map((r) => r.role));
const uncovered = roles.filter((r) => !covered.has(r.id)).map((r) => r.id);

if (asJson) {
  console.log(JSON.stringify({ reports, uncovered }, null, 1));
} else {
  for (const r of reports) {
    if (!r.errors.length && !r.warnings.length && !showAll) continue;
    console.log(`\n${r.errors.length ? "FAIL" : r.warnings.length ? "warn" : "ok  "} ${r.file}  [${r.stats}]`);
    for (const e of r.errors) console.log("   ERROR " + e);
    for (const w of r.warnings) console.log("   warn  " + w);
  }
  const failing = reports.filter((r) => r.errors.length);
  console.log(`\n${reports.length} cases checked: ${reports.length - failing.length} pass, ${failing.length} fail, ${reports.filter((r) => !r.errors.length && r.warnings.length).length} pass with warnings.`);
  if (failing.length) console.log("failing: " + failing.map((r) => `${r.file} (${r.errors.length})`).join(", "));
  if (!filter) console.log(uncovered.length ? `roles with no case (${uncovered.length}): ${uncovered.join(", ")}` : `every one of the ${roles.length} roles has at least one case.`);
}
process.exit(reports.some((r) => r.errors.length) ? 1 : 0);
}

if (args.includes("--review")) reviewAll().then(() => process.exit(0));
else if (args.includes("--apply")) applyAll();
else structural();
