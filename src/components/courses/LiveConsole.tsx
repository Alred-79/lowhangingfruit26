"use client";
import { AlertTriangle, ClipboardList, FlaskConical, ListChecks, MessageSquareQuote, Pause, Play, Radio, Send, Smile, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import RunningScore, { SERIES, type TimelinePoint } from "@/components/faculty/RunningScore";
import { Spark } from "@/components/faculty/viz";
import { Badge, Button, Card, Empty, Textarea, cx } from "@/components/ui";
import { feedbackUrl, toDate } from "@/lib/courses/settings";
import { ComfortMeter } from "./charts";

interface Visit {
  id: string;
  status: "active" | "paused";
  student: string;
  title: string;
  assignment: string | null;
  mode: string;
  level: number;
  turn: number;
  rapport: number;
  facts: number;
  startedAt: string;
  lastAt: string | null;
  flags: string[];
}
interface Detail {
  id: string;
  status: string;
  mode: string;
  level: number;
  pauseNote: string | null;
  timeLimitMin: number | null;
  startedAt: string;
  chart: {
    patient: { name: string; age: number; sex: string };
    chiefComplaint: string;
    tasks: string[];
    sections: { category: string; label: string; items: { id: string; text: string; turn: number }[] }[];
    results: { id: string; name: string; result: string; abnormal: boolean; turn: number }[];
    unmatched: { turn: number; request: string }[];
    emotion: string;
    turn: number;
  };
  messages: { id: number; turn: number; speaker: string; text: string }[];
}

const QUICK = [
  "Slow down and acknowledge how the patient is feeling before your next question.",
  "Try an open question, then let the patient finish.",
  "Explain why you are asking before you return to that topic.",
  "You are running short on time. Summarise and agree next steps.",
];
const WHO: Record<string, string> = { student: "Student", patient: "Patient", system: "Chart", instructor: "Instructor", coach: "Coach hint", clinician: "Colleague" };
/** Visits whose running-score sparkline is kept fresh (one quiet request each, every 6 seconds). */
const TILE_LIMIT = 12;

const mins = (iso: string, now: number) => Math.max(0, Math.round((now - toDate(iso).getTime()) / 60000));
const pct = (v: number) => Math.round(v * 100);
const v = (o: Record<string, string | number>) => o as CSSProperties;

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({ error: "Request failed" }));
  if (!res.ok || j.error) throw new Error(j.error || "Request failed");
}

function LivePill({ paused, ended }: { paused?: boolean; ended?: boolean }) {
  if (ended) return <Badge tone="slate">Visit ended</Badge>;
  if (paused) return <Badge tone="amber">Paused</Badge>;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-live)] px-2.5 py-1 text-[11.5px] font-black uppercase tracking-[0.06em] text-white">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
      Live
    </span>
  );
}

