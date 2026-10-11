"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";
import { Archive, ArchiveRestore, ArrowRight, CircleCheck, ClipboardList, Copy, FileText, FlaskConical, Layers, OctagonAlert, PencilLine, Search, Sparkles, Stethoscope } from "lucide-react";
import { FilterChips } from "@/components/game/controls";
import { CountUp } from "@/components/motion";
import TrustLabel from "@/components/TrustLabel";
import { Badge, Button, cx, Empty, Input, LinkButton, Select } from "@/components/ui";
import type { LibraryItem } from "@/lib/studio/store";
import { api, Notice, startTestVisit } from "./fields";
import { TIER_ORDER, TIER_STYLE, TierBar, type TierCounts } from "./TierLadder";
import "./studio.css";

const v = (o: Record<string, string | number>) => o as CSSProperties;

/** Status as icon + word in its color, then the trust label (exact wording, fixed meaning). */
export function StatusBadges({ c }: { c: { status: string; origin: string; reviewed: boolean } }) {
  return (
    <>
      {c.status === "published" && (
        <Badge tone="green">
          <CircleCheck className="h-3 w-3" aria-hidden />
          Published
        </Badge>
      )}
      {c.status === "draft" && (
        <Badge tone="teal">
          <PencilLine className="h-3 w-3" aria-hidden />
          Draft
        </Badge>
      )}
      {c.status === "archived" && (
        <Badge tone="slate">
          <Archive className="h-3 w-3" aria-hidden />
          Archived
        </Badge>
      )}
      {c.origin === "ai_draft" && !c.reviewed && <TrustLabel kind="ai-draft" />}
      {c.origin === "ai_draft" && c.reviewed && <TrustLabel kind="ai-reviewed" />}
      {c.origin === "sample" && <TrustLabel kind="sample" />}
    </>
  );
}

const when = (s: string) => {
  const d = new Date(s.replace(" ", "T") + "Z");
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

type Filters = { q: string; role: string; status: string; origin: string };
function matches(c: LibraryItem, f: Filters) {
  const needle = f.q.trim().toLowerCase();
  if (f.status === "active" ? c.status === "archived" : f.status && c.status !== f.status) return false;
  if (f.role && !c.professions.includes(f.role)) return false;
  if (f.origin === "mine" && !c.mine) return false;
  if (f.origin === "sample" && c.origin !== "sample") return false;
  if (f.origin === "ai_unreviewed" && !(c.origin === "ai_draft" && !c.reviewed)) return false;
  if (f.origin === "faculty" && c.origin !== "faculty") return false;
  if (needle && ![c.title, c.patient, c.specialty, c.summary, c.encounterType].join(" ").toLowerCase().includes(needle)) return false;
  return true;
}

const STATUS_LOOK: Record<string, { head: string }> = {
  published: { head: "bg-[var(--color-xp-soft)]" },
  draft: { head: "bg-brand-50" },
  archived: { head: "bg-slate-100" },
};

function Portrait({ src, name, size = "md" }: { src?: string; name: string; size?: "md" | "lg" }) {
  const cls = size === "lg" ? "h-24 w-24 rounded-[22px]" : "h-16 w-16 rounded-[18px]";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" className={cx("studio-portrait shrink-0 object-cover object-[50%_25%] shadow-e2 ring-[3px] ring-white", cls)} />
  ) : (
    <span className={cx("studio-portrait grid shrink-0 place-items-center bg-stage font-display font-black text-white/85 shadow-e2 ring-[3px] ring-white", cls, size === "lg" ? "text-3xl" : "text-xl")}>{(name || "?").slice(0, 2).toUpperCase()}</span>
  );
}

