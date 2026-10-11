"use client";
import { Pause, Play, Radio, Send } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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

const mins = (iso: string, now: number) => Math.max(0, Math.round((now - toDate(iso).getTime()) / 60000));

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({ error: "Request failed" }));
  if (!res.ok || j.error) throw new Error(j.error || "Request failed");
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

  function open(id: string) {
    setDetail(null);
    setMsg(null);
    setNote("");
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
  const info = visits?.find((v) => v.id === sel) || null;
  const ended = current && current.status !== "active" && current.status !== "paused";
  const paused = current?.status === "paused";

  const tl = (current as unknown as { timeline?: { turn: number; score: number; coverage: number; communication: number; comfort: number }[] } | null)?.timeline || [];

  return (
    <div className="grid gap-5 lg:grid-cols-[21rem_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-[12.5px] text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            {!!visits?.length && <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />}
            {visits === null ? "Loading…" : `${visits.length} visit${visits.length === 1 ? "" : "s"} in progress`}
          </span>
          <span>Updates every 3 seconds</span>
        </div>
        {listError && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12.5px] text-rose-800 ring-1 ring-inset ring-rose-200">{listError}</p>}
        {visits?.length === 0 && (
          <Empty icon={<Radio className="h-5 w-5" aria-hidden />}>
            No visits are in progress with live assist on. To watch a visit, turn on Live assist in the assignment&apos;s settings before students start.
          </Empty>
        )}
        {visits?.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => open(v.id)}
            aria-pressed={sel === v.id}
            className={cx("press block w-full rounded-2xl border bg-surface p-3.5 text-left transition-colors", sel === v.id ? "border-brand-500 ring-1 ring-brand-500" : v.flags.length ? "border-amber-300 hover:border-amber-400" : "border-line hover:border-slate-300")}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[14.5px] font-semibold text-ink">{v.student}</div>
                <div className="line-clamp-2 text-[12.5px] text-ink-3">{v.title}</div>
              </div>
              {v.status === "paused" ? (
                <Badge tone="amber">Paused</Badge>
              ) : (
                <Badge tone="green">
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                  Live
                </Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-ink-2">
              <span>Turn {v.turn}</span>
              <span>{v.facts} facts gathered</span>
              <span>Level {v.level}</span>
              <span>{mins(v.startedAt, now)} min in</span>
            </div>
            <div className="mt-2.5">
              <ComfortMeter value={v.rapport} />
            </div>
            {v.flags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {v.flags.map((f) => (
                  <Badge key={f} tone="red">
                    At risk: {f}
                  </Badge>
                ))}
              </div>
            )}
            <div className="mt-2 truncate text-[12px] text-ink-3">
              {v.assignment || "No assignment"} · {v.mode}
              {v.lastAt ? ` · last message ${mins(v.lastAt, now)} min ago` : " · no messages yet"}
            </div>
          </button>
        ))}
      </div>

      <div className="min-w-0">
        {!sel ? (
          <Empty icon={<Radio className="h-5 w-5" aria-hidden />}>Choose a visit on the left to see its transcript and chart, pause it or send the student a note.</Empty>
        ) : !current ? (
          <Card className="p-6 text-[14px] text-ink-3">Loading the visit…</Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold text-ink">
                  {info?.student || "Student"} with {current.chart.patient.name}
                  <span className="font-normal text-ink-3">
                    {" "}
                    · {current.chart.patient.age}, {current.chart.patient.sex}
                  </span>
                </h2>
                <p className="mt-0.5 text-[12.5px] text-ink-3">
                  {current.chart.chiefComplaint} · level {current.level} · {current.mode} · turn {current.chart.turn}
                  {current.timeLimitMin ? ` · ${mins(current.startedAt, now)} of ${current.timeLimitMin} min` : ` · ${mins(current.startedAt, now)} min in`}
                </p>
              </div>
              <span className="shrink-0">
                {ended ? (
                  <Badge tone="slate">Visit ended</Badge>
                ) : paused ? (
                  <Badge tone="amber">Paused by instructor</Badge>
                ) : (
                  <Badge tone="green">
                    <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                    Live
                  </Badge>
                )}
              </span>
            </div>

            {/* The running score, live: arithmetic over each turn, no model call. */}
            {tl.length >= 2 && <LiveScore tl={tl} />}

            <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="border-b border-line lg:border-b-0 lg:border-r">
                <div ref={scroller} className="scroll-quiet h-[26rem] space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
                  {current.messages.length === 0 && <p className="text-[14px] text-ink-3">The student has not said anything yet.</p>}
                  {current.messages.map((m) => (
                    <div key={m.id} className={cx("text-[14px]", m.speaker === "student" ? "pl-0 pr-8" : m.speaker === "patient" ? "pl-8" : "")}>
                      <div className="text-[12px] font-medium text-ink-3">
                        {WHO[m.speaker] || m.speaker} · <span className="font-mono">T{m.turn}</span>
                      </div>
                      <div
                        className={cx(
                          "mt-0.5 whitespace-pre-line rounded-xl px-3.5 py-2 leading-relaxed",
                          m.speaker === "student" ? "bg-brand-50 text-ink" : m.speaker === "patient" ? "bg-surface-2 text-ink" : m.speaker === "instructor" ? "border border-violet-200 bg-violet-50 text-violet-950" : m.text.startsWith("Outside the case record") ? "border border-rose-200 bg-rose-50 text-[13px] text-rose-950" : "border border-line bg-surface text-[12.5px] text-ink-2",
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
                      <Link href={feedbackUrl(current.id)} className="font-medium text-brand-700 underline">
                        Open the feedback
                      </Link>
                    </p>
                  ) : (
                    <>
                      <label htmlFor="live-note" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                        {paused ? "Note to the student (they see it straight away; the visit stays paused until you resume)" : "Note to the student (shown in their visit straight away, or attached to a pause)"}
                      </label>
                      <Textarea id="live-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. You have asked three closed questions in a row. Ask what worries him most and wait." />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {QUICK.map((q) => (
                          <button key={q} type="button" onClick={() => setNote(q)} className="press rounded-full bg-surface px-2.5 py-1 text-left text-[12px] text-ink-2 ring-1 ring-inset ring-line hover:bg-brand-50 hover:text-brand-900 hover:ring-brand-200">
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
                        {msg && <span className={`text-[12.5px] ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</span>}
                      </div>
                      {paused && current.pauseNote && <p className="mt-2 text-[12.5px] text-ink-3">Pause note shown to the student: {current.pauseNote}</p>}
                    </>
                  )}
                </div>
              </div>

              <div className="scroll-quiet max-h-[38rem] space-y-4 overflow-y-auto px-4 py-4 text-[13px]">
                {info && <ComfortMeter value={info.rapport} />}
                <div className="text-ink-2">Patient mood: {current.chart.emotion}</div>
                {info && info.flags.length > 0 && (
                  <div>
                    <div className="mb-1 font-semibold text-ink">At-risk signals</div>
                    <ul className="list-disc space-y-0.5 pl-4 text-rose-800">
                      {info.flags.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <div className="mb-1 font-semibold text-ink">Chart so far</div>
                  {current.chart.sections.length === 0 && <p className="text-ink-3">Nothing gathered yet.</p>}
                  {current.chart.sections.map((s) => (
                    <div key={s.category} className="mb-2">
                      <div className="text-[12px] font-semibold text-ink-3">{s.label}</div>
                      <ul className="mt-0.5 space-y-0.5 text-ink">
                        {s.items.map((i) => (
                          <li key={i.id}>
                            {i.text} <span className="font-mono text-[11.5px] text-ink-3">T{i.turn}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {current.chart.results.length > 0 && (
                  <div>
                    <div className="mb-1 font-semibold text-ink">Exams and orders</div>
                    <ul className="space-y-1 text-ink">
                      {current.chart.results.map((r) => (
                        <li key={r.id}>
                          <span className="font-medium">{r.name}:</span> {r.result} {r.abnormal && <Badge tone="amber">Abnormal</Badge>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {current.chart.unmatched.length > 0 && (
                  <div>
                    <div className="mb-1 font-semibold text-ink">Requests with no result</div>
                    <ul className="list-disc pl-4 text-ink-2">
                      {current.chart.unmatched.map((u, i) => (
                        <li key={i}>{u.request}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <div className="mb-1 font-semibold text-ink">Tasks the student was given</div>
                  <ul className="list-disc space-y-0.5 pl-4 text-ink-2">
                    {current.chart.tasks.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/** The running score for the selected visit: the latest number, its change, and the line so far. */
function LiveScore({ tl }: { tl: { turn: number; score: number; coverage: number; communication: number; comfort: number }[] }) {
  const pct = (v: number) => Math.round(v * 100);
  const last = tl[tl.length - 1];
  const prev = tl[tl.length - 2];
  const delta = pct(last.score) - pct(prev.score);
  const W = 520, H = 84, P = 6;
  // Scaled to the visit's own range so turn-to-turn movement is visible; the number is the truth.
  const lo = Math.max(0, Math.min(...tl.map((p) => p.score)) - 0.08);
  const hi = Math.min(1, Math.max(...tl.map((p) => p.score)) + 0.08);
  const x = (i: number) => P + (i * (W - 2 * P)) / (tl.length - 1);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo || 1)) * (H - 2 * P);
  const line = tl.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(" ");
  return (
    <div className="grid gap-4 border-b border-line bg-brand-950 px-5 py-4 text-white sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <div>
        <div className="text-[12.5px] text-white/65">Running score</div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[40px] font-semibold leading-none tabular">{pct(last.score)}</span>
          <span className={cx("font-mono text-[13px] font-semibold tabular-nums", delta >= 0 ? "text-[oklch(0.82_0.15_168)]" : "text-rose-300")}>
            {delta >= 0 ? "+" : ""}
            {delta} since T{prev.turn}
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full" role="img" aria-label={`Running score by turn, now ${pct(last.score)} at turn ${last.turn}`}>
        <path d={`${line} L${x(tl.length - 1)},${H - P} L${x(0)},${H - P} Z`} fill="oklch(0.82 0.15 168 / 0.14)" />
        <path d={line} fill="none" stroke="oklch(0.82 0.15 168)" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(tl.length - 1)} cy={y(last.score)} r={4} fill="oklch(0.82 0.15 168)" className="live-dot" />
      </svg>
      <dl className="grid grid-cols-3 gap-3 text-center sm:grid-cols-1 sm:gap-1 sm:text-right">
        {(
          [
            ["Findings", last.coverage],
            ["Communication", last.communication],
            ["Comfort", last.comfort],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="sm:flex sm:items-baseline sm:justify-end sm:gap-2">
            <dt className="text-[12px] text-white/60">{k}</dt>
            <dd className="font-mono text-[14px] font-semibold tabular-nums">{pct(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
