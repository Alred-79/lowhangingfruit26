"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AlertCircle, BookOpen, Check, CheckCircle2, CircleDashed, ClipboardList, Clapperboard, Eye, FileText, FlaskConical, GitCompareArrows, KeyRound, Layers, LayoutDashboard, ListChecks, Loader2, MoreHorizontal, OctagonAlert, Radio, Send, ShieldCheck, Shuffle, Sparkles, Stethoscope, Target, TriangleAlert, Undo2, UserRound } from "lucide-react";
import { HoldButton } from "@/components/game/controls";
import TrustLabel from "@/components/TrustLabel";
import { Button, cx } from "@/components/ui";
import type { CaseProfile } from "@/lib/types";
import { openHigh, type ConsistencyResult, type Issue } from "@/lib/studio/checks";
import { applyPatch, type PatchOp } from "@/lib/studio/patch";
import { SECTIONS, type SectionId } from "@/lib/studio/profile";
import type { CaseMeta } from "@/lib/studio/store";
import { StatusBadges } from "./CaseLibrary";
import ConsistencyPanel from "./ConsistencyPanel";
import { api, Dialog, Notice, startTestVisit } from "./fields";
import GuidePanel from "./GuidePanel";
import StudentPreview from "./StudentPreview";
import { ActionsSection } from "./sections/Actions";
import { ArtifactsSection } from "./sections/Artifacts";
import { AnswerSection, ChartSection, MismatchesSection, ObjectivesSection, OverviewSection, PatientSection, ScenarioSection } from "./sections/Basics";
import { FactsSection } from "./sections/Facts";
import { KnowledgeSection } from "./sections/Knowledge";
import { RubricSection, type RubricOption } from "./sections/Rubric";
import { VariantsSection } from "./sections/Variants";
import { TierBar, tierCounts } from "./TierLadder";
import "./studio.css";

const vv = (o: Record<string, string | number>) => o as CSSProperties;
const SECTION_ICON: Record<SectionId, typeof Eye> = {
  overview: LayoutDashboard,
  patient: UserRound,
  scenario: Clapperboard,
  chart: ClipboardList,
  facts: Layers,
  actions: Stethoscope,
  artifacts: FileText,
  objectives: Target,
  answer: KeyRound,
  mismatches: GitCompareArrows,
  knowledge: BookOpen,
  rubric: ListChecks,
  variants: Shuffle,
  consistency: ShieldCheck,
  preview: Eye,
};
/** The sections a reviewer should read before publishing (the intro's "sensible order"). */
const REVIEW_SECTIONS: SectionId[] = ["facts", "artifacts", "answer", "preview"];

/** One line of the publish checklist: state as icon + words, never color alone. */
function CheckRow({ state, title, children, i = 0 }: { state: "ok" | "warn" | "bad" | "info"; title: ReactNode; children?: ReactNode; i?: number }) {
  const look = {
    ok: { Icon: CheckCircle2, tile: "bg-[var(--color-xp)] text-ink", word: "Done" },
    warn: { Icon: TriangleAlert, tile: "bg-amber-400 text-amber-950", word: "Check" },
    bad: { Icon: OctagonAlert, tile: "bg-rose-600 text-white", word: "Blocking" },
    info: { Icon: CircleDashed, tile: "bg-slate-200 text-ink-2", word: "Optional" },
  }[state];
  return (
    <li className="rise flex items-start gap-3 rounded-2xl bg-surface p-3 ring-1 ring-inset ring-line" style={vv({ "--i": i })}>
      <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-xl", look.tile)}>
        <look.Icon className="h-4.5 w-4.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-ink-2">
        <p className="font-bold text-ink">
          {title} <span className="sr-only">({look.word})</span>
        </p>
        {children}
      </div>
    </li>
  );
}

type SaveState = "saved" | "dirty" | "saving" | "error";
interface Gate {
  high: Issue[];
  checked: boolean;
  clinicalReviewRan: boolean;
  stale: boolean;
  reviewed: boolean;
  origin: string;
}
type Role = { id: string; name: string; roleTitle: string };

const AUTOSAVE_MS = 1200;

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" className="press block min-h-10 w-full rounded-xl px-3 py-2 text-left text-[13.5px] font-semibold text-ink-2 hover:bg-brand-50 hover:text-ink pointer-coarse:min-h-11" onClick={onClick}>
      {label}
    </button>
  );
}

