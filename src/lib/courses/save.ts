import { get } from "@/lib/db";
import { normalizeSettings, type AssignmentSettings, type AssignmentType } from "./settings";

export interface AssignmentInput {
  title: string;
  instructions: string;
  type: AssignmentType;
  caseIds: string[];
  journeyId: string | null;
  settings: AssignmentSettings;
  dueAt: string | null;
}

/** Validates an assignment sent by the builder. Returns an error message or the cleaned input. */
export function readAssignment(b: Record<string, unknown>): AssignmentInput | string {
  const title = String(b.title || "").trim().slice(0, 160);
  if (!title) return "Give the assignment a title";
  const type = (["homework", "exam", "practice"] as const).find((t) => t === b.type);
  if (!type) return "Choose homework, exam or practice";
  let journeyId: string | null = null;
  let caseIds: string[] = [];
  if (b.journeyId) {
    const j = get<{ id: string; case_id: string }>("SELECT id, case_id FROM journeys WHERE id = ? AND status = 'published'", String(b.journeyId));
    if (!j) return "That care journey is not published";
    journeyId = j.id;
    caseIds = [j.case_id];
  } else {
    const ids = Array.isArray(b.caseIds) ? [...new Set(b.caseIds.map(String))] : [];
    caseIds = ids.filter((id) => get("SELECT 1 FROM cases WHERE id = ? AND status = 'published'", id));
    if (!caseIds.length) return "Choose at least one published patient";
  }
  let dueAt: string | null = null;
  if (b.dueAt) {
    const d = new Date(String(b.dueAt));
    if (Number.isNaN(d.getTime())) return "The due date is not valid";
    dueAt = d.toISOString();
  }
  return {
    title,
    instructions: String(b.instructions || "").trim().slice(0, 4000),
    type,
    caseIds,
    journeyId,
    settings: normalizeSettings(type, (b.settings as Record<string, unknown>) || {}),
    dueAt,
  };
}
