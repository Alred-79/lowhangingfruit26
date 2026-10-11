import type { CaseProfile, ClinicalAction, Fact } from "../types";

/**
 * What the student can already see in the chart before asking or ordering anything: the
 * "at start" chart items and every document released at the start. Items whose content is already
 * there are not scored as missed (nobody should lose credit for something placed in front of them).
 *
 * The rule is deliberately conservative and deterministic:
 *  - an action is start-visible when it is explicitly linked (artifactIds) to a document released at
 *    the start, or when it is a record/vitals/lab/imaging review whose numbers and wording are all
 *    already on one start source (e.g. "Last vitals" in the chart header);
 *  - a fact is start-visible when almost all of its distinctive words are on the start chart.
 *    Exams, tests and assessments are never matched by content: they must still be performed.
 */

const STOP = new Set(
  "the and for with was were has have had are not but from that this then than into about over also its his her she him they them their there been being very just only some any one two per for who which when what while after before during since until patient reports report reported takes taking take denies deny denied states stated history known none no never currently today recent recently approximately approx mild mildly several".split(" "),
);
const WORDNUM: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", twelve: "12" };

function words(text: string): string[] {
  const t = text
    .toLowerCase()
    .replace(/(\d)\s*(mg|mcg|g|kg|lb|lbs|ml|mmhg|%|f|c|bpm|cm|mm)\b/g, "$1 $2")
    .replace(/[^a-z0-9.><]+/g, " ")
    .replace(/(?<![0-9])\.|\.(?![0-9])/g, " ");
  return t
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => WORDNUM[w] || w)
    .map((w) => (/^[a-z]{4,}s$/.test(w) ? w.slice(0, -1) : w));
}
const isNum = (w: string) => /^[<>]?\d+(\.\d+)?$/.test(w);
const content = (text: string) => words(text).filter((w) => isNum(w) || (w.length >= 3 && !STOP.has(w)));

function artifactText(a: CaseProfile["artifacts"][number]): string {
  return [a.title, a.author, a.body, a.table ? [a.table.columns.join(" "), ...a.table.rows.map((r) => r.cells.join(" "))].join(" ") : "", a.chart ? a.chart.series.map((s) => `${s.name} ${s.points.map((p) => `${p.x} ${p.y}`).join(" ")}`).join(" ") : ""]
    .filter(Boolean)
    .join(" ");
}

export interface StartSources {
  /** One entry per chart-at-start line and per start-released document. */
  sources: { label: string; tokens: Set<string> }[];
  union: Set<string>;
  startArtifactIds: Set<string>;
}

export function startSources(c: CaseProfile): StartSources {
  const sources = [
    ...c.chartAtStart.map((x) => ({ label: x.label, tokens: new Set(content(`${x.label} ${x.value}`)) })),
    ...c.artifacts.filter((a) => a.release.when === "start").map((a) => ({ label: a.title, tokens: new Set(content(artifactText(a))) })),
  ];
  const union = new Set<string>();
  for (const s of sources) for (const t of s.tokens) union.add(t);
  return { sources, union, startArtifactIds: new Set(c.artifacts.filter((a) => a.release.when === "start").map((a) => a.id)) };
}

const REVIEW_KINDS = new Set(["record", "vitals", "lab", "imaging"]);

export function actionStartVisible(a: ClinicalAction, src: StartSources): { visible: boolean; why: string } {
  const linked = (a.artifactIds || []).filter((id) => src.startArtifactIds.has(id));
  if (linked.length) return { visible: true, why: `linked to start document ${linked.join(",")}` };
  if (!REVIEW_KINDS.has(a.kind)) return { visible: false, why: "" };
  // Content matching is only for "look at what is already on file" items, never for something done live.
  const reviewName = /^(review|read|look at|check)\b/i.test(a.name.trim());
  const liveName = /\b(measure|take|perform|palpat|inspect|guided|camera|demonstrat|order|administer|recognize)\b/i.test(a.name);
  if (liveName || (a.kind !== "vitals" && !reviewName)) return { visible: false, why: "" };
  const toks = content(a.result);
  const nums = toks.filter(isNum);
  const wordsOnly = toks.filter((w) => !isNum(w));
  if (nums.length < 2) return { visible: false, why: "" };
  // Every number must sit in one single start source, plus most of the wording around them.
  for (const s of src.sources) {
    if (!nums.every((n) => s.tokens.has(n))) continue;
    const cov = wordsOnly.length ? wordsOnly.filter((w) => s.tokens.has(w)).length / wordsOnly.length : 1;
    if ((a.kind === "vitals" && nums.length >= 3) || nums.length >= 4 || cov >= 0.5) return { visible: true, why: `numbers match "${s.label}"` };
  }
  return { visible: false, why: "" };
}

export function factStartVisible(f: Fact, src: StartSources): { visible: boolean; why: string } {
  const toks = [...new Set(content(f.chart))];
  if (toks.length < 3) return { visible: false, why: "" };
  // Negative findings ("denies...", "no history of...") are never in a chart header the same way.
  const hit = toks.filter((t) => src.union.has(t)).length;
  if (hit / toks.length >= 0.8) return { visible: true, why: `${hit}/${toks.length} words on the start chart` };
  return { visible: false, why: "" };
}

export interface StartVisible {
  actionIds: Set<string>;
  factIds: Set<string>;
  why: Record<string, string>;
}

export function startVisible(c: CaseProfile): StartVisible {
  const src = startSources(c);
  const out: StartVisible = { actionIds: new Set(), factIds: new Set(), why: {} };
  for (const a of c.actions) {
    const r = actionStartVisible(a, src);
    if (r.visible) (out.actionIds.add(a.id), (out.why[a.id] = r.why));
  }
  for (const f of c.facts) {
    const r = factStartVisible(f, src);
    if (r.visible) (out.factIds.add(f.id), (out.why[f.id] = r.why));
  }
  return out;
}