function LevelSteps({ level }: { level: number }) {
  return (
    <span className="inline-flex items-end gap-[3px]" role="img" aria-label={`Difficulty ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((l) => (
        <span key={l} className={cx("w-[5px] rounded-[2px]", l <= level ? "bg-brand-600" : "bg-brand-100")} style={{ height: 5 + l * 2.6 }} />
      ))}
    </span>
  );
}

const toCounts = (t?: [number, number, number, number]): TierCounts => ({ initial: t?.[0] || 0, discoverable: t?.[1] || 0, reluctant: t?.[2] || 0, hidden: t?.[3] || 0 });

export default function CaseLibrary({ initial, professions, portraits = {}, tiers = {} }: { initial: LibraryItem[]; professions: { id: string; name: string }[]; portraits?: Record<string, string>; tiers?: Record<string, [number, number, number, number]> }) {
  const router = useRouter();
  const [cases, setCases] = useState(initial);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("active");
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const roleName = (id: string) => professions.find((p) => p.id === id)?.name || id;

  const f = { q, role, status, origin };
  const shown = useMemo(() => cases.filter((c) => matches(c, { q, role, status, origin })), [cases, q, role, status, origin]);
  // Live counts: each chip counts what it would show with every other filter as it is now.
  const statusCount = (s: string) => cases.filter((c) => matches(c, { ...f, status: s })).length;
  const originCount = (o: string) => cases.filter((c) => matches(c, { ...f, origin: o })).length;

  const live = cases.filter((c) => c.status === "published").length;
  const myDrafts = cases.filter((c) => c.mine && c.status === "draft").length;
  const needReview = cases.filter((c) => c.status !== "archived" && c.origin === "ai_draft" && !c.reviewed).length;
  const highCases = cases.filter((c) => c.status !== "archived" && c.openHigh > 0);
  const highTotal = highCases.reduce((n, c) => n + c.openHigh, 0);
  const resume = !q.trim() ? shown.find((c) => c.mine && c.status === "draft") : undefined;
  const grid = resume ? shown.filter((c) => c.id !== resume.id) : shown;

  async function act(id: string, fn: () => Promise<void>) {
    setBusy(id);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const refresh = async () => setCases((await api<{ cases: LibraryItem[] }>("/api/cases")).cases);
  const setStatusOf = (id: string, action: string) =>
    act(id, async () => {
      await api(`/api/cases/${id}/status`, { json: { action } });
      await refresh();
    });

  const actions = (c: LibraryItem, dark = false) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <LinkButton href={`/faculty/cases/${c.id}`} variant={dark ? "secondary" : "primary"} size="sm">
        Open
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </LinkButton>
      <Button variant="subtle" size="sm" disabled={busy === c.id || c.status === "archived"} title="Run the visit yourself, exactly as a student would" onClick={() => act(c.id, async () => router.push(await startTestVisit(c.id)))}>
        <FlaskConical className="h-3.5 w-3.5" aria-hidden />
        Test visit
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={dark ? "text-white/85 hover:bg-white/10 hover:text-white" : undefined}
        disabled={busy === c.id}
        onClick={() =>
          act(c.id, async () => {
            const { id } = await api<{ id: string }>(`/api/cases/${c.id}/duplicate`, { json: {} });
            router.push(`/faculty/cases/${id}`);
          })
        }
      >
        <Copy className="h-3.5 w-3.5" aria-hidden />
        Duplicate
      </Button>
      {c.canEdit &&
        (c.status === "archived" ? (
          <Button variant="ghost" size="sm" className={dark ? "text-white/85 hover:bg-white/10 hover:text-white" : undefined} disabled={busy === c.id} onClick={() => setStatusOf(c.id, "restore")}>
            <ArchiveRestore className="h-3.5 w-3.5" aria-hidden />
            Restore
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className={dark ? "text-white/85 hover:bg-white/10 hover:text-white" : undefined}
            disabled={busy === c.id}
            onClick={() => {
              if (c.status !== "published" || window.confirm("This patient is published. Archiving removes it from students' lists. Archive it?")) setStatusOf(c.id, "archive");
            }}
          >
            <Archive className="h-3.5 w-3.5" aria-hidden />
            Archive
          </Button>
        ))}
    </div>
  );

  return (
    <>
      {/* ---------- Hero: title + the studio at a glance (each tile is also a filter) ---------- */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="rise mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-[12.5px] font-semibold text-brand-800">
            <Stethoscope className="h-3.5 w-3.5" aria-hidden />
            {cases.length} patients in your studio
          </p>
          <h1 className="rise font-display text-[34px] font-black leading-[1.02] tracking-[-0.035em] text-ink sm:text-[48px]" style={v({ "--i": 1 })}>
            Patient Studio
          </h1>
          <p className="rise mt-2 max-w-2xl text-[15.5px] leading-relaxed text-ink-2" style={v({ "--i": 2 })}>
            Build, review and publish simulated patients. Students only see patients you have published.
          </p>
        </div>
        <LinkButton href="/faculty/cases/new" size="lg" className="rise" style={v({ "--i": 3 })}>
          <Sparkles className="h-4.5 w-4.5" aria-hidden />
          New patient
        </LinkButton>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-12">
        <button type="button" onClick={() => { setStatus("published"); setOrigin(""); }} aria-pressed={status === "published" && !origin} className="press rise relative col-span-2 overflow-hidden rounded-[24px] bg-brand-600 p-5 text-left text-white clay lg:col-span-5" style={v({ "--i": 2 })}>
          <span className="spin-slow pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full [background:conic-gradient(from_0deg,transparent,rgb(255_255_255/0.16),transparent_40%)]" aria-hidden />
          <span className="relative flex items-center gap-2 text-[13px] font-bold text-white/85">
            <span className="live-dot h-2 w-2 rounded-full bg-[var(--color-xp)]" aria-hidden />
            Live for students
          </span>
          <span className="relative mt-1 flex items-baseline gap-2">
            <span className="font-display text-[64px] font-black leading-[0.85] tracking-[-0.04em]">
              <CountUp value={live} />
            </span>
            <span className="text-[15px] font-bold text-white/80">of {cases.length} published</span>
          </span>
          <span className="relative mt-4 flex h-3 gap-[2px] overflow-hidden rounded-full bg-white/15" role="img" aria-label={`${live} published, ${cases.filter((c) => c.status === "draft").length} drafts, ${cases.filter((c) => c.status === "archived").length} archived`}>
            {[
              [live, "bg-[var(--color-xp)]"],
              [cases.filter((c) => c.status === "draft").length, "bg-white/70"],
              [cases.filter((c) => c.status === "archived").length, "bg-white/25"],
            ].map(([n, cls], i) =>
              (n as number) > 0 ? <span key={i} className={cx("studio-seg h-full", cls as string)} style={v({ width: `${((n as number) / Math.max(1, cases.length)) * 100}%`, "--i": i })} /> : null,
            )}
          </span>
          <span className="relative mt-2 flex flex-wrap gap-x-3 text-[12px] font-semibold text-white/85" aria-hidden>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[var(--color-xp)]" />Published {live}</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-white/70" />Drafts {cases.filter((c) => c.status === "draft").length}</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-white/25" />Archived {cases.filter((c) => c.status === "archived").length}</span>
          </span>
        </button>

        <button type="button" onClick={() => { setStatus("draft"); setOrigin("mine"); }} aria-pressed={status === "draft" && origin === "mine"} className="press rise flex flex-col rounded-[24px] bg-[var(--color-xp)] p-4 text-left text-ink clay lg:col-span-2" style={v({ "--i": 3 })}>
          <PencilLine className="h-5 w-5" aria-hidden />
          <span className="mt-auto pt-3 font-display text-[44px] font-black leading-[0.85] tracking-[-0.04em]">
            <CountUp value={myDrafts} />
          </span>
          <span className="mt-1 text-[13px] font-bold">Your drafts</span>
        </button>

        <button type="button" onClick={() => { setStatus("active"); setOrigin("ai_unreviewed"); }} aria-pressed={origin === "ai_unreviewed"} className="press lift rise order-last col-span-2 flex flex-col overflow-hidden rounded-[24px] bg-surface p-4 text-left shadow-e1 ring-1 ring-amber-300/70 lg:order-none lg:col-span-3" style={v({ "--i": 4 })}>
          <TrustLabel kind="ai-draft" />
          <span className="mt-auto pt-3 font-display text-[44px] font-black leading-[0.85] tracking-[-0.04em] text-amber-800">
            <CountUp value={needReview} />
          </span>
          <span className="mt-1 text-[13px] font-bold text-ink">Waiting for your review</span>
        </button>

        <div className={cx("rise flex flex-col rounded-[24px] p-4 lg:col-span-2", highTotal ? "bg-rose-50 text-rose-950 ring-1 ring-rose-200" : "bg-surface text-ink ring-1 ring-line")} style={v({ "--i": 5 })}>
          <span className="flex items-center gap-1.5 text-[12.5px] font-bold">
            <OctagonAlert className={cx("h-4.5 w-4.5", highTotal ? "breathe text-rose-600" : "text-ink-3")} aria-hidden />
            High severity
          </span>
          <span className="mt-auto pt-3 font-display text-[44px] font-black leading-[0.85] tracking-[-0.04em]">
            <CountUp value={highTotal} />
          </span>
          <span className="mt-1 text-[13px] font-bold">open in {highCases.length} patient{highCases.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {/* ---------- Filters: search + role, then status and origin as chips with live counts ---------- */}
      <div className="rise mb-4 rounded-[22px] border border-line/80 bg-surface p-3 shadow-e1" style={v({ "--i": 6 })}>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, patient name or specialty" aria-label="Search patients" className="pl-9" />
          </div>
          <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by learner role" className="sm:w-56">
            <option value="">All learner roles</option>
            {professions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-3 flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <FilterChips
            label="Filter by status"
            value={status}
            onChange={setStatus}
            options={[
              { id: "active", label: "Drafts and published", count: statusCount("active") },
              { id: "draft", label: "Drafts", count: statusCount("draft") },
              { id: "published", label: "Published", count: statusCount("published") },
              { id: "archived", label: "Archived", count: statusCount("archived") },
            ]}
          />
          <FilterChips
            label="Filter by origin"
            value={origin}
            onChange={setOrigin}
            options={[
              { id: "", label: "Any origin", count: originCount("") },
              { id: "mine", label: "Created by me", count: originCount("mine") },
              { id: "sample", label: "Samples", count: originCount("sample") },
              { id: "faculty", label: "Faculty-written", count: originCount("faculty") },
              { id: "ai_unreviewed", label: "AI-drafted, not reviewed", count: originCount("ai_unreviewed"), tone: "bg-amber-300 text-amber-950" },
            ]}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-ink-3" aria-live="polite">
          <span className="font-display text-[18px] font-black text-ink">{shown.length}</span> of {cases.length} patients
        </p>
        {/* One legend for every tier bar on the page. */}
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-semibold text-ink-2" aria-label="Fact tiers in the bars below">
          {TIER_ORDER.map((t) => (
            <li key={t} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: TIER_STYLE[t].fill }} aria-hidden />
              {TIER_STYLE[t].short}
            </li>
          ))}
        </ul>
      </div>
      {error && (
        <Notice tone="red" className="mb-3">
          {error}
        </Notice>
      )}

      {!shown.length ? (
        <Empty icon={<Search className="h-6 w-6" aria-hidden />} title={cases.length ? "No patients match these filters." : "You have no patients yet."}>
          <Link href="/faculty/cases/new" className="font-medium text-brand-700 underline">
            Create a patient
          </Link>
        </Empty>
      ) : (
        <>
          {/* ---------- Pick up where you left off: your most recent draft ---------- */}
          {resume && (
            <section aria-labelledby="resume" className="studio-card rise relative mb-4 overflow-hidden rounded-[26px] bg-stage p-5 text-white clay sm:p-6" style={v({ "--i": 7 })}>
              <div className="studio-glow pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,oklch(0.52_0.143_198/0.7),transparent)]" aria-hidden />
              <div className="relative flex flex-wrap items-center gap-5">
                <Portrait src={portraits[resume.id]} name={resume.patient} size="lg" />
                <div className="min-w-0 flex-1 basis-72">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--color-xp)]">
                    <PencilLine className="h-3.5 w-3.5" aria-hidden />
                    Pick up where you left off · edited {when(resume.updatedAt)}
                  </p>
                  <h2 id="resume" className="mt-1 font-display text-[28px] font-black leading-tight tracking-[-0.03em]">
                    <Link href={`/faculty/cases/${resume.id}`} className="hover:underline">
                      {resume.patient || "Unnamed patient"}
                    </Link>
                  </h2>
                  <p className="mt-0.5 line-clamp-2 max-w-3xl text-[14px] text-white/80">{resume.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusBadges c={resume} />
                    {resume.openHigh > 0 && (
                      <Badge tone="red">
                        <OctagonAlert className="h-3 w-3" aria-hidden />
                        {resume.openHigh} high-severity issue{resume.openHigh === 1 ? "" : "s"} open
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="w-full sm:w-64">
                  <TierBar counts={toCounts(tiers[resume.id])} legend dark height={12} />
                </div>
              </div>
              <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                <p className="text-[12.5px] text-white/75">
                  {resume.counts.facts} facts, {resume.counts.actions} exams and orders, {resume.counts.artifacts} documents
                  {resume.counts.variants ? `, ${resume.counts.variants} approved variant${resume.counts.variants === 1 ? "" : "s"}` : ""}
                </p>
                {actions(resume, true)}
              </div>
            </section>
          )}

          <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {grid.map((c, i) => {
              const look = STATUS_LOOK[c.status] || STATUS_LOOK.draft;
              const tc = toCounts(tiers[c.id]);
              return (
                <li key={c.id} className="studio-card lift rise group flex flex-col overflow-hidden rounded-[24px] bg-surface shadow-e1 ring-1 ring-line/80" style={v({ "--i": Math.min(i, 10) + 7 })}>
                  <div className={cx("relative flex items-start gap-3.5 px-4 pb-3 pt-4", look.head)}>
                    <Link href={`/faculty/cases/${c.id}`} className="shrink-0" tabIndex={-1} aria-hidden>
                      <Portrait src={portraits[c.id]} name={c.patient} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[19px] font-extrabold leading-tight tracking-[-0.02em] text-ink">{c.patient || "Unnamed patient"}</p>
                      <Link href={`/faculty/cases/${c.id}`} className="mt-0.5 line-clamp-2 text-[13.5px] font-medium leading-snug text-ink-2 hover:text-brand-700 hover:underline">
                        {c.title}
                      </Link>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadges c={c} />
                      {c.openHigh > 0 && (
                        <Badge tone="red">
                          <OctagonAlert className="h-3 w-3" aria-hidden />
                          {c.openHigh} high-severity issue{c.openHigh === 1 ? "" : "s"} open
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-3">
                      <LevelSteps level={c.difficulty} />
                      <span>{[c.professions.map(roleName).join(", "), c.specialty, `Difficulty ${c.difficulty} of 5`].filter(Boolean).join("  ·  ")}</span>
                    </p>
                    {c.summary && <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-ink-2">{c.summary}</p>}
                    <div className="mt-auto pt-3">
                      <TierBar counts={tc} height={8} />
                      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-ink-3">
                        <span className="inline-flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5" aria-hidden />
                          <b className="font-mono text-ink">{c.counts.facts}</b> facts
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                          <b className="font-mono text-ink">{c.counts.actions}</b> exams and orders
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" aria-hidden />
                          <b className="font-mono text-ink">{c.counts.artifacts}</b> documents
                        </span>
                        {c.counts.variants ? (
                          <span>
                            <b className="font-mono text-ink">{c.counts.variants}</b> approved variant{c.counts.variants === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/70 bg-surface-2/40 px-4 py-2.5">
                    {actions(c)}
                    <span className={cx("text-[12px] text-ink-3")}>edited {when(c.updatedAt)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
