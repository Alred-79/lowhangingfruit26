"use client";

import { useState, type CSSProperties } from "react";
import {
  Bot,
  CheckCircle2,
  Info,
  ListChecks,
  OctagonAlert,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { Badge, Button, cx } from "@/components/ui";
import type { CaseProfile } from "@/lib/types";
import type { ConsistencyResult, Issue } from "@/lib/studio/checks";
import { describeOp, wordingWarnings } from "@/lib/studio/patch";
import { SECTIONS, type SectionId } from "@/lib/studio/profile";
import { Notice, Panel } from "./fields";
import ErrorNote from "@/components/ErrorNote";
import PatchDiff from "./PatchDiff";
import "./studio.css";

const SEV = {
  high: { tone: "red", label: "High" },
  medium: { tone: "amber", label: "Medium" },
  low: { tone: "slate", label: "Low" },
} as const;
// Severity is color + icon + word, never color alone (dataviz: status colors are reserved and labelled).
const SEV_LOOK = {
  high: {
    Icon: OctagonAlert,
    tile: "bg-rose-600 text-white",
    card: "bg-rose-50/70 ring-rose-200",
    word: "text-rose-800",
    cell: "bg-rose-600 text-white",
    soft: "bg-rose-50 text-rose-900 ring-rose-200",
  },
  medium: {
    Icon: TriangleAlert,
    tile: "bg-amber-400 text-amber-950",
    card: "bg-amber-50/60 ring-amber-200",
    word: "text-amber-900",
    cell: "bg-amber-400 text-amber-950",
    soft: "bg-amber-50 text-amber-950 ring-amber-200",
  },
  low: {
    Icon: Info,
    tile: "bg-slate-200 text-ink-2",
    card: "bg-surface ring-line",
    word: "text-ink-2",
    cell: "bg-slate-200 text-ink",
    soft: "bg-surface-2 text-ink-2 ring-line",
  },
} as const;
const RANK = { high: 0, medium: 1, low: 2 } as const;
const vv = (o: Record<string, string | number>) => o as CSSProperties;
const sectionLabel = (id: SectionId) =>
  SECTIONS.find((s) => s.id === id)?.label || "Overview";

function IssueCard({
  issue,
  p,
  onApply,
  onStatus,
  go,
  i = 0,
}: {
  issue: Issue;
  p: CaseProfile;
  onApply: (i: Issue) => string | null;
  onStatus: (id: string, s: Issue["status"]) => void;
  go: (s: SectionId) => void;
  i?: number;
}) {
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = issue.status !== "open";
  // A fix that changes a value in one wording of a fact and not the other would leave the fact disagreeing with itself.
  const warnings =
    issue.fix && !closed ? wordingWarnings(p, issue.fix.ops) : [];
  const look = SEV_LOOK[issue.severity];
  return (
    <li
      className={cx(
        "flex gap-3 rounded-[20px] p-3.5 ring-1 ring-inset",
        closed
          ? "bg-surface-2/70 opacity-80 ring-line"
          : cx(
              look.card,
              issue.severity === "high" ? "studio-sev-high" : "studio-sev-in",
            ),
      )}
      style={vv({ "--i": i })}
    >
      <span
        className={cx(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl clay",
          closed ? "bg-slate-200 text-ink-3" : look.tile,
        )}
      >
        {closed ? (
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        ) : (
          <look.Icon className="h-5 w-5" aria-hidden />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cx("text-[12.5px] font-extrabold", look.word)}>
            {SEV[issue.severity].label} severity
          </span>
          <Badge tone={issue.source === "model" ? "violet" : "blue"}>
            {issue.source === "model" ? (
              <Bot className="h-3 w-3" aria-hidden />
            ) : (
              <ListChecks className="h-3 w-3" aria-hidden />
            )}
            {issue.source === "model"
              ? "Clinical review (AI)"
              : "Structure check"}
          </Badge>
          {issue.status === "fixed" && <Badge tone="green">Fix applied</Badge>}
          {issue.status === "dismissed" && <Badge>Dismissed</Badge>}
          <span className="text-xs text-ink-3">{issue.where}</span>
        </div>
        <p className="mt-1 text-[15px] font-bold leading-snug text-ink">
          {issue.title}
        </p>
        <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-2">
          {issue.why}
        </p>
        {issue.fix && !closed && (
          <div className="mt-2 rounded-2xl bg-surface p-2.5 ring-1 ring-inset ring-line">
            <p className="text-[12.5px] text-ink-2">
              <Wrench
                className="mr-1 inline h-3.5 w-3.5 text-brand-600"
                aria-hidden
              />
              <span className="font-bold text-ink">Proposed fix: </span>
              {issue.fix.summary}{" "}
              <button
                type="button"
                className="text-brand-700 underline"
                onClick={() => setShow(!show)}
              >
                {show ? "Hide" : "Show"} the {issue.fix.ops.length} edit
                {issue.fix.ops.length === 1 ? "" : "s"}
              </button>
            </p>
            {show && (
              <div className="mt-2">
                <PatchDiff
                  views={issue.fix.ops.map((op) => describeOp(p, op))}
                />
              </div>
            )}
            {warnings.map((w) => (
              <Notice key={w} tone="amber" className="mt-2">
                <span className="font-semibold">Check before applying: </span>
                {w}
              </Notice>
            ))}
          </div>
        )}
        {error && (
          <Notice tone="amber" className="mt-2">
            {error}
          </Notice>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {!closed && issue.fix && (
            <Button size="sm" onClick={() => setError(onApply(issue))}>
              <Wrench className="h-3.5 w-3.5" aria-hidden />
              Apply fix
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => go(issue.section)}
          >
            Open {sectionLabel(issue.section)}
          </Button>
          {!closed ? (
            <>
              {!issue.fix && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onStatus(issue.id, "fixed")}
                >
                  Mark as fixed
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                title="Keep the case as it is; this issue will not block publishing"
                onClick={() => onStatus(issue.id, "dismissed")}
              >
                Dismiss
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStatus(issue.id, "open")}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reopen
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

export default function ConsistencyPanel({
  p,
  result,
  stale,
  running,
  seconds,
  error,
  onRun,
  onApply,
  onStatus,
  go,
}: {
  p: CaseProfile;
  result: ConsistencyResult | null;
  stale: boolean;
  running: boolean;
  seconds: number;
  error: string | null;
  onRun: () => void;
  onApply: (i: Issue) => string | null;
  onStatus: (id: string, s: Issue["status"]) => void;
  go: (s: SectionId) => void;
}) {
  // Open findings in severity order (high first); stable within a severity. They animate in in this order.
  const open = (result?.issues || [])
    .filter((i) => i.status === "open")
    .map((x, k) => [x, k] as const)
    .sort((a, b) => RANK[a[0].severity] - RANK[b[0].severity] || a[1] - b[1])
    .map(([x]) => x);
  const closed = (result?.issues || []).filter((i) => i.status !== "open");
  const n = (sev: Issue["severity"]) =>
    open.filter((i) => i.severity === sev).length;
  return (
    <Panel
      title="Consistency check"
      icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
      subtitle="Two passes over the saved patient. Structure checks are rules: broken links, objectives nothing can assess, documents that are never released, no volunteered chief concern, duplicated facts. The clinical review is a model reading the history, medications, vitals, results, documents and answer key against each other for contradictions. Every finding says where it is and why; fixes are proposals you apply one at a time."
      action={
        <Button onClick={onRun} disabled={running}>
          <ScanSearch className="h-4 w-4" aria-hidden />
          {running
            ? `Checking... ${seconds}s`
            : result
              ? "Run again"
              : "Run the check"}
        </Button>
      }
    >
      {running && (
        <div
          className="mb-4 overflow-hidden rounded-[20px] bg-stage p-4 text-white"
          role="status"
        >
          <p className="text-[14px] text-white/85">
            Structure checks are done in under a second. The clinical review
            reads the whole case and usually takes 45 to 90 seconds.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              {
                label: "Structure checks",
                Icon: ListChecks,
                done: seconds >= 1,
              },
              { label: "Clinical review (AI)", Icon: Bot, done: false },
            ].map((l, k) => (
              <div
                key={l.label}
                className={cx(
                  "flex items-center gap-3 rounded-2xl p-3 ring-1 ring-inset",
                  l.done
                    ? "bg-white/10 ring-[var(--color-xp)]/45"
                    : "studio-scan bg-brand-500/20 ring-brand-300/60",
                )}
                style={vv({ "--sd": `${k * 0.6}s` })}
              >
                <span
                  className={cx(
                    "grid h-9 w-9 place-items-center rounded-xl",
                    l.done
                      ? "bg-[var(--color-xp)] text-ink"
                      : "studio-ping bg-brand-500 text-white",
                  )}
                >
                  {l.done ? (
                    <CheckCircle2 className="h-4.5 w-4.5" aria-hidden />
                  ) : (
                    <l.Icon className="h-4.5 w-4.5" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1 text-[13.5px] font-bold">
                  {l.label}
                </span>
                <span className="font-mono text-[12px] text-white/75">
                  {l.done ? "done" : `${seconds}s`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {error && (
        <ErrorNote
          message={error}
          title="The check did not run."
          kept="Nothing in the patient was changed; run it again."
          className="mb-3"
        />
      )}
      {!result && !running && (
        <div className="flex flex-wrap items-center gap-4 rounded-[20px] border-2 border-dashed border-brand-200 bg-brand-50/40 p-5">
          <span className="float-idle grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white clay">
            <ScanSearch className="h-7 w-7" aria-hidden />
          </span>
          <p className="min-w-0 flex-1 basis-64 text-[14px] leading-relaxed text-ink-2">
            This patient has not been checked yet. Run the check before
            publishing: high-severity findings block publishing until you fix
            them, dismiss them or confirm that you want to publish anyway.
          </p>
        </div>
      )}
      {result && (
        <>
          {/* Severity tally: one tile per severity, icon + word + count. */}
          <div className="mb-4 grid grid-cols-3 gap-2">
            {(["high", "medium", "low"] as const).map((sev, k) => {
              const L = SEV_LOOK[sev];
              const count = n(sev);
              return (
                <div
                  key={sev}
                  className={cx(
                    "pop-spring rounded-[18px] p-3 ring-1 ring-inset",
                    count ? L.soft : "bg-surface-2/60 text-ink-3 ring-line",
                  )}
                  style={vv({ "--i": k })}
                >
                  <span className="flex items-center gap-1.5 text-[12.5px] font-bold">
                    <L.Icon
                      className={cx(
                        "h-4 w-4",
                        count > 0 && sev === "high" && "breathe",
                      )}
                      aria-hidden
                    />
                    {SEV[sev].label}
                  </span>
                  <span className="mt-1 block font-display text-[34px] font-black leading-none tracking-[-0.03em]">
                    {count}
                  </span>
                  <span className="text-[12px] font-semibold">open</span>
                </div>
              );
            })}
          </div>
          <p className="mb-3 text-xs text-ink-3">
            open · last run{" "}
            {new Date(result.ranAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
          {stale && !running && (
            <Notice tone="amber" className="mb-3">
              The patient has been edited since this check. Findings below may
              be out of date; run it again before publishing.
            </Notice>
          )}
          {result.modelError && (
            <Notice tone="amber" className="mb-3">
              The clinical review did not complete ({result.modelError}). Only
              the structure checks are shown. Run the check again.
            </Notice>
          )}
          {result.summary && (
            <p className="mb-3 text-[14px] leading-relaxed text-ink-2">
              {result.summary}
            </p>
          )}
          {!open.length && !result.modelError && (
            <Notice tone="green">No open issues.</Notice>
          )}
          <ul className="space-y-2.5" key={result.ranAt}>
            {open.map((i, k) => (
              <IssueCard
                key={i.id}
                i={k}
                issue={i}
                p={p}
                onApply={onApply}
                onStatus={onStatus}
                go={go}
              />
            ))}
          </ul>
          {closed.length > 0 && (
            <details className="mt-4">
              <summary className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[13.5px] font-semibold text-ink-2 hover:bg-brand-50 pointer-coarse:min-h-11">
                <CheckCircle2
                  className="h-4 w-4 text-[var(--color-xp-ink)]"
                  aria-hidden
                />
                {closed.length} resolved or dismissed
              </summary>
              <ul className="mt-2 space-y-2">
                {closed.map((i) => (
                  <IssueCard
                    key={i.id}
                    issue={i}
                    p={p}
                    onApply={onApply}
                    onStatus={onStatus}
                    go={go}
                  />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Panel>
  );
}
