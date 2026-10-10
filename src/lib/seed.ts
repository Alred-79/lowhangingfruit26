import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { get, newId, run } from "./db";
import type { CaseProfile } from "./types";

const DEMO_PASSWORD = "rounds-demo";

/** Idempotent: loads seed cases, clinician personas and demo accounts that are not yet in the DB. */
export function seed() {
  const dir = path.join(process.cwd(), "data", "seed", "cases");
  let added = 0;
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
      const id = "seed_" + file.replace(/\.json$/, "");
      if (get("SELECT 1 FROM cases WHERE id = ?", id)) continue;
      const { origin, reviewed, profile } = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as { origin: string; reviewed: boolean; profile: CaseProfile };
      run(
        "INSERT INTO cases (id, status, origin, reviewed, title, specialty, professions, difficulty, profile) VALUES (?,?,?,?,?,?,?,?,?)",
        id,
        "published",
        origin || "ai_draft",
        reviewed ? 1 : 0,
        profile.title,
        profile.specialty || "",
        JSON.stringify(profile.professions || []),
        profile.difficulty || 3,
        JSON.stringify(profile),
      );
      added++;
    }
  }
  const cdir = path.join(process.cwd(), "data", "clinicians");
  if (fs.existsSync(cdir)) {
    for (const file of fs.readdirSync(cdir).filter((f) => f.endsWith(".json"))) {
      const id = file.replace(/\.json$/, "");
      if (get("SELECT 1 FROM clinicians WHERE id = ?", id)) continue;
      const p = JSON.parse(fs.readFileSync(path.join(cdir, file), "utf8"));
      run("INSERT INTO clinicians (id, name, role, profession_id, profile) VALUES (?,?,?,?,?)", id, p.clinician_overview?.full_title || p.clinician_overview?.name || id, p.clinician_overview?.role || "", p.profession_id || null, JSON.stringify(p));
    }
  }
  const demo = [
    { email: "faculty@rounds.demo", name: "Dr. Dana Faculty", role: "faculty", profession: "medicine" },
    { email: "student@rounds.demo", name: "Sam Student", role: "student", profession: "medicine" },
    { email: "dietetics@rounds.demo", name: "Riley Dietetics", role: "student", profession: "dietetics" },
    { email: "nursing@rounds.demo", name: "Noor Nursing", role: "student", profession: "nursing" },
  ];
  for (const d of demo) {
    if (get("SELECT 1 FROM users WHERE email = ?", d.email)) continue;
    run("INSERT INTO users (id, email, password_hash, name, role, profession_id) VALUES (?,?,?,?,?,?)", newId("u_"), d.email, bcrypt.hashSync(DEMO_PASSWORD, 10), d.name, d.role, d.profession);
  }
  return added;
}