export default function LiveConsole() {
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [listError, setListError] = useState("");
  // /encounter/<id> sends faculty here with ?visit=<id>; open that visit straight away.
  const params = useSearchParams();
  const [sel, setSel] = useState<string | null>(() => params.get("visit"));
  const [detail, setDetail] = useState<Detail | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tiles, setTiles] = useState<Record<string, TimelinePoint[]>>({});
  const [scrub, setScrub] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const seen = useRef(0);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/live", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(j.error || "Could not load live visits");
      setVisits(j.visits);
      setListError("");
      setNow(Date.now());
    } catch (e) {
      setListError((e as Error).message);
    }
  }, []);
  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/encounters/${id}`, { cache: "no-store" });
      const j = await res.json();
      if (res.ok && !j.error) setDetail(j);
    } catch {
      /* keep the last good copy; the next poll retries */
    }
  }, []);

  useEffect(() => {
    loadList();
    const t = setInterval(loadList, 3000);
    return () => clearInterval(t);
  }, [loadList]);
  useEffect(() => {
    if (!sel) return;
    seen.current = 0;
    loadDetail(sel);
    const t = setInterval(() => loadDetail(sel), 3000);
    return () => clearInterval(t);
  }, [sel, loadDetail]);
  // Follow the conversation as new lines arrive.
  useEffect(() => {
    const n = detail?.messages.length || 0;
    if (n !== seen.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
    seen.current = n;
  }, [detail]);

  // Running-score sparklines for the tiles. The same faculty-only `timeline` the open visit uses, fetched one visit
  // at a time so the list poll above stays the source of truth for what is live.
  const tileIds = (visits || []).slice(0, TILE_LIMIT).map((x) => x.id).join(",");
  useEffect(() => {
    if (!tileIds) return;
    let stop = false;
    const ids = tileIds.split(",");
    async function run() {
      for (const id of ids) {
        if (stop) return;
        try {
          const res = await fetch(`/api/encounters/${id}`, { cache: "no-store" });
          const j = await res.json();
          if (res.ok && Array.isArray(j.timeline)) setTiles((o) => ({ ...o, [id]: j.timeline }));
        } catch {
          /* the tile keeps its last line */
        }
      }
    }
    run();
    const t = setInterval(run, 6000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [tileIds]);

  function open(id: string) {
    setDetail(null);
    setMsg(null);
    setNote("");
    setScrub(null);
    setSel(id);
  }
  async function act(fn: () => Promise<void>, done: string) {
    if (!sel) return;
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: done });
      setNote("");
      await Promise.all([loadDetail(sel), loadList()]);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  const current = detail && detail.id === sel ? detail : null;
  const info = visits?.find((x) => x.id === sel) || null;
  const ended = current && current.status !== "active" && current.status !== "paused";
  const paused = current?.status === "paused";

  const tl = (current as unknown as { timeline?: TimelinePoint[] } | null)?.timeline || [];
  const scrubTurn = scrub !== null && tl[scrub] ? tl[scrub].turn : null;

  // Scrubbing the chart brings that turn's lines into view inside the transcript (the page itself never jumps).
  useEffect(() => {
    if (scrubTurn === null || !scroller.current) return;
    const el = scroller.current.querySelector<HTMLElement>(`[data-turn="${scrubTurn}"]`);
    if (el) scroller.current.scrollTop = Math.max(0, el.offsetTop - scroller.current.offsetTop - 12);
  }, [scrubTurn]);

  return (
    <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
      {/* ---------- Visits in progress ---------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-stage px-4 py-3 text-white clay">
          <span className="inline-flex items-center gap-2 text-[14px] font-bold">
            <span className={cx("relative grid h-7 w-7 place-items-center rounded-full", visits?.length ? "bg-[var(--color-live)]" : "bg-white/15")}>
              <Radio className="h-3.5 w-3.5" aria-hidden />
              {!!visits?.length && <span className="speak-ring absolute inset-0 rounded-full" aria-hidden />}
            </span>
            {visits === null ? "Loading…" : `${visits.length} visit${visits.length === 1 ? "" : "s"} in progress`}
          </span>
          <span className="text-[12px] font-semibold text-white/70">Updates every 3 seconds</span>
        </div>
        {listError && (
          <p className="flex items-center gap-2 rounded-2xl bg-[var(--color-tier-hidden-soft)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--color-tier-hidden-ink)]">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            {listError}
          </p>
        )}
        {visits?.length === 0 && (
          <Empty icon={<Radio className="h-5 w-5" aria-hidden />}>
            No visits are in progress with live assist on. To watch a visit, turn on Live assist in the assignment&apos;s settings before students start.
          </Empty>
        )}
        {visits?.map((x, i) => {
          const line = (x.id === sel && tl.length ? tl : tiles[x.id]) || [];
          const score = line.length ? pct(line[line.length - 1].score) : null;
          const delta = line.length >= 2 ? pct(line[line.length - 1].score) - pct(line[line.length - 2].score) : null;
          const on = sel === x.id;
          // Scaled to the visit's own range so turn-to-turn movement is visible; the number is the truth.
          const vals = line.map((p) => pct(p.score));
          const lo = vals.length ? Math.max(0, Math.min(...vals) - 10) : 0;
          const hi = vals.length ? Math.min(100, Math.max(...vals) + 10) : 100;
          const flagged = x.flags.length > 0;
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => open(x.id)}
              aria-pressed={on}
              className={cx(
                "press rise lift block w-full overflow-hidden rounded-[22px] bg-surface text-left ring-inset transition-[box-shadow] duration-200",
                on ? "shadow-e2 ring-[3px] ring-brand-600" : flagged ? "ring-2 ring-[color-mix(in_oklch,var(--color-tier-hidden)_45%,transparent)]" : "shadow-e1 ring-1 ring-line",
              )}
              style={v({ "--i": i })}
            >
              <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display text-[15px] font-black text-white clay", on ? "bg-brand-600" : "bg-ink")} aria-hidden>
                    {x.student.slice(0, 1)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-extrabold text-ink">{x.student}</div>
                    <div className="line-clamp-2 text-[12.5px] leading-snug text-ink-3">{x.title}</div>
                  </div>
                </div>
                <LivePill paused={x.status === "paused"} />
              </div>
              <div className="mt-2 flex items-end gap-3 px-4">
                <div className="shrink-0">
                  <div className="text-[11.5px] font-bold text-ink-3">Running score</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-[34px] font-black leading-none tracking-[-0.03em] text-ink tabular">{score ?? "–"}</span>
                    {delta !== null && <span className={cx("font-mono text-[12px] font-bold", delta >= 0 ? "text-[var(--color-tier-initial-ink)]" : "text-[var(--color-tier-hidden-ink)]")}>{delta >= 0 ? `+${delta}` : delta}</span>}
                  </div>
                </div>
                <Spark values={vals} min={lo} max={hi} w={180} h={46} color={SERIES[0].color} live={x.status === "active"} className="h-12 min-w-0 flex-1" label={score === null ? "Running score: waiting for the first patient reply" : `Running score by turn, now ${score}`} i={i} />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5 px-4 text-[12px] font-semibold text-ink-2">
                <span className="rounded-full bg-surface-2 px-2 py-0.5">Turn {x.turn}</span>
                <span className="rounded-full bg-[var(--color-tier-initial-soft)] px-2 py-0.5 text-[var(--color-tier-initial-ink)]">{x.facts} facts gathered</span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5">Level {x.level}</span>
                <span className="rounded-full bg-surface-2 px-2 py-0.5">{mins(x.startedAt, now)} min in</span>
              </div>
              <div className="mt-2.5 px-4">
                <ComfortMeter value={x.rapport} />
              </div>
              {flagged && (
                <div className="mt-2 flex flex-wrap gap-1 px-4">
                  {x.flags.map((f) => (
                    <Badge key={f} tone="red">
                      At risk: {f}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="mt-3 truncate border-t border-line/70 bg-surface-2/50 px-4 py-2 text-[12px] text-ink-3">
                {x.assignment || "No assignment"} · {x.mode}
                {x.lastAt ? ` · last message ${mins(x.lastAt, now)} min ago` : " · no messages yet"}
              </div>
            </button>
          );
        })}
      </div>

      {/* ---------- The open visit ---------- */}
      <div className="min-w-0">
        {!sel ? (
          <div className="grid min-h-[22rem] place-items-center rounded-[26px] border-2 border-dashed border-line bg-surface/60 p-8 text-center">
            <div>
              <span className="float-idle mx-auto grid h-16 w-16 place-items-center rounded-[20px] bg-stage text-white clay">
                <Radio className="h-7 w-7" aria-hidden />
              </span>
              <p className="mt-4 font-display text-[20px] font-extrabold text-ink">Pick a visit to watch</p>
              <p className="mx-auto mt-1 max-w-sm text-[14px] leading-relaxed text-ink-3">Choose a visit on the left to see its transcript and chart, pause it or send the student a note.</p>
            </div>
          </div>
        ) : !current ? (
          <Card className="space-y-3 p-6">
            <p className="text-[14px] text-ink-3">Loading the visit…</p>
            <div className="shimmer h-24 rounded-2xl bg-surface-2" />
            <div className="shimmer h-56 rounded-2xl bg-surface-2" />
          </Card>
        ) : (
          <div className="overflow-hidden rounded-[26px] border border-line/80 bg-surface shadow-e2">
            <div className="relative overflow-hidden bg-stage px-5 py-4 text-white">
              <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,oklch(0.64_0.23_18/0.35),transparent_65%)] breathe" aria-hidden />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-[22px] font-extrabold leading-tight tracking-[-0.02em]">
                    {info?.student || "Student"} with {current.chart.patient.name}
                    <span className="font-sans text-[15px] font-medium text-white/70">
                      {" "}
                      · {current.chart.patient.age}, {current.chart.patient.sex}
                    </span>
                  </h2>
                  <p className="mt-1 text-[13px] text-white/75">
                    {current.chart.chiefComplaint} · level {current.level} · {current.mode} · turn {current.chart.turn}
                    {current.timeLimitMin ? ` · ${mins(current.startedAt, now)} of ${current.timeLimitMin} min` : ` · ${mins(current.startedAt, now)} min in`}
                  </p>
                </div>
                <span className="shrink-0">{ended ? <Badge tone="slate">Visit ended</Badge> : paused ? <Badge tone="amber">Paused by instructor</Badge> : <LivePill />}</span>
              </div>
              {current.timeLimitMin ? (
                <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/15" role="meter" aria-label="Time used" aria-valuemin={0} aria-valuemax={current.timeLimitMin} aria-valuenow={Math.min(current.timeLimitMin, mins(current.startedAt, now))}>
                  <div className="h-full rounded-full bg-[var(--color-flame-2)] transition-[width] duration-700" style={{ width: `${Math.min(100, (mins(current.startedAt, now) / current.timeLimitMin) * 100)}%` }} />
                </div>
              ) : null}
            </div>

            {/* The running score, live: arithmetic over each turn, no model call. */}
            {tl.length >= 2 && <LiveScore tl={tl} active={scrub} onActive={setScrub} />}

            <div className="grid lg:grid-cols-[minmax(0,1fr)_18.5rem]">
              <div className="border-b border-line lg:border-b-0 lg:border-r">
                <div ref={scroller} className="scroll-quiet relative h-[26rem] space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
                  {current.messages.length === 0 && <p className="text-[14px] text-ink-3">The student has not said anything yet.</p>}
                  {current.messages.map((m) => (
                    <div key={m.id} data-turn={m.turn} className={cx("text-[14px]", m.speaker === "student" ? "pl-0 pr-8" : m.speaker === "patient" ? "pl-8" : "")}>
                      <div className={cx("text-[12px] font-semibold", m.speaker === "student" ? "text-brand-700" : "text-ink-3")}>
                        {WHO[m.speaker] || m.speaker} · <span className="font-mono">T{m.turn}</span>
                      </div>
                      <div
                        className={cx(
                          "mt-0.5 whitespace-pre-line rounded-2xl px-3.5 py-2 leading-relaxed",
                          m.speaker === "student" ? "rounded-tl-md bg-brand-50 text-ink" : m.speaker === "patient" ? "rounded-tr-md bg-surface-2 text-ink" : m.speaker === "instructor" ? "border border-violet-200 bg-violet-50 text-violet-950" : m.text.startsWith("Outside the case record") ? "border border-rose-200 bg-rose-50 text-[13px] text-rose-950" : "border border-line bg-surface text-[12.5px] text-ink-2",
                          scrubTurn === m.turn && "fac-turn-hit",
                        )}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-line bg-surface-2/60 p-5">
                  {ended ? (
                    <p className="text-[14px] text-ink-2">
                      This visit has been submitted.{" "}
                      <Link href={feedbackUrl(current.id)} className="font-semibold text-brand-700 underline">
                        Open the feedback
                      </Link>
                    </p>
                  ) : (
                    <>
                      <label htmlFor="live-note" className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-ink">
                        <MessageSquareQuote className="h-4 w-4 text-[var(--color-mastery)]" aria-hidden />
                        {paused ? "Note to the student (they see it straight away; the visit stays paused until you resume)" : "Note to the student (shown in their visit straight away, or attached to a pause)"}
                      </label>
                      <Textarea id="live-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. You have asked three closed questions in a row. Ask what worries him most and wait." />
                      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Quick notes">
                        {QUICK.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => setNote(q)}
                            aria-pressed={note === q}
                            className={cx("press min-h-8 rounded-full px-3 py-1 text-left text-[12.5px] font-semibold ring-1 ring-inset transition-colors pointer-coarse:min-h-11", note === q ? "bg-[var(--color-mastery-soft)] text-[var(--color-mastery-ink)] ring-[var(--color-mastery)]" : "bg-surface text-ink-2 ring-line hover:bg-brand-50 hover:text-brand-900 hover:ring-brand-200")}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="secondary" disabled={busy || !note.trim()} onClick={() => act(() => post(`/api/encounters/${sel}/coach`, { text: note }), "Note sent to the student.")}>
                          <Send className="h-3.5 w-3.5" aria-hidden />
                          Send note
                        </Button>
                        {paused ? (
                          <Button size="sm" disabled={busy} onClick={() => act(() => post(`/api/encounters/${sel}/pause`, { paused: false }), "Visit resumed.")}>
                            <Play className="h-3.5 w-3.5" aria-hidden />
                            Resume visit
                          </Button>
                        ) : (
                          <Button size="sm" variant="danger" disabled={busy} onClick={() => act(() => post(`/api/encounters/${sel}/pause`, { paused: true, note }), "Visit paused. The student cannot continue until you resume.")}>
                            <Pause className="h-3.5 w-3.5" aria-hidden />
                            {note.trim() ? "Pause with this note" : "Pause visit"}
                          </Button>
                        )}
                        {msg && (
                          <span key={msg.text} role="status" className={cx("pop-in rounded-full px-2.5 py-1 text-[12.5px] font-semibold", msg.ok ? "bg-[var(--color-tier-initial-soft)] text-[var(--color-tier-initial-ink)]" : "bg-[var(--color-tier-hidden-soft)] text-[var(--color-tier-hidden-ink)]")}>
                            {msg.text}
                          </span>
                        )}
                      </div>
                      {paused && current.pauseNote && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] text-amber-950">Pause note shown to the student: {current.pauseNote}</p>}
                    </>
                  )}
                </div>
              </div>

              <div className="scroll-quiet max-h-[40rem] space-y-4 overflow-y-auto px-4 py-4 text-[13px]">
                {info && (
                  <div className="rounded-2xl bg-surface-2 p-3">
                    <ComfortMeter value={info.rapport} />
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-2xl bg-[var(--color-flame-soft)] px-3 py-2.5 text-ink">
                  <Smile className="h-4 w-4 shrink-0 text-[var(--color-flame-ink)]" aria-hidden />
                  <span>
                    Patient mood: <span className="font-bold">{current.chart.emotion}</span>
                  </span>
                </div>
                {info && info.flags.length > 0 && (
                  <div className="rounded-2xl bg-[var(--color-tier-hidden-soft)] p-3">
                    <div className="mb-1 flex items-center gap-1.5 font-bold text-[var(--color-tier-hidden-ink)]">
                      <AlertTriangle className="h-4 w-4" aria-hidden />
                      At-risk signals
                    </div>
                    <ul className="list-disc space-y-0.5 pl-5 text-ink">
                      {info.flags.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <SideTitle icon={<ClipboardList className="h-3.5 w-3.5" aria-hidden />} tone="bg-[var(--color-tier-initial-soft)] text-[var(--color-tier-initial-ink)]">
                    Chart so far
                  </SideTitle>
                  {current.chart.sections.length === 0 && <p className="text-ink-3">Nothing gathered yet.</p>}
                  {current.chart.sections.map((s) => (
                    <div key={s.category} className="mb-2.5">
                      <div className="text-[12px] font-bold text-ink-3">{s.label}</div>
                      <ul className="mt-0.5 space-y-1 text-ink">
                        {s.items.map((it) => (
                          <li key={it.id} className={cx("rounded-lg px-1.5 py-0.5 leading-snug", scrubTurn === it.turn && "bg-brand-50 ring-1 ring-brand-300")}>
                            {it.text} <span className="font-mono text-[11.5px] text-ink-3">T{it.turn}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {current.chart.results.length > 0 && (
                  <div>
                    <SideTitle icon={<FlaskConical className="h-3.5 w-3.5" aria-hidden />} tone="bg-[var(--color-tier-discoverable-soft)] text-[var(--color-tier-discoverable-ink)]">
                      Exams and orders
                    </SideTitle>
                    <ul className="space-y-1 text-ink">
                      {current.chart.results.map((r) => (
                        <li key={r.id}>
                          <span className="font-semibold">{r.name}:</span> {r.result} {r.abnormal && <Badge tone="amber">Abnormal</Badge>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {current.chart.unmatched.length > 0 && (
                  <div>
                    <SideTitle icon={<Stethoscope className="h-3.5 w-3.5" aria-hidden />} tone="bg-surface-2 text-ink-2">
                      Requests with no result
                    </SideTitle>
                    <ul className="list-disc pl-4 text-ink-2">
                      {current.chart.unmatched.map((u, i) => (
                        <li key={i}>{u.request}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <SideTitle icon={<ListChecks className="h-3.5 w-3.5" aria-hidden />} tone="bg-[var(--color-mastery-soft)] text-[var(--color-mastery-ink)]">
                    Tasks the student was given
                  </SideTitle>
                  <ul className="list-disc space-y-0.5 pl-4 text-ink-2">
                    {current.chart.tasks.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SideTitle({ icon, tone, children }: { icon: React.ReactNode; tone: string; children: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-2 font-bold text-ink">
      <span className={cx("grid h-6 w-6 place-items-center rounded-lg", tone)}>{icon}</span>
      {children}
    </div>
  );
}

/** The running score for the selected visit: the latest number and its change, the four measures, and the lines so far. */
function LiveScore({ tl, active, onActive }: { tl: TimelinePoint[]; active: number | null; onActive: (i: number | null) => void }) {
  const last = tl[tl.length - 1];
  const prev = tl[tl.length - 2];
  const delta = pct(last.score) - pct(prev.score);
  const shown = active !== null && tl[active] ? tl[active] : last;
  return (
    <div className="border-b border-line">
      <div className="grid gap-3 px-5 pt-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <div className="flex items-end gap-3">
          <div>
            <div className="text-[12.5px] font-bold text-ink-3">{active !== null ? `Running score at T${shown.turn}` : "Running score"}</div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[56px] font-black leading-[0.9] tracking-[-0.04em] text-ink tabular">{pct(shown.score)}</span>
              <span className="text-[14px] font-bold text-ink-3">/ 100</span>
            </div>
          </div>
          <span key={delta} className={cx("pop-spring mb-1 rounded-full px-2.5 py-1 font-mono text-[12.5px] font-bold tabular-nums", delta >= 0 ? "bg-[var(--color-tier-initial-soft)] text-[var(--color-tier-initial-ink)]" : "bg-[var(--color-tier-hidden-soft)] text-[var(--color-tier-hidden-ink)]")}>
            {delta >= 0 ? "+" : ""}
            {delta} since T{prev.turn}
          </span>
        </div>
        <dl className="grid grid-cols-3 gap-2">
          {SERIES.slice(1).map((s) => (
            <div key={s.key} className="rounded-2xl bg-surface-2 px-3 py-2">
              <dt className="flex items-center gap-1.5 text-[12px] font-bold text-ink-3">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                <span className="truncate">{s.key === "coverage" ? "Findings" : s.name}</span>
              </dt>
              <dd className="font-display text-[22px] font-black leading-tight text-ink tabular">{pct(shown[s.key])}</dd>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
                <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct(shown[s.key])}%`, background: s.color }} />
              </div>
            </div>
          ))}
        </dl>
      </div>
      <div className="px-5 pb-4 pt-3">
        <RunningScore tl={tl} active={active} onActive={onActive} />
        <p className="mt-1 text-[12px] text-ink-3">Scrub the chart (or focus it and use the arrow keys) to light up that turn in the transcript and chart.</p>
      </div>
    </div>
  );
}
