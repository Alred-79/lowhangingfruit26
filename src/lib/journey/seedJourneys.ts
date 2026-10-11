import fs from "node:fs";
import path from "node:path";
import { get, run } from "../db";

/**
 * Idempotent: loads ready-made journeys from data/seed/journeys/*.json when their case exists.
 * A seed journey that is already in the database is refreshed from its file when the file differs,
 * but never once faculty have edited it (editing sets owner or updated_at). Same idea as seed cases.
 */
export function seedJourneys(): number {
  const dir = path.join(process.cwd(), "data", "seed", "journeys");
  if (!fs.existsSync(dir)) return 0;
  let added = 0;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as { id: string; title: string; caseId: string; spec: { stages?: unknown[] } };
      if (!j.id || !Array.isArray(j.spec?.stages) || j.spec.stages.length < 2) continue;
      const next = JSON.stringify(j.spec);
      const existing = get<{ spec: string; title: string; owner_id: string | null; updated_at: string | null }>("SELECT spec, title, owner_id, updated_at FROM journeys WHERE id = ?", j.id);
      if (existing) {
        if (existing.owner_id || existing.updated_at) continue; // edited by faculty: leave it alone
        if (existing.spec !== next || existing.title !== j.title) {
          run("UPDATE journeys SET spec = ?, title = ? WHERE id = ?", next, j.title, j.id);
          console.log(`[seed] refreshed care journey ${j.id}`);
        }
        continue;
      }
      if (!get("SELECT 1 FROM cases WHERE id = ?", j.caseId)) continue;
      run("INSERT INTO journeys (id, status, title, case_id, spec) VALUES (?,?,?,?,?)", j.id, "published", j.title, j.caseId, next);
      added++;
    } catch (e) {
      console.error(`[seed] journey ${file} skipped`, e);
    }
  }
  return added;
}
