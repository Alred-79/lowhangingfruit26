/**
 * Small deterministic checks shared by the journey code. Pure functions: no database, no model.
 */

const normText = (s: string) => (s || "").toLowerCase().replace(/[‘’`´]/g, "'").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// Words that carry no content for a "does this text say that" comparison.
const FILLER = new Set("about after again also been being both from have having into just like more most much only other over same some such than that their them then there these they this those very what when when where which while with would your patient patients reports report reported states stated visit earlier information past month months week weeks days daily times year years something sometimes taking takes take does doing make makes made tell told well really going want need needs help today right thing things because before yeah actually know guess don't dont gets getting enough keep track".split(" "));

// Short irregular forms that stand for the same idea in a patient's words and in chart language.
const ALIAS: Record<string, string> = { myself: "alon", alone: "alon", live: "live", lives: "live", living: "live", lived: "live", single: "alon", divorc: "divo", divorced: "divo", wife: "spou", husband: "spou", spouse: "spou", partner: "spou" };

const contentStems = (t: string) => {
  const out = new Set<string>();
  for (const w of normText(t).split(" ")) {
    if (w.length < 4 || FILLER.has(w)) continue;
    out.add(ALIAS[w] || w.slice(0, 5));
  }
  return out;
};

/**
 * Does the patient's reply actually support a case fact? A disclosure ledger can mark a fact as
 * given when the reply never said it; before an entry is attributed to the patient the words must
 * overlap with the fact (its chart wording or the line the case author wrote for the patient).
 * Returns the best share of the fact's content words found in the reply, and the count.
 */
export function factSupport(reply: string, fact: { chart: string; says?: string }): { ratio: number; hits: number } {
  const have = contentStems(reply);
  let best = { ratio: 0, hits: 0 };
  for (const src of [fact.chart, fact.says || ""]) {
    const want = contentStems(src);
    if (!want.size) continue;
    let hits = 0;
    for (const w of want) if (have.has(w)) hits++;
    const ratio = hits / want.size;
    if (hits > best.hits || (hits === best.hits && ratio > best.ratio)) best = { ratio, hits };
  }
  return best;
}

/**
 * True when the patient's words support the fact: two shared content words, or one when the fact is short.
 * Deliberately lenient: patients paraphrase, and dropping a fact that was said costs more than keeping a
 * loosely worded one. It exists to stop facts the reply does not mention at all.
 */
export function factSupported(reply: string, fact: { chart: string; says?: string }): boolean {
  const { ratio, hits } = factSupport(reply, fact);
  return hits >= 2 || (hits >= 1 && ratio >= 0.2);
}

/**
 * Medication-safety concern rank: 0 = duplication, wrong dose or contraindication; 1 = interaction, unintended
 * therapy, unconfirmed prescribing intent or another safety flag; 2 = not a medication-safety concern.
 * A concern is a question until someone answers it, so it must never be recorded as settled. Text that
 * negates the concern ("no interaction found") does not count, and neither does a plain request for a
 * prescriber to review an ordinary treatment choice.
 */
export function medSafetyRank(text: string): 0 | 1 | 2 {
  const t = (text || "").toLowerCase();
  const meds = /(medic|drug|prescri|\bdose|\bmg\b|beta-?blocker|therapy|inhibitor|statin|metoprolol|carvedilol|lisinopril|metformin|warfarin|anticoag|insulin|tablet|pill|regimen|nsaid|ibuprofen|supplement|herbal)/.test(t);
  if (!meds) return 2;
  if (/\b(?:no|not|without|nor|ruled out|excluded|no evidence of|no sign of)\b[^.;]{0,30}(?:duplicat|interaction|contraindicat|overdos)/.test(t)) return 2;
  if (/(duplicat|wrong dose|incorrect dose|dose (?:is |seems |appears )?(?:too|wrong|incorrect)|overdos|double[- ]dos|contraindicat|two (?:different )?beta|dual beta)/.test(t)) return 0;
  if (/(interaction|unintentional|intent (?:is )?unconfirmed|unconfirmed intent|intent[^.]{0,20}unconfirmed|polypharmacy|inappropriate(?:ly)? prescri|medication safety|safety (?:concern|issue)|adverse (?:effect|reaction)|(?:needs?|requires?|requiring) (?:urgent )?(?:prescriber|medication) review)/.test(t)) return 1;
  return 2;
}
export const isMedSafetyConcern = (text: string) => medSafetyRank(text) < 2;

/** Share of the content words of `quote` that occur together in the single best text of `texts` (0 to 1). Used to tell a paraphrase of something that was said from words that appear nowhere. */
export function bestOverlap(quote: string, texts: string[]): number {
  const want = contentStems(quote);
  if (want.size < 3) return 0;
  let best = 0;
  for (const t of texts) {
    const have = contentStems(t);
    let hits = 0;
    for (const w of want) if (have.has(w)) hits++;
    best = Math.max(best, hits / want.size);
  }
  return best;
}

const DRUG_NAME = /\b(?:[a-z]{3,}(?:olol|pril|sartan|statin|formin|prazole|dipine|semide|thiazide|farin|gliptin|gliflozin|glutide|floxacin|cillin|mycin)|insulin|aspirin|ibuprofen|naproxen|acetaminophen|digoxin|amiodarone|apixaban|rivaroxaban|spironolactone|furosemide|nsaids?)\b/g;
/** Medicine names (and the beta-blocker class) mentioned in a text, lower case. */
export function drugNames(text: string): Set<string> {
  const t = (text || "").toLowerCase();
  const out = new Set<string>(t.match(DRUG_NAME) || []);
  if (/beta[- ]?blockers?/.test(t)) out.add("beta-blocker");
  return out;
}

/**
 * Do two texts raise the same issue? Two or more medicines in common; or one in common when both are
 * medication-safety concerns; or most of one text's content words found in the other. Conservative on
 * purpose: two entries about different medicines or different topics stay separate.
 */
export function sameIssue(a: string, b: string): boolean {
  const da = drugNames(a);
  let shared = 0;
  for (const d of drugNames(b)) if (da.has(d)) shared++;
  if (shared >= 2) return true;
  if (shared >= 1 && isMedSafetyConcern(a) && isMedSafetyConcern(b)) return true;
  return Math.max(bestOverlap(a, [b]), bestOverlap(b, [a])) >= 0.6;
}

/**
 * Keeps the first (best-ranked) item of each issue. `items` must already be in rank order. Returns the kept
 * items and, for each kept item, the ones folded into it as related.
 */
export function dedupeBySubject<T extends { text: string }>(items: T[]): { kept: T[]; related: Map<T, T[]> } {
  const kept: T[] = [];
  const related = new Map<T, T[]>();
  for (const it of items) {
    const home = kept.find((k) => sameIssue(k.text, it.text));
    if (home) related.set(home, [...(related.get(home) || []), it]);
    else kept.push(it);
  }
  return { kept, related };
}

/** Splits text into sentences without breaking after titles and common abbreviations ("Dr. Lee ..."). */
export function sentencesOf(text: string): string[] {
  const parts: string[] = [];
  for (const piece of (text || "").split(/(?<=[.?!])\s+|\n+/).map((x) => x.trim()).filter(Boolean)) {
    const last = parts[parts.length - 1];
    if (last && /(?:^|[\s(])(?:Dr|Mr|Mrs|Ms|Prof|St|vs|approx|e\.g|i\.e)\.$/.test(last)) parts[parts.length - 1] = `${last} ${piece}`;
    else parts.push(piece);
  }
  return parts;
}
