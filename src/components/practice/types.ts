export interface PracticeCase {
  id: string;
  /** Student-safe label; the faculty title never reaches this component. */
  label: string;
  specialty: string;
  professions: string[];
  difficulty: number;
  encounterType: string;
  patientFirstName: string;
  age: number | null;
  aiDraft: boolean;
  attempts: number;
  best: number | null;
  lastId: string | null;
  activeId: string | null;
  /** Public portrait image path, when the patient has one. */
  portrait?: string | null;
  /** A sample patient shipped with the app (trust label "Sample"). */
  sample?: boolean;
  /** The case's own time limit in minutes, used only to preview the level's timer honestly. */
  timeLimitMin?: number | null;
}

export const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