export default function CaseEditor({
  meta: initialMeta,
  initialProfile,
  initialConsistency,
  initialHash,
  rubrics: initialRubrics,
  roles,
  created,
}: {
  meta: CaseMeta;
  initialProfile: CaseProfile;
  initialConsistency: ConsistencyResult | null;
  initialHash: string;
  rubrics: RubricOption[];
  roles: Role[];
  created: boolean;
}) {
  const router = useRouter();
  const id = initialMeta.id;
  const [meta, setMeta] = useState(initialMeta);
  const [profile, setProfileState] = useState(initialProfile);
  const [cons, setConsState] = useState(initialConsistency);
  const [savedHash, setSavedHash] = useState(initialHash);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const [section, setSection] = useState<SectionId>("overview");
  const [guideOpen, setGuideOpen] = useState(false);
  const [rubrics, setRubrics] = useState(initialRubrics);
  const [check, setCheck] = useState<{ running: boolean; seconds: number; error: string | null }>({ running: false, seconds: 0, error: null });
  const [gate, setGate] = useState<Gate | null>(null);
  const [gateAck, setGateAck] = useState(false);
  const [gateReviewed, setGateReviewed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: "green" | "red" | "amber"; text: string } | null>(null);
  const [menu, setMenu] = useState(false);
  const [undo, setUndo] = useState<{ profile: CaseProfile; cons: ConsistencyResult | null; label: string; covered: boolean }[]>([]);
  /**
   * True while the consistency check still covers the patient: nothing has changed since it ran except
   * the check's own suggested fixes. Applying one of those must not make the check read as out of date.
   */
  const [covered, setCoveredState] = useState(!!initialConsistency && initialConsistency.profileHash === initialHash);
  const coveredRef = useRef(covered);
  const setCovered = useCallback((v: boolean) => {
    coveredRef.current = v;
    setCoveredState(v);
  }, []);
  /** Edit counter right after the most recent accepted change (or undo), to tell whether hand edits followed it. */
  const undoMark = useRef(0);
  const [showIntro, setShowIntro] = useState(created);

  // The refs hold the truth for saving; state mirrors them for rendering.
  const profileRef = useRef(profile);
  const consRef = useRef(cons);
  const consDirty = useRef(false);
  const version = useRef(0);
  const savedVersion = useRef(0);
  const inflight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef<() => Promise<boolean>>(async () => true);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveRef.current(), AUTOSAVE_MS);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    if (inflight.current) await inflight.current;
    if (savedVersion.current === version.current) return true;
    const v = version.current;
    const sendCons = consDirty.current;
    const covers = sendCons && coveredRef.current && !!consRef.current;
    setSaveState("saving");
    const run = (async () => {
      try {
        const r = await api<{ hash: string; updatedAt: string }>(`/api/cases/${id}`, { method: "PUT", json: { profile: profileRef.current, ...(sendCons ? { consistency: consRef.current, consistencyCovers: covers } : {}) } });
        savedVersion.current = v;
        // The server stamped the stored check with the new hash; mirror that here without marking anything dirty.
        if (covers && consRef.current && consRef.current.profileHash !== r.hash) {
          consRef.current = { ...consRef.current, profileHash: r.hash };
          setConsState(consRef.current);
        }
        if (sendCons && version.current === v) consDirty.current = false;
        setSavedHash(r.hash);
        setSaveError("");
        if (version.current === v) setSaveState("saved");
        else {
          setSaveState("dirty");
          schedule();
        }
        return true;
      } catch (e) {
        setSaveError((e as Error).message);
        setSaveState("error");
        return false;
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = run;
    return run;
  }, [id, schedule]);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const touch = useCallback(() => {
    version.current++;
    setSaveState("dirty");
    schedule();
  }, [schedule]);

  const set = useCallback(
    (fn: (p: CaseProfile) => CaseProfile) => {
      const next = fn(profileRef.current);
      if (next === profileRef.current) return;
      profileRef.current = next;
      setProfileState(next);
      // Any edit puts the patient ahead of the last check. applyFix and undo restore the flag afterwards.
      setCovered(false);
      touch();
    },
    [touch, setCovered],
  );
  const setCons = useCallback(
    (next: ConsistencyResult | null) => {
      consRef.current = next;
      consDirty.current = true;
      setConsState(next);
      touch();
    },
    [touch],
  );
  const profileNow = useCallback(() => profileRef.current, []);
  const [visited, setVisited] = useState<SectionId[]>(["overview"]);
  const go = useCallback((s: SectionId) => {
    setSection(s);
    setVisited((v) => (v.includes(s) ? v : [...v, s]));
    window.scrollTo({ top: 0 });
  }, []);

  // The guide is a column on very wide screens and starts open there. Up to 1535px (which includes a 1280x720
  // projector laptop) there is no room for it beside the facts table, so it is a drawer and starts closed.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1536px)");
    const t = requestAnimationFrame(() => wide.matches && setGuideOpen(true));
    return () => cancelAnimationFrame(t);
  }, []);
  // Warn on a hard unload with unsaved edits; flush on in-app navigation.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (savedVersion.current !== version.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      void saveRef.current();
    };
  }, []);
  useEffect(() => {
    if (!check.running) return;
    const t0 = Date.now();
    const t = setInterval(() => setCheck((c) => ({ ...c, seconds: Math.round((Date.now() - t0) / 1000) })), 1000);
    return () => clearInterval(t);
  }, [check.running]);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(t);
  }, [flash]);

  const stale = !!cons && !covered && (cons.profileHash !== savedHash || saveState !== "saved");
  const highOpen = openHigh(cons).length;
  const issuesOpen = (cons?.issues || []).filter((i) => i.status === "open").length;

  function pushUndo(label: string) {
    // Capture now: the updater below runs later, after the refs have moved on.
    const snapshot = { profile: profileRef.current, cons: consRef.current, label, covered: coveredRef.current };
    setUndo((u) => [...u.slice(-9), snapshot]);
  }
  function undoLast() {
    const last = undo[undo.length - 1];
    if (!last) return;
    if (version.current > undoMark.current && !window.confirm("You have edited the patient since that change. Undoing restores the patient to how it was before the change, so those later edits are lost too. Continue?")) return;
    setUndo((u) => u.slice(0, -1));
    consRef.current = last.cons;
    consDirty.current = true;
    setConsState(last.cons);
    set(() => last.profile);
    // Back to a state the check covered (for example undoing one of its own fixes): it is current again.
    setCovered(last.covered);
    undoMark.current = version.current;
    setFlash({ tone: "green", text: `Undone: ${last.label}` });
  }

  /** Applies edits the faculty member has just accepted. */
  function acceptOps(ops: PatchOp[], label: string): { applied: number; errors: string[] } {
    const r = applyPatch(profileRef.current, ops);
    if (r.applied) {
      pushUndo(label);
      set(() => r.profile);
      undoMark.current = version.current;
    }
    return { applied: r.applied, errors: r.errors.map((e) => `${e.op.path}: ${e.message}`) };
  }
  function applyFix(issue: Issue): string | null {
    if (!issue.fix) return null;
    const r = applyPatch(profileRef.current, issue.fix.ops);
    if (!r.applied) return "This fix no longer fits the patient as it is now. Edit the section by hand, or run the check again.";
    pushUndo(`fix for "${issue.title}"`);
    const wasCovered = coveredRef.current;
    set(() => r.profile);
    // A fix the check itself proposed does not make the check out of date; the finding is marked resolved instead.
    setCovered(wasCovered);
    if (consRef.current) setCons({ ...consRef.current, issues: consRef.current.issues.map((i) => (i.id === issue.id ? { ...i, status: "fixed" } : i)) });
    undoMark.current = version.current;
    return r.errors.length ? `${r.applied} of ${issue.fix.ops.length} edits were applied; the rest no longer fit. Review ${issue.where}.` : null;
  }
  const setIssueStatus = (issueId: string, status: Issue["status"]) => consRef.current && setCons({ ...consRef.current, issues: consRef.current.issues.map((i) => (i.id === issueId ? { ...i, status } : i)) });

  async function runCheck() {
    go("consistency");
    setCheck({ running: true, seconds: 0, error: null });
    try {
      if (!(await save())) throw new Error("The patient could not be saved, so it was not checked. " + saveError);
      const checkedVersion = version.current;
      const r = await api<{ consistency: ConsistencyResult }>(`/api/cases/${id}/check`, { json: {} });
      consRef.current = r.consistency;
      setConsState(r.consistency);
      // Edits made while the check was running are not covered by it.
      setCovered(version.current === checkedVersion);
      setCheck({ running: false, seconds: 0, error: null });
    } catch (e) {
      setCheck({ running: false, seconds: 0, error: (e as Error).message });
    }
  }

  async function doing(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setMenu(false);
    try {
      await fn();
    } catch (e) {
      setFlash({ tone: "red", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }
  const mustSave = async () => {
    if (!(await save())) throw new Error("Your latest edits could not be saved. Fix that first.");
  };
  const status = (action: string, extra: Record<string, unknown> = {}) => api<{ meta: CaseMeta; gate?: Gate }>(`/api/cases/${id}/status`, { json: { action, ...extra } });

  const testVisit = () =>
    doing("test", async () => {
      await mustSave();
      router.push(await startTestVisit(id));
    });
  const openPublish = () =>
    doing("publish", async () => {
      await mustSave();
      const r = await status("publish", { dryRun: true });
      setGateAck(false);
      setGateReviewed(false);
      setGate(r.gate!);
    });
  const confirmPublish = () =>
    doing("publish", async () => {
      await mustSave();
      const r = await status("publish", { force: gateAck, markReviewed: gateReviewed });
      setMeta(r.meta);
      setGate(null);
      setFlash({ tone: "green", text: "Published. Students can now start this visit. Edits you save from here on apply to new visits." });
    });
  const simple = (action: string, done: string) =>
    doing(action, async () => {
      const r = await status(action);
      setMeta(r.meta);
      setFlash({ tone: "green", text: done });
    });

  const toggleReviewed = () => (meta.reviewed ? simple("unreview", "Marked as not reviewed.") : simple("review", "Marked as faculty-reviewed."));
  const duplicate = () =>
    doing("dup", async () => {
      await mustSave();
      const r = await api<{ id: string }>(`/api/cases/${id}/duplicate`, { json: {} });
      router.push(`/faculty/cases/${r.id}`);
    });
  const exportJson = () =>
    doing("export", async () => {
      await mustSave();
      const a = document.createElement("a");
      a.href = `/api/cases/${id}/export`;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  const toggleArchive = () => {
    if (meta.status === "archived") return simple("restore", "Restored as a draft.");
    if (window.confirm(meta.status === "published" ? "This patient is published. Archiving removes it from students' lists. Archive it?" : "Archive this patient? You can restore it from the library.")) return simple("archive", "Archived.");
    setMenu(false);
  };

  const counts: Partial<Record<SectionId, number>> = {
    facts: profile.facts.length,
    actions: profile.actions.length,
    artifacts: profile.artifacts.length,
    objectives: profile.objectives.length,
    mismatches: profile.mismatches?.length || 0,
    knowledge: profile.knowledge.length,
    variants: profile.variants?.length || 0,
  };
  const sp = { p: profile, set, go };
  const roleTitle = roles.find((r) => r.id === profile.professions[0])?.roleTitle || "clinician";
  const tiers = tierCounts(profile.facts);
  // Publish readiness, from what the editor already knows (the publish dialog re-checks on the server).
  const ready = [
    { ok: !!cons && !stale, label: "Checked and current" },
    { ok: !!cons && highOpen === 0, label: "No open high-severity issues" },
    { ok: meta.origin !== "ai_draft" || meta.reviewed, label: "Faculty-reviewed" },
  ];
  const readyN = ready.filter((r) => r.ok).length;
  const navBtn = (sid: SectionId, label: string, right?: ReactNode, extra?: ReactNode) => {
    const Icon = SECTION_ICON[sid];
    const on = section === sid;
    return (
      <button
        key={sid}
        type="button"
        onClick={() => go(sid)}
        aria-current={on ? "page" : undefined}
        className={cx("press group flex min-h-10 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[13.5px] transition-colors pointer-coarse:min-h-11", on ? "bg-ink font-bold text-white shadow-e2" : "text-ink-2 hover:bg-brand-50 hover:text-ink")}
      >
        <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors", on ? "bg-white/15 text-[var(--color-xp)]" : "bg-surface-2 text-ink-3 group-hover:bg-brand-100 group-hover:text-brand-700")}>
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        {/* Labels wrap rather than truncate: "Consistency check" beside "out of date" must stay readable. */}
        <span className="min-w-0 flex-1 leading-snug">
          {label}
          {extra}
        </span>
        {right !== undefined && <span className={cx("shrink-0 whitespace-nowrap rounded-full px-1.5 font-mono text-[11.5px] tabular-nums", on ? "bg-white/15 text-white" : "bg-surface-2 text-ink-3")}>{right}</span>}
      </button>
    );
  };
  const consRight = check.running ? (
    <span className="inline-flex items-center gap-1">
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      running
    </span>
  ) : !cons ? (
    "not run"
  ) : highOpen ? (
    <span className={cx("inline-flex items-center gap-1", section === "consistency" ? "" : "font-semibold text-rose-700")}>
      <OctagonAlert className="h-3 w-3" aria-hidden />
      {highOpen} high
    </span>
  ) : stale ? (
    "out of date"
  ) : issuesOpen ? (
    `${issuesOpen} open`
  ) : (
    <span className="inline-flex items-center gap-1">
      <Check className="h-3 w-3" aria-hidden />
      clear
    </span>
  );
  const statusRing = meta.status === "published" ? "ring-[var(--color-xp)]" : meta.status === "archived" ? "ring-slate-300" : "ring-brand-400";

  return (
    <div>
      {/* Top bar */}
      <div className="sticky top-0 z-30 -mx-4 -mt-5 mb-5 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <div className="flex min-w-0 flex-1 basis-80 items-center gap-3">
            {profile.patient.portrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.patient.portrait} alt="" className={cx("h-14 w-14 shrink-0 rounded-[18px] object-cover object-[50%_25%] shadow-e2 ring-[3px]", statusRing)} />
            ) : (
              <span className={cx("grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-stage font-display text-lg font-black text-white/85 shadow-e2 ring-[3px]", statusRing)}>{(profile.patient.name || "?").slice(0, 2).toUpperCase()}</span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Link href="/faculty/cases" className="font-semibold text-ink-3 hover:text-ink">
                  Patient Studio
                </Link>
                <span className="text-slate-300" aria-hidden>
                  /
                </span>
                <StatusBadges c={meta} />
                <span
                  role="status"
                  className={cx(
                    "ml-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                    saveState === "saved" && "text-ink-3",
                    saveState === "dirty" && "bg-amber-50 text-amber-800",
                    saveState === "saving" && "bg-brand-50 text-brand-800",
                    saveState === "error" && "bg-rose-50 text-rose-800",
                  )}
                >
                  {saveState === "saved" && <Check className="h-3 w-3 text-[var(--color-xp-ink)]" aria-hidden />}
                  {saveState === "dirty" && <span className="breathe h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />}
                  {saveState === "saving" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                  {saveState === "error" && <AlertCircle className="h-3 w-3" aria-hidden />}
                  {saveState === "saved" && "All changes saved"}
                  {saveState === "dirty" && "Unsaved changes"}
                  {saveState === "saving" && "Saving..."}
                  {saveState === "error" && `Not saved: ${saveError}`}
                </span>
                {(saveState === "dirty" || saveState === "error") && (
                  <button type="button" className="font-semibold text-brand-700 underline" onClick={() => void save()}>
                    {saveState === "error" ? "Retry" : "Save now"}
                  </button>
                )}
              </div>
              {/* The patient's name comes first and never truncates; the faculty title follows and may take a second line. */}
              <h1 className="mt-0.5 leading-snug text-ink" title={profile.title || undefined}>
                <span className="whitespace-nowrap font-display text-[22px] font-black tracking-[-0.025em]">
                  {profile.patient.name || "Unnamed patient"}, {profile.patient.age}
                </span>
                <span className="line-clamp-1 text-[13.5px] font-medium text-ink-2">{profile.title || "Untitled patient"}</span>
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {undo.length > 0 && (
              <Button variant="ghost" size="sm" onClick={undoLast} title={`Undo: ${undo[undo.length - 1].label}`}>
                <Undo2 className="h-3.5 w-3.5" aria-hidden />
                Undo last accepted change
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={runCheck} disabled={check.running}>
              {check.running ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
              {check.running ? `Checking... ${check.seconds}s` : "Check consistency"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => go("preview")}>
              <Eye className="h-3.5 w-3.5" aria-hidden />
              Student preview
            </Button>
            <Button variant="subtle" size="sm" onClick={testVisit} disabled={busy === "test" || meta.status === "archived"} title="Saves, then starts a visit with this patient as a student would see it. Works for drafts.">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden />
              {busy === "test" ? "Starting..." : "Test visit"}
            </Button>
            {meta.status === "published" ? (
              <span className="inline-flex items-center gap-1 rounded-xl bg-[var(--color-xp-soft)] p-1 ring-1 ring-inset ring-[var(--color-xp)]">
                <span className="inline-flex items-center gap-1.5 px-2 text-[12.5px] font-bold text-[var(--color-xp-ink)]">
                  <Radio className="breathe h-3.5 w-3.5" aria-hidden />
                  Live for students
                </span>
                <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => simple("unpublish", "Unpublished. The patient is a draft again and students can no longer start it.")}>
                  Unpublish
                </Button>
              </span>
            ) : (
              // Compound: publish + readiness pips (checked and current, no high issues, reviewed).
              <span className="inline-flex items-center gap-1 rounded-[14px] bg-brand-50 p-1 ring-1 ring-inset ring-brand-200">
                <span className="flex items-center gap-1 px-1.5" role="img" aria-label={`Publish readiness ${readyN} of 3: ${ready.map((r) => `${r.label} ${r.ok ? "yes" : "no"}`).join(", ")}`} title={ready.map((r) => `${r.ok ? "✓" : "○"} ${r.label}`).join("\n")}>
                  {ready.map((r, i) => (
                    <span key={i} className={cx("h-2.5 w-2.5 rounded-full transition-colors", r.ok ? "bg-[var(--color-xp)] ring-1 ring-[var(--color-xp-ink)]" : "bg-white ring-1 ring-brand-300")} />
                  ))}
                  <span className="ml-0.5 font-mono text-[11.5px] font-bold text-brand-800">{readyN}/3</span>
                </span>
                <Button size="sm" disabled={!!busy || meta.status === "archived"} onClick={openPublish}>
                  {busy === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
                  {busy === "publish" ? "Checking..." : "Publish"}
                </Button>
              </span>
            )}
            <div className="relative">
              <Button variant="ghost" size="sm" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-haspopup="menu">
                <MoreHorizontal className="h-4 w-4" aria-hidden />
                More
              </Button>
              {menu && (
                <div role="menu" className="pop-in absolute right-0 z-40 mt-1 w-64 origin-top-right rounded-2xl border border-line bg-surface p-1.5 shadow-e3">
                  <MenuItem label={meta.reviewed ? "Remove the faculty-reviewed mark" : "Mark as faculty-reviewed"} onClick={toggleReviewed} />
                  <MenuItem label="Duplicate" onClick={duplicate} />
                  <MenuItem label="Export JSON" onClick={exportJson} />
                  <MenuItem label={meta.status === "archived" ? "Restore from archive" : "Archive"} onClick={toggleArchive} />
                </div>
              )}
            </div>
            <Button variant={guideOpen ? "ghost" : "secondary"} size="sm" onClick={() => setGuideOpen(!guideOpen)}>
              <Sparkles className="h-3.5 w-3.5 text-brand-600" aria-hidden />
              {guideOpen ? "Hide guide" : "Ask the guide"}
            </Button>
          </div>
        </div>
      </div>

      {flash && (
        <Notice tone={flash.tone} className="pop-in mb-3">
          {flash.text}
        </Notice>
      )}
      {showIntro && (
        <section className="rise relative mb-4 overflow-hidden rounded-[24px] bg-brand-600 p-5 text-white clay" aria-labelledby="intro-title">
          <span className="spin-slow pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full [background:conic-gradient(from_0deg,transparent,rgb(255_255_255/0.16),transparent_40%)]" aria-hidden />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p id="intro-title" className="font-display text-[22px] font-black tracking-[-0.02em]">
                The guide has drafted this patient. It is yours to correct.
              </p>
              <p className="mt-1 max-w-3xl text-[14px] leading-relaxed text-white/85">
                It stays labelled &ldquo;AI-drafted, not faculty-reviewed&rdquo; until you mark it reviewed. Type a request to the guide on the right for any change you would rather describe than make by hand.
              </p>
              <p className="mt-3 text-[12.5px] font-bold text-white/80">A sensible order:</p>
              <ol className="mt-1.5 flex flex-wrap gap-2">
                {(
                  [
                    ["Read Facts", "facts"],
                    ["Read Documents", "artifacts"],
                    ["Run the consistency check", "consistency"],
                    ["Try a test visit", null],
                    ["Publish", null],
                  ] as [string, SectionId | null][]
                ).map(([label, sid], i) => (
                  <li key={label}>
                    {sid ? (
                      <button type="button" onClick={() => (sid === "consistency" ? void runCheck() : go(sid))} className="press inline-flex min-h-9 items-center gap-2 rounded-full bg-white/15 py-1 pl-1 pr-3 text-[13px] font-bold ring-1 ring-white/25 hover:bg-white/25 pointer-coarse:min-h-11">
                        <span className={cx("grid h-6 w-6 place-items-center rounded-full text-[12px] font-black", visited.includes(sid) ? "bg-[var(--color-xp)] text-ink" : "bg-white text-brand-700")}>{visited.includes(sid) ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}</span>
                        {label}
                      </button>
                    ) : (
                      <span className="inline-flex min-h-9 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13px] font-bold text-white/85 ring-1 ring-white/20">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-white/20 text-[12px] font-black">{i + 1}</span>
                        {label}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
            <button type="button" className="press shrink-0 rounded-lg px-2 py-1 text-xs font-semibold underline hover:bg-white/10" onClick={() => setShowIntro(false)}>
              Dismiss
            </button>
          </div>
        </section>
      )}

      <div className={cx("grid items-start gap-4", guideOpen ? "lg:grid-cols-[16rem_minmax(0,1fr)] 2xl:grid-cols-[16rem_minmax(0,1fr)_22rem]" : "lg:grid-cols-[16rem_minmax(0,1fr)]")}>
        {/* Section navigation */}
        <nav aria-label="Sections" className="scroll-quiet rounded-[22px] border border-line/80 bg-surface p-2 shadow-e1 lg:sticky lg:top-[6.75rem] lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto">
          <p className="px-2 pb-1.5 pt-1 font-display text-[13px] font-extrabold text-ink-2">Patient profile</p>
          {SECTIONS.map((s) =>
            navBtn(
              s.id,
              s.label,
              counts[s.id],
              s.id === "facts" && profile.facts.length > 0 ? <TierBar counts={tiers} height={5} className="mt-1" /> : undefined,
            ),
          )}
          <p className="mt-2 border-t border-line px-2 pb-1.5 pt-2.5 font-display text-[13px] font-extrabold text-ink-2">Before publishing</p>
          {navBtn("consistency", "Consistency check", consRight)}
          {navBtn("preview", "Student preview")}
        </nav>

        {/* Section editor */}
        <div className="min-w-0">
          {section === "overview" && (
            // At a glance: each tile is the number and the way into its section.
            <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-12">
              <button type="button" onClick={() => go("facts")} className="press lift rise col-span-2 rounded-[22px] bg-surface p-4 text-left shadow-e1 ring-1 ring-line xl:col-span-5" style={vv({ "--i": 0 })}>
                <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink-2">
                  <Layers className="h-4 w-4 text-brand-600" aria-hidden />
                  Facts by disclosure tier
                </span>
                <span className="mt-1 block font-display text-[40px] font-black leading-none tracking-[-0.04em] text-ink">{profile.facts.length}</span>
                <TierBar counts={tiers} legend height={12} className="mt-3" />
              </button>
              <button type="button" onClick={() => go("actions")} className="press rise flex flex-col rounded-[22px] bg-brand-600 p-4 text-left text-white clay xl:col-span-2" style={vv({ "--i": 1 })}>
                <Stethoscope className="h-5 w-5" aria-hidden />
                <span className="mt-auto pt-3 font-display text-[40px] font-black leading-none tracking-[-0.04em]">{profile.actions.length}</span>
                <span className="mt-1 text-[12.5px] font-bold text-white/85">exams and orders</span>
              </button>
              <button type="button" onClick={() => go("artifacts")} className="press rise flex flex-col rounded-[22px] bg-[var(--color-mastery)] p-4 text-left text-white clay xl:col-span-2" style={vv({ "--i": 2 })}>
                <FileText className="h-5 w-5" aria-hidden />
                <span className="mt-auto pt-3 font-display text-[40px] font-black leading-none tracking-[-0.04em]">{profile.artifacts.length}</span>
                <span className="mt-1 text-[12.5px] font-bold text-white/85">documents · {profile.artifacts.filter((d) => d.release.when === "start").length} at start</span>
              </button>
              <button
                type="button"
                onClick={() => go("consistency")}
                className={cx("press lift rise col-span-2 flex flex-col rounded-[22px] p-4 text-left ring-1 xl:col-span-3", highOpen ? "bg-rose-50 text-rose-950 ring-rose-200" : cons && !stale ? "bg-[var(--color-xp-soft)] text-ink ring-[var(--color-xp)]" : "bg-surface text-ink ring-line")}
                style={vv({ "--i": 3 })}
              >
                <span className="flex items-center gap-1.5 text-[12.5px] font-bold">
                  {highOpen ? <OctagonAlert className="breathe h-4 w-4 text-rose-600" aria-hidden /> : <ShieldCheck className="h-4 w-4" aria-hidden />}
                  Consistency check
                </span>
                <span className="mt-auto pt-3 font-display text-[26px] font-black leading-tight tracking-[-0.03em]">{!cons ? "Not run yet" : highOpen ? `${highOpen} high open` : stale ? "Out of date" : issuesOpen ? `${issuesOpen} open` : "Clear"}</span>
                <span className="mt-1 text-[12.5px] font-semibold opacity-80">Publish readiness {readyN} of 3</span>
              </button>
            </div>
          )}
          {section === "overview" && <OverviewSection {...sp} roles={roles} />}
          {section === "patient" && <PatientSection {...sp} />}
          {section === "scenario" && <ScenarioSection {...sp} />}
          {section === "chart" && <ChartSection {...sp} />}
          {section === "facts" && <FactsSection {...sp} />}
          {section === "actions" && <ActionsSection {...sp} />}
          {section === "artifacts" && <ArtifactsSection {...sp} />}
          {section === "objectives" && <ObjectivesSection {...sp} />}
          {section === "answer" && <AnswerSection {...sp} />}
          {section === "mismatches" && <MismatchesSection {...sp} />}
          {section === "knowledge" && <KnowledgeSection {...sp} />}
          {section === "rubric" && <RubricSection {...sp} rubrics={rubrics} setRubrics={setRubrics} />}
          {section === "variants" && <VariantsSection {...sp} profileNow={profileNow} caseId={id} />}
          {section === "consistency" && <ConsistencyPanel p={profile} result={cons} stale={stale} running={check.running} seconds={check.seconds} error={check.error} onRun={runCheck} onApply={applyFix} onStatus={setIssueStatus} go={go} />}
          {section === "preview" && <StudentPreview p={profile} roleTitle={roleTitle} />}
        </div>

        {/* Guide: a column from 1536px up, a drawer otherwise */}
        {guideOpen && (
          <div className="fixed inset-y-0 right-0 z-40 w-[25rem] max-w-[92vw] p-2 2xl:sticky 2xl:inset-auto 2xl:top-[6.75rem] 2xl:z-auto 2xl:h-[calc(100vh-7.75rem)] 2xl:w-auto 2xl:max-w-none 2xl:p-0">
            <GuidePanel caseId={id} profileNow={profileNow} onAccept={acceptOps} onClose={() => setGuideOpen(false)} />
          </div>
        )}
      </div>

      {gate && (
        <Dialog
          title="Publish this patient"
          wide
          onClose={() => setGate(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setGate(null)}>
                Cancel
              </Button>
              {(!gate.checked || gate.stale || gate.high.length > 0) && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setGate(null);
                    void runCheck();
                  }}
                >
                  {gate.high.length ? "Review the issues" : "Run the check first"}
                </Button>
              )}
              {/* Hold to publish: a deliberate press (Space or Enter held works too). */}
              <HoldButton
                label={gate.high.length ? "Hold to publish anyway" : "Hold to publish"}
                holdingLabel="Keep holding to publish"
                doneLabel="Publishing..."
                tone={gate.high.length ? "rose" : "brand"}
                icon={<Send className="h-4 w-4" aria-hidden />}
                ms={1400}
                disabled={busy === "publish" || (gate.high.length > 0 && !gateAck)}
                onConfirm={confirmPublish}
              />
            </>
          }
        >
          <div className="space-y-4 text-sm text-ink-2">
            {/* Who sees it, and with which label: a live preview of the outcome. */}
            <div className="flex flex-wrap items-center gap-4 rounded-[20px] bg-stage p-4 text-white">
              {profile.patient.portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.patient.portrait} alt="" className="h-16 w-16 rounded-[18px] object-cover object-[50%_25%] ring-[3px] ring-white/80" />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-[18px] bg-white/10 font-display text-xl font-black">{(profile.patient.name || "?").slice(0, 2).toUpperCase()}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[14px] leading-relaxed text-white/85">
                  Publishing makes <span className="font-display text-[17px] font-black text-white">{profile.patient.name}</span> available to students in: {profile.professions.map((r) => roles.find((x) => x.id === r)?.name || r).join(", ") || "no role selected"}.
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-white/75">
                  Students will see it labelled
                  {gate.origin === "ai_draft" ? <TrustLabel key={String(gateReviewed || gate.reviewed)} kind={gateReviewed || gate.reviewed ? "ai-reviewed" : "ai-draft"} className="pop-spring" /> : gate.origin === "sample" ? <TrustLabel kind="sample" /> : <span className="text-white">without an AI label (faculty-written)</span>}
                </p>
              </div>
              <div className="w-full sm:w-56">
                <TierBar counts={tiers} legend dark height={10} />
              </div>
            </div>

            <div>
              <p className="mb-2 font-display text-[16px] font-extrabold text-ink">Review checklist</p>
              <ul className="space-y-2">
                <CheckRow i={0} state={gate.checked ? (gate.stale ? "warn" : "ok") : "warn"} title={!gate.checked ? "Consistency check not run" : gate.stale ? "Consistency check is out of date" : "Consistency check covers your latest edits"}>
                  {!gate.checked && <p>The consistency check has not been run on this patient. Structure was checked just now and is fine{gate.high.length ? " apart from the issues below" : ""}, but nothing has reviewed the clinical content for contradictions.</p>}
                  {gate.checked && gate.stale && <p>The patient has been edited since the last consistency check, so the clinical review does not cover your latest changes.</p>}
                </CheckRow>
                <CheckRow i={1} state={gate.checked && !gate.stale ? (gate.clinicalReviewRan ? "ok" : "warn") : "info"} title={gate.checked && !gate.stale && !gate.clinicalReviewRan ? "Clinical review did not complete" : "Clinical review"}>
                  {gate.checked && !gate.stale && !gate.clinicalReviewRan && <p>The last check did not complete its clinical review. Only structure has been checked.</p>}
                  {gate.checked && !gate.stale && gate.clinicalReviewRan && gate.high.length === 0 && <p>The consistency check found no open high-severity issues.</p>}
                  {gate.checked && !gate.stale && gate.clinicalReviewRan && gate.high.length > 0 && <p>Completed. Its open high-severity findings are listed below.</p>}
                  {!(gate.checked && !gate.stale) && <p>Runs as part of the consistency check.</p>}
                </CheckRow>
                <CheckRow i={2} state={gate.high.length ? (gateAck ? "warn" : "bad") : "ok"} title={gate.high.length ? `${gate.high.length} high-severity issue${gate.high.length === 1 ? " is" : "s are"} still open:` : "No open high-severity issues"}>
                  {gate.high.length > 0 && (
                    <>
                      <ul className="mt-1 space-y-1">
                        {gate.high.map((i) => (
                          <li key={i.id} className="flex items-start gap-1.5 text-rose-900">
                            <OctagonAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" aria-hidden />
                            <span>
                              {i.title} <span className="text-xs opacity-75">({i.where})</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      <label className="mt-2 flex min-h-9 items-start gap-2 rounded-xl bg-rose-50 px-2.5 py-2 font-semibold text-rose-950 ring-1 ring-inset ring-rose-200">
                        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-rose-600" checked={gateAck} onChange={(e) => setGateAck(e.target.checked)} />
                        <span>I have read these issues and want to publish anyway.</span>
                      </label>
                    </>
                  )}
                </CheckRow>
                <CheckRow i={3} state={REVIEW_SECTIONS.every((s) => visited.includes(s)) ? "ok" : "info"} title={`Sections you opened this session: ${REVIEW_SECTIONS.filter((s) => visited.includes(s)).length} of ${REVIEW_SECTIONS.length} suggested`}>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {REVIEW_SECTIONS.map((sid) => {
                      const seen = visited.includes(sid);
                      const label = sid === "preview" ? "Student preview" : SECTIONS.find((x) => x.id === sid)?.label;
                      const Icon = SECTION_ICON[sid];
                      return (
                        <button
                          key={sid}
                          type="button"
                          onClick={() => {
                            setGate(null);
                            go(sid);
                          }}
                          className={cx("press inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold pointer-coarse:min-h-11", seen ? "bg-[var(--color-xp-soft)] text-[var(--color-xp-ink)] ring-1 ring-inset ring-[var(--color-xp)]" : "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line hover:bg-brand-50")}
                        >
                          {seen ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Icon className="h-3.5 w-3.5" aria-hidden />}
                          {label}
                          <span className="sr-only">{seen ? "(opened)" : "(not opened yet)"}</span>
                        </button>
                      );
                    })}
                  </div>
                </CheckRow>
                {gate.origin === "ai_draft" && !gate.reviewed && (
                  <CheckRow i={4} state={gateReviewed ? "ok" : "warn"} title="Faculty review of the AI draft">
                    <label className="mt-1 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-amber-600" checked={gateReviewed} onChange={(e) => setGateReviewed(e.target.checked)} />
                      <span>
                        I have reviewed the clinical content of this AI-drafted patient. Mark it as faculty-reviewed.
                        <span className="block text-xs opacity-80">If you leave this unticked it is published with the label &ldquo;AI-drafted, not faculty-reviewed&rdquo;.</span>
                      </span>
                    </label>
                  </CheckRow>
                )}
              </ul>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
