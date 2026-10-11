"use client";

import { Captions, CaptionsOff, Check, Clock, FlaskConical, Lightbulb, MessageSquareText, Mic, MicOff, PhoneOff, RotateCcw, SendHorizontal, ShieldAlert, Users, Video, VideoOff, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Mark } from "@/components/Brand";
import JourneyChartTab from "@/components/journey/JourneyChartTab";
import TrustLabel from "@/components/TrustLabel";
import type { ChartView } from "@/lib/engine/encounter";
import ErrorNote from "@/components/ErrorNote";
import ChartPanel from "./ChartPanel";

interface Msg {
  id: number;
  turn: number;
  speaker: "student" | "patient" | "system" | "instructor" | "coach" | "clinician";
  text: string;
}
interface VisitData {
  id: string;
  status: "active" | "paused" | "submitted" | "scored" | "abandoned";
  mode: string;
  attempt: number;
  visitNumber: number;
  recorded: boolean;
  level: number;
  hints: boolean;
  canRewind: boolean;
  liveAssist: boolean;
  timeLimitMin: number | null;
  startedAt: string;
  pauseNote: string | null;
  pausedAt: string | null;
  role: { name: string; roleTitle: string; noteFormat: string; wrapUp: { id: string; label: string; placeholder?: string }[] };
  journeyRunId: string | null;
  priorContext: string | null;
  chart: ChartView;
  messages: Msg[];
}

// Minimal typing for the browser speech recognition API (Chrome, Edge, Safari).
interface SpeechRec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

const MODE_LABEL: Record<string, string> = { practice: "Practice", adaptive: "Adaptive practice", homework: "Homework", exam: "Exam", journey: "Care journey" };
const fmt = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const stripCues = (t: string) => t.replace(/\*[^*]*\*/g, " ").replace(/\s+/g, " ").trim();
const OUTSIDE = "Outside the case record";

const noop = () => () => {};
const hasSpeech = () => "SpeechRecognition" in window || "webkitSpeechRecognition" in window;

/** Patient comfort on the stage: the number, a banded bar and the last change. Practice only. */
function ComfortGauge({ value, delta }: { value: number; delta: number }) {
  const tone = value >= 60 ? "bg-emerald-400" : value >= 40 ? "bg-amber-400" : "bg-rose-400";
  const word = value >= 60 ? "at ease" : value >= 40 ? "guarded" : "uneasy";
  return (
    <div
      className="flex items-center gap-2.5 rounded-full bg-black/45 py-1.5 pl-3 pr-2 text-white ring-1 ring-white/10 backdrop-blur-sm"
      title="How comfortable the patient is with you. It rises with empathy, clear purpose and open questions, and falls with judgment, jargon or rushing. Reluctant facts need it. Shown in practice only."
    >
      <span className="text-[11.5px] text-white/75">Comfort</span>
      <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-white/20 sm:w-24" role="meter" aria-label="Patient comfort" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <span className={`absolute inset-y-0 left-0 w-full origin-left rounded-full transition-transform duration-700 ease-[var(--ease-in-out-ui)] ${tone}`} style={{ transform: `scaleX(${value / 100})` }} />
        <span className="absolute inset-y-0 left-[40%] w-px bg-black/40" aria-hidden />
        <span className="absolute inset-y-0 left-[60%] w-px bg-black/40" aria-hidden />
      </span>
      <span className="font-mono text-[12.5px] tabular-nums">{value}</span>
      <span className="hidden text-[11.5px] text-white/65 sm:inline">{word}</span>
      {delta !== 0 && (
        <span key={`${value}-${delta}`} className={`pop-in rounded-full px-1.5 font-mono text-[11.5px] font-semibold tabular-nums ${delta > 0 ? "bg-emerald-400/20 text-emerald-200" : "bg-rose-400/20 text-rose-200"}`}>
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      )}
    </div>
  );
}

function CallButton({ on, onClick, label, disabled, children }: { on: boolean; onClick: () => void; label: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={on}
      className={`press grid h-11 w-11 place-items-center rounded-full transition-colors disabled:opacity-40 ${on ? "bg-white/15 text-white ring-1 ring-white/15 hover:bg-white/25" : "bg-white text-stage hover:bg-white/90"}`}
    >
      {children}
    </button>
  );
}

/** A patient line that also says what it put in the chart, linked to the chart. */
function FiledChip({ n, onClick }: { n: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="fade-in mt-1 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2 py-0.5 text-[11.5px] font-medium text-brand-800 ring-1 ring-inset ring-brand-200 hover:bg-brand-100">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
      Filed {n} {n === 1 ? "finding" : "findings"} to the chart
    </button>
  );
}

function SystemNote({ m }: { m: Msg }) {
  if (m.speaker === "system" && m.text.startsWith(OUTSIDE)) {
    const body = m.text.slice(OUTSIDE.length).replace(/^:\s*/, "");
    return (
      <div role="note" className="fade-in rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-900">
        <div className="mb-0.5 flex items-center gap-1.5 font-semibold">
          <ShieldAlert className="h-4 w-4 text-rose-600" aria-hidden />
          {OUTSIDE}
          <span className="ml-auto font-mono text-[11px] font-normal text-rose-700/80">T{m.turn}</span>
        </div>
        <p className="leading-relaxed">{body}</p>
      </div>
    );
  }
  if (m.speaker === "system" && m.text.startsWith("Requested:")) {
    const [head, ...lines] = m.text.split("\n");
    return (
      <div className="rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-ink-2">
        <div className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
          <FlaskConical className="h-3.5 w-3.5 text-amber-700" aria-hidden />
          Order
          <span className="font-normal text-ink-2">{head.replace(/^Requested:\s*/, "")}</span>
          <span className="ml-auto font-mono text-[11px] font-normal text-ink-3">T{m.turn}</span>
        </div>
        {lines.length > 0 && <div className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink-2">{lines.join("\n")}</div>}
      </div>
    );
  }
  const kind = m.speaker === "coach" ? { label: "Coach", cls: "border-amber-200 bg-amber-50 text-amber-950", Icon: Lightbulb, ic: "text-amber-600" } : m.speaker === "instructor" ? { label: "Instructor", cls: "border-violet-200 bg-violet-50 text-violet-950", Icon: MessageSquareText, ic: "text-violet-600" } : m.speaker === "clinician" ? { label: "Colleague", cls: "border-sky-200 bg-sky-50 text-sky-950", Icon: Users, ic: "text-sky-600" } : { label: "Chart", cls: "border-line bg-surface-2 text-ink-2", Icon: FlaskConical, ic: "text-ink-3" };
  return (
    <div className={`fade-in whitespace-pre-wrap rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed ${kind.cls}`}>
      <span className="mb-0.5 flex items-center gap-1.5 text-[12px] font-semibold">
        <kind.Icon className={`h-3.5 w-3.5 ${kind.ic}`} aria-hidden />
        {kind.label}
      </span>
      {m.text}
    </div>
  );
}

export default function Visit({ id, viewerName }: { id: string; viewerName: string }) {
  const router = useRouter();
  const [data, setData] = useState<VisitData | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chart, setChart] = useState<ChartView | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null); // patient reply being streamed
  const [busy, setBusy] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const micSupported = useSyncExternalStore(noop, hasSpeech, () => true);
  const [interim, setInterim] = useState("");
  const [speakerOn, setSpeakerOn] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [wrapOpen, setWrapOpen] = useState(false);
  const [timeUpDismissed, setTimeUpDismissed] = useState(false);
  const [wrap, setWrap] = useState<Record<string, string>>({});
  const [scoring, setScoring] = useState(false);
  const [lastDelta, setLastDelta] = useState(0);
  const [recTick, setRecTick] = useState(0);
  const [focus, setFocus] = useState<{ turn: number; key: number } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const selfRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const live = useRef({ busy: false });
  live.current = { busy };

  const load = useCallback(async () => {
    const res = await fetch(`/api/encounters/${id}`, { cache: "no-store" });
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || "Could not load this visit.");
    const d: VisitData = await res.json();
    setData(d);
    setChart((c) => (live.current.busy && c ? c : d.chart));
    // Keep optimistic local messages while a turn is in flight.
    setMessages((m) => (live.current.busy ? m : d.messages));
    if (d.messages.length) setJoined(true);
    return d;
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Live assist: the instructor may pause or send a note at any time.
  useEffect(() => {
    if (!data?.liveAssist || data.status === "scored") return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [data?.liveAssist, data?.status, load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);
  // Focus the message box once the call is joined, on wide screens (phones keep the patient in view).
  useEffect(() => {
    if (joined && window.matchMedia("(min-width: 1024px)").matches) inputRef.current?.focus();
  }, [joined]);

  const paused = data?.status === "paused";
  const ended = data?.status === "submitted" || data?.status === "scored";
  const utc = (t: string) => new Date(t.replace(" ", "T") + "Z").getTime();
  // The clock does not run in the waiting room or while an instructor has the visit paused.
  const clockNow = data?.pausedAt ? utc(data.pausedAt) : now;
  const elapsed = data && joined ? Math.max(0, Math.floor((clockNow - utc(data.startedAt)) / 1000)) : 0;
  const remaining = data?.timeLimitMin ? data.timeLimitMin * 60 - elapsed : null;

  // When the clock runs out, open the write-up; the student can still go back for a closing sentence.
  const timeUp = remaining !== null && remaining <= 0;
  const showWrap = wrapOpen || (timeUp && joined && !ended && !timeUpDismissed);

  // Speech is synthesised sentence by sentence so the patient starts talking while the reply is still arriving.
  const voice = useRef<{ gen: number; queue: Promise<string | null>[]; playing: boolean }>({ gen: 0, queue: [], playing: false });
  function stopVoice() {
    voice.current.gen += 1;
    voice.current.queue = [];
    voice.current.playing = false;
    audioRef.current?.pause();
    setSpeaking(false);
  }
  function pump() {
    const v = voice.current;
    if (v.playing) return;
    const next = v.queue.shift();
    if (!next) return setSpeaking(false);
    v.playing = true;
    setSpeaking(true);
    const gen = v.gen;
    next.then((url) => {
      if (gen !== voice.current.gen) return;
      const a = audioRef.current;
      if (!url || !a) {
        v.playing = false;
        return pump();
      }
      a.src = url;
      a.play().catch(() => {
        v.playing = false;
        pump();
      });
    });
  }
  function speak(text: string) {
    if (!speakerOn || !text.replace(/\*[^*]*\*/g, "").trim()) return;
    const gen = voice.current.gen;
    voice.current.queue.push(
      fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ e: id, text }) })
        .then((r) => (r.ok && r.status !== 204 ? r.blob() : null))
        .then((b) => (b && gen === voice.current.gen ? URL.createObjectURL(b) : null))
        .catch(() => null),
    );
    pump();
  }
  function onAudioDone() {
    voice.current.playing = false;
    pump();
  }

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || live.current.busy) return;
      setError(null);
      setBusy(true);
      setInput("");
      setInterim("");
      stopVoice();
      const turn = (chart?.turn || 0) + 1;
      setMessages((m) => [...m, { id: -Date.now(), turn, speaker: "student", text }]);
      setPending("");
      try {
        const res = await fetch(`/api/encounters/${id}/message`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
        if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || "The message could not be sent.");
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let acc = "";
        let spokenTo = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 2);
            if (!line.startsWith("data:")) continue;
            const ev = JSON.parse(line.slice(5));
            if (ev.type === "delta") {
              acc += ev.text;
              setPending(acc);
              // Hand each finished sentence to the voice as soon as it is complete.
              const rest = acc.slice(spokenTo);
              const m = rest.match(/^[\s\S]*[.!?]["']?(?=\s)/);
              if (m && m[0].trim().length > 12) {
                speak(m[0]);
                spokenTo += m[0].length;
              }
            } else if (ev.type === "done") {
              setMessages((m) => [...m, { id: ev.messageId, turn, speaker: "patient", text: ev.text }, ...(ev.notice ? [{ id: ev.messageId + 0.5, turn, speaker: "system" as const, text: ev.notice }] : [])]);
              setPending(null);
              const before = new Set([...(chart?.sections.flatMap((s) => s.items.map((x) => x.id)) || []), ...(chart?.artifacts.map((a) => a.id) || [])]);
              const after: ChartView = ev.chart;
              setFresh(new Set([...after.sections.flatMap((s) => s.items.map((x) => x.id)), ...after.artifacts.map((a) => a.id)].filter((x) => !before.has(x))));
              setChart(after);
              setLastDelta(ev.rapportDelta);
              speak(acc.slice(spokenTo));
            } else if (ev.type === "error") {
              throw new Error(ev.message);
            }
          }
        }
      } catch (e) {
        setPending(null);
        setMessages((m) => m.filter((x) => x.id > 0));
        setInput(text);
        setError((e as Error).message);
        load();
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, chart, speakerOn],
  );

  // Hands-free mic: listen whenever the patient is not talking and nothing is in flight.
  useEffect(() => {
    const idle = micOn && joined && !busy && !speaking && !paused && !ended && !showWrap;
    if (!idle) return;
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    let finalText = "";
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else live += e.results[i][0].transcript;
      }
      setInterim(finalText + live);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMicOn(false);
        setError("Microphone access was blocked. Allow it in the browser, or type instead.");
      }
    };
    rec.onend = () => {
      recRef.current = null;
      if (finalText.trim()) send(finalText);
      // Silence timed out: start listening again.
      else setRecTick((n) => n + 1);
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {}
    return () => {
      rec.onend = null;
      rec.abort();
      recRef.current = null;
    };
  }, [micOn, joined, busy, speaking, paused, ended, showWrap, send, recTick]);

  async function toggleCam() {
    if (camOn) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCamOn(false);
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      streamRef.current = s;
      setCamOn(true);
      setTimeout(() => {
        if (selfRef.current) selfRef.current.srcObject = s;
      }, 0);
    } catch {
      setError("Camera access was blocked. The visit works without it.");
    }
  }
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  async function order(request: string) {
    setOrdering(true);
    setError(null);
    try {
      const res = await fetch(`/api/encounters/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      const before = new Set([...(chart?.results.map((r) => r.id) || []), ...(chart?.artifacts.map((a) => a.id) || [])]);
      setFresh(new Set([...j.chart.results.map((r: { id: string }) => r.id), ...j.chart.artifacts.map((a: { id: string }) => a.id)].filter((x: string) => !before.has(x))));
      setChart(j.chart);
      const d = await load();
      if (d) setMessages(d.messages);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOrdering(false);
    }
  }

  async function askHint() {
    const res = await fetch(`/api/encounters/${id}/hint`, { method: "POST" });
    const j = await res.json();
    if (j.text) setMessages((m) => [...m, { id: Date.now(), turn: chart?.turn || 0, speaker: "coach", text: j.text }]);
  }

  async function rewindTo(turn: number) {
    if (!confirm("Go back to just before this message and try it a different way? Your current visit stays saved.")) return;
    const res = await fetch(`/api/encounters/${id}/rewind`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turn }) });
    const j = await res.json();
    if (j.id) router.push(`/encounter/${j.id}`);
    else setError(j.error || "Could not rewind.");
  }

  async function submit() {
    setScoring(true);
    setMicOn(false);
    stopVoice();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const res = await fetch(`/api/encounters/${id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wrapup: wrap }) });
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      router.push(data?.journeyRunId ? `/journey/${data.journeyRunId}` : `/encounter/${id}/feedback`);
    } catch (e) {
      setScoring(false);
      setError("Scoring did not finish: " + (e as Error).message + " Your visit and notes are saved; try again.");
    }
  }

  function closeWrap() {
    setWrapOpen(false);
    if (timeUp) setTimeUpDismissed(true);
  }

  // Facts filed per turn, read from the chart ledger (never from the model's words).
  const filedByTurn = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of chart?.sections || []) for (const it of s.items) if (it.how !== "record") m.set(it.turn, (m.get(it.turn) || 0) + 1);
    return m;
  }, [chart]);
  const ledger = useMemo(() => {
    if (!chart) return null;
    const facts = chart.sections.reduce((n, s) => n + s.items.filter((i) => i.how !== "record").length, 0);
    return { facts, results: chart.results.length, docs: chart.artifacts.filter((a) => a.turn > 0).length };
  }, [chart]);

  // A slight 3D tilt of the portrait toward the pointer: fine pointers only, never under reduced motion.
  function onStageMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = tiltRef.current;
    if (!el || e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1200px) rotateY(${x * 3}deg) rotateX(${-y * 2}deg) scale(1.03)`;
  }
  function onStageLeave() {
    if (tiltRef.current) tiltRef.current.style.transform = "";
  }

  if (error && !data) return <div className="grid h-dvh place-items-center bg-canvas px-6 text-center text-ink-2">{error}</div>;
  if (!data || !chart)
    return (
      <div className="grid h-dvh place-items-center bg-stage text-white/70">
        <div className="flex items-center gap-3 text-sm">
          <span className="live-dot h-2 w-2 rounded-full bg-[oklch(0.82_0.15_168)]" aria-hidden />
          Connecting to the visit…
        </div>
      </div>
    );
  if (ended && !scoring) {
    return (
      <div className="grid h-dvh place-items-center bg-canvas px-6">
        <div className="max-w-sm text-center">
          <Mark className="mx-auto mb-4 h-10 w-10" />
          <p className="font-display text-xl font-semibold text-ink">This visit has ended.</p>
          <p className="mt-1 text-sm text-ink-3">{data.status === "scored" ? "Your feedback is ready." : "It was submitted but scoring did not finish."}</p>
          <Link href={data.journeyRunId ? `/journey/${data.journeyRunId}` : `/encounter/${id}/feedback`} className="press mt-5 inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-medium text-white hover:bg-brand-700">
            {data.status === "scored" ? "View feedback" : "Finish scoring"}
          </Link>
        </div>
      </div>
    );
  }

  const p = chart.patient;
  const caption = pending !== null ? pending : speaking ? [...messages].reverse().find((m) => m.speaker === "patient")?.text || "" : "";
  const patientTalking = speaking || (pending !== null && pending.length > 0);
  const firstName = p.name.split(" ")[0];
  const captionText = (() => {
    const t = stripCues(caption);
    return t.length > 190 ? "… " + t.slice(t.length - 190).replace(/^\S*\s/, "") : t || "…";
  })();
  const lowTime = remaining !== null && remaining < 120;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:h-dvh">
      <audio ref={audioRef} onEnded={onAudioDone} onError={onAudioDone} hidden />

      {/* Top bar */}
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line bg-surface px-3 py-2 sm:px-4">
        <Link href="/" aria-label="Rounds home" className="shrink-0">
          <Mark className="h-7 w-7" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] text-ink-2">
            Video visit with <span className="font-semibold text-ink">{p.name}</span>
          </div>
          <div className="mt-0.5 hidden flex-wrap items-center gap-1.5 sm:flex">
            <TrustLabel kind={data.recorded ? "recorded" : "private"} />
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11.5px] font-medium text-ink-2">{MODE_LABEL[data.mode] || data.mode}</span>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11.5px] text-ink-2">Level {data.level}</span>
            {data.visitNumber > 1 ? <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[11.5px] font-medium text-sky-800 ring-1 ring-inset ring-sky-200">Follow-up · visit {data.visitNumber}</span> : data.attempt > 1 && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11.5px] text-ink-2">Attempt {data.attempt}</span>}
            {data.liveAssist && <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[11.5px] font-medium text-violet-800 ring-1 ring-inset ring-violet-200">Instructor can join</span>}
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[13px] tabular-nums ${lowTime ? "bg-rose-50 font-semibold text-rose-700" : "text-ink-2"}`} aria-label={remaining !== null ? `${fmt(remaining)} left` : `${fmt(elapsed)} elapsed`}>
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {remaining !== null ? `${fmt(remaining)} left` : fmt(elapsed)}
        </span>
        {data.hints && joined && (
          <button onClick={askHint} disabled={busy} className="press inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 text-[13px] font-medium text-amber-900 ring-1 ring-inset ring-amber-300 hover:bg-amber-100 disabled:opacity-50">
            <Lightbulb className="h-3.5 w-3.5" aria-hidden />
            <span className="max-sm:sr-only">Coach hint</span>
          </button>
        )}
        <button onClick={() => setWrapOpen(true)} disabled={!joined} className="press inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-[13px] font-medium text-white hover:bg-rose-700 disabled:bg-slate-300">
          <PhoneOff className="h-3.5 w-3.5" aria-hidden />
          <span className="max-sm:sr-only">End visit</span>
        </button>
        <div className="flex w-full flex-wrap items-center gap-1.5 sm:hidden">
          <TrustLabel kind={data.recorded ? "recorded" : "private"} />
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11.5px] text-ink-2">
            {MODE_LABEL[data.mode] || data.mode} · Level {data.level}
          </span>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-[minmax(0,1fr)] gap-3 p-3 lg:min-h-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* LEFT: the call */}
        <div className="flex flex-col gap-3 lg:min-h-0">
          <div className="relative h-[300px] shrink-0 overflow-hidden rounded-2xl bg-stage sm:h-[340px] lg:h-[46%] lg:min-h-[260px]" onPointerMove={onStageMove} onPointerLeave={onStageLeave}>
            <div ref={tiltRef} className="absolute inset-0 transition-transform duration-500 ease-[var(--ease-out-ui)]">
              {p.portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.portrait} alt={p.name} className={`h-full w-full object-cover object-[50%_28%] transition-transform duration-700 ${patientTalking ? "scale-[1.015]" : ""}`} />
              ) : (
                <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_40%,var(--color-stage-3),var(--color-stage))]">
                  <div className={`grid h-28 w-28 place-items-center rounded-full bg-brand-700 font-display text-4xl font-semibold text-white ${patientTalking ? "speak-ring" : ""}`}>{initials(p.name)}</div>
                </div>
              )}
            </div>
            {/* Speaking state: an outline, not a glow. */}
            <div className={`pointer-events-none absolute inset-0 rounded-2xl transition-shadow duration-200 ${patientTalking ? "shadow-[inset_0_0_0_3px_oklch(0.82_0.15_168/0.9)]" : ""}`} />
            <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white ring-1 ring-white/10 backdrop-blur-sm">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden /> LIVE
              </span>
              {chart.rapport !== null && joined && <ComfortGauge value={chart.rapport} delta={lastDelta} />}
            </div>
            {/* Self view */}
            <div className="absolute right-3 top-3 h-16 w-[5.5rem] overflow-hidden rounded-xl bg-stage-2 ring-1 ring-white/15 sm:h-24 sm:w-32">
              {camOn ? <video ref={selfRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" /> : <div className="grid h-full place-items-center font-display text-lg font-semibold text-white/50">{initials(viewerName)}</div>}
              <span className="absolute bottom-1 left-1.5 text-[10.5px] text-white/80">You</span>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pb-3 pt-14">
              {captionsOn && caption && (
                <p aria-live="polite" className="mb-2 max-w-[60ch] text-[15.5px] leading-snug text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
                  {captionText}
                </p>
              )}
              {micOn && !patientTalking && !busy && (
                <p className="mb-2 flex items-center gap-2 text-[13.5px] text-emerald-200">
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden />
                  {interim ? `You: ${interim}` : "Listening… speak to the patient"}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2.5">
                <div className="min-w-0 text-[14px] font-semibold text-white">
                  {p.name}
                  <span className="ml-2 text-[12.5px] font-normal text-white/70">{patientTalking ? "speaking" : busy ? "thinking…" : chart.emotion}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CallButton on={micOn} onClick={() => setMicOn((v) => !v)} disabled={!micSupported} label={micSupported ? (micOn ? "Mute microphone" : "Talk with your microphone") : "Voice input needs Chrome, Edge or Safari"}>
                    {micOn ? <Mic className="h-[18px] w-[18px]" aria-hidden /> : <MicOff className="h-[18px] w-[18px]" aria-hidden />}
                  </CallButton>
                  <CallButton on={camOn} onClick={toggleCam} label={camOn ? "Turn camera off" : "Turn camera on"}>
                    {camOn ? <Video className="h-[18px] w-[18px]" aria-hidden /> : <VideoOff className="h-[18px] w-[18px]" aria-hidden />}
                  </CallButton>
                  <CallButton on={speakerOn} onClick={() => (setSpeakerOn((v) => !v), stopVoice())} label={speakerOn ? "Mute patient voice" : "Hear the patient"}>
                    {speakerOn ? <Volume2 className="h-[18px] w-[18px]" aria-hidden /> : <VolumeX className="h-[18px] w-[18px]" aria-hidden />}
                  </CallButton>
                  <CallButton on={captionsOn} onClick={() => setCaptionsOn((v) => !v)} label={captionsOn ? "Hide captions" : "Show captions"}>
                    {captionsOn ? <Captions className="h-[18px] w-[18px]" aria-hidden /> : <CaptionsOff className="h-[18px] w-[18px]" aria-hidden />}
                  </CallButton>
                  <span className="mx-0.5 h-6 w-px bg-white/20" aria-hidden />
                  <button onClick={() => setWrapOpen(true)} title="End visit" aria-label="End visit" className="press grid h-11 w-14 place-items-center rounded-full bg-rose-600 text-white hover:bg-rose-700">
                    <PhoneOff className="h-[18px] w-[18px]" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Conversation */}
          <section aria-label="Conversation" className="flex h-[58dvh] flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:h-auto lg:min-h-0 lg:flex-1">
            <div className="flex items-center justify-between border-b border-line/70 px-4 py-2">
              <h2 className="text-[13px] font-semibold text-ink">Conversation</h2>
              {ledger && (
                <span className="text-[12px] text-ink-3">
                  Turn <span className="font-mono tabular-nums text-ink-2">{chart.turn}</span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span className="font-mono tabular-nums text-ink-2">{ledger.facts}</span> {ledger.facts === 1 ? "finding" : "findings"} filed
                </span>
              )}
            </div>
            <div ref={logRef} className="scroll-quiet min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <div className="py-8 text-center">
                  <p className="font-display text-[17px] font-semibold text-ink">Start by introducing yourself to {firstName}.</p>
                  <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-3">Say who you are and why you are calling. What the patient tells you is filed in the chart on the right as you go.</p>
                </div>
              )}
              {messages.map((m) =>
                m.speaker === "student" ? (
                  <div key={m.id} className="group flex items-center justify-end gap-2">
                    {data.canRewind && m.id > 0 && !busy && (
                      <button onClick={() => rewindTo(m.turn - 1)} className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1 text-[12px] text-ink-3 opacity-0 transition-opacity hover:bg-slate-100 hover:text-brand-700 focus:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
                        <RotateCcw className="h-3 w-3" aria-hidden />
                        Try this again
                      </button>
                    )}
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-[14px] leading-relaxed text-white">{m.text}</div>
                  </div>
                ) : m.speaker === "patient" ? (
                  <div key={m.id} className="flex flex-col items-start">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2 text-[14px] leading-relaxed text-ink">
                      {m.text.split(/(\*[^*]+\*)/).map((part, i) => (part.startsWith("*") ? <em key={i} className="text-ink-3">{part.slice(1, -1)} </em> : <span key={i}>{part}</span>))}
                    </div>
                    {(filedByTurn.get(m.turn) || 0) > 0 && <FiledChip n={filedByTurn.get(m.turn)!} onClick={() => setFocus({ turn: m.turn, key: Date.now() })} />}
                  </div>
                ) : (
                  <SystemNote key={m.id} m={m} />
                ),
              )}
              {pending !== null && (
                <div className="flex">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2 text-[14px] leading-relaxed text-ink">
                    {stripCues(pending) || (
                      <span className="inline-flex items-center gap-2 text-ink-3">
                        <span className="flex gap-1" aria-hidden>
                          <span className="live-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
                          <span className="live-dot h-1.5 w-1.5 rounded-full bg-slate-400 [animation-delay:200ms]" />
                          <span className="live-dot h-1.5 w-1.5 rounded-full bg-slate-400 [animation-delay:400ms]" />
                        </span>
                        {firstName} is thinking…
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
            {error && <ErrorNote message={error} className="mx-3 mb-1 mt-2" title={/microphone|camera/i.test(error) ? error.split(".")[0] + "." : undefined} kept={/microphone|camera/i.test(error) ? "" : "Nothing was lost; anything you typed is back in the box."} />}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex gap-2 border-t border-line/70 p-2.5"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy || paused || !joined}
                placeholder={paused ? "Paused by your instructor" : micOn ? "Speak, or type here" : `Say something to ${firstName}`}
                aria-label={`Message to ${firstName}`}
                ref={inputRef}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-line-strong/60 bg-surface px-3.5 text-[14px] text-ink placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/20 disabled:bg-slate-50"
              />
              <button disabled={busy || paused || !input.trim()} className="press inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-[14px] font-medium text-white hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-500">
                Send
                <SendHorizontal className="h-4 w-4" aria-hidden />
              </button>
            </form>
          </section>
        </div>

        {/* RIGHT: the chart */}
        <div className="h-[85dvh] lg:h-auto lg:min-h-0">
          <ChartPanel chart={chart} fresh={fresh} onOrder={order} ordering={ordering} locked={paused || !joined} focus={focus} teamTab={data.journeyRunId ? <JourneyChartTab runId={data.journeyRunId} encounterId={id} /> : undefined} />
        </div>
      </div>

      {/* Waiting room */}
      {!joined && (
        <div className="scrim-in fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-stage/80 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="wr-title" className="pop-in grid max-h-full w-full max-w-3xl overflow-hidden rounded-2xl bg-surface shadow-e3 md:grid-cols-[15rem_minmax(0,1fr)]">
            <div className="relative hidden bg-stage md:block">
              {p.portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.portrait} alt="" className="h-full w-full object-cover object-[50%_28%] opacity-90" />
              ) : (
                <div className="grid h-full place-items-center">
                  <div className="grid h-24 w-24 place-items-center rounded-full bg-brand-700 font-display text-3xl font-semibold text-white">{initials(p.name)}</div>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-[12px] text-white/80">
                <span className="live-dot mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                {firstName} is in the waiting room
              </div>
            </div>
            <div className="flex min-h-0 flex-col">
              <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto p-6 pb-3">
                <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-medium text-brand-700">
                  Waiting room · {MODE_LABEL[data.mode] || data.mode}
                </div>
                <h1 id="wr-title" className="mt-1 font-display text-[24px] font-semibold leading-tight text-ink">
                  {p.name}, {p.age}
                </h1>
                <p className="mt-0.5 text-[14px] text-ink-3">You are joining as the {data.role.roleTitle}.</p>
                <p className="mt-4 whitespace-pre-line text-[14.5px] leading-relaxed text-ink">{chart.brief}</p>
                {chart.tasks.length > 0 && (
                  <>
                    <h2 className="mt-5 text-[13px] font-semibold text-ink-2">In this visit</h2>
                    <ul className="mt-1.5 space-y-1">
                      {chart.tasks.map((t, i) => (
                        <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-ink">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <div className="mt-5 rounded-xl bg-surface-2 p-3.5 text-[13px] leading-relaxed text-ink-2">
                  {data.timeLimitMin ? `You have ${data.timeLimitMin} minutes. ` : "No time limit. "}
                  Talk by microphone or type. The chart on the right fills in as you learn things; request exams, tests and records from its Results tab. When you are done, end the visit and write your {data.role.noteFormat} wrap-up.
                  {data.mode === "exam" && " This is an exam: no hints, and the comfort meter is hidden."}
                  {data.liveAssist && " Your instructor may watch this visit, pause it, or send you a note."}
                </div>
                <div className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-[13px] leading-relaxed ${data.recorded ? "bg-violet-50 text-violet-900" : "bg-slate-100 text-ink-2"}`}>
                  <TrustLabel kind={data.recorded ? "recorded" : "private"} className="mt-px shrink-0" />
                  <span>{data.recorded ? "Your instructor can see this visit, its transcript and its score." : "Only you see this visit and its feedback. It still updates your own progress."}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line px-6 py-4">
                <button
                  onClick={() => {
                    fetch(`/api/encounters/${id}/start`, { method: "POST" }).then(load).catch(() => {});
                    setJoined(true);
                    // Unlock audio playback inside the click.
                    audioRef.current?.play().catch(() => {});
                  }}
                  className="press inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-6 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] hover:bg-brand-700"
                >
                  <Video className="h-4 w-4" aria-hidden />
                  Join visit
                </button>
                {micSupported && (
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[14px] text-ink-2">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand-600)]" checked={micOn} onChange={(e) => setMicOn(e.target.checked)} /> Use my microphone
                  </label>
                )}
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[14px] text-ink-2">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand-600)]" checked={speakerOn} onChange={(e) => setSpeakerOn(e.target.checked)} /> Patient voice
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructor pause */}
      {paused && (
        <div className="scrim-in fixed inset-0 z-50 grid place-items-center bg-violet-950/75 p-4 backdrop-blur-sm">
          <div role="alertdialog" aria-modal="true" aria-label="Paused by your instructor" className="pop-in w-full max-w-md rounded-2xl bg-surface p-6 text-center shadow-e3">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-violet-100 text-violet-700">
              <MessageSquareText className="h-5 w-5" aria-hidden />
            </div>
            <div className="text-[13px] font-semibold text-violet-800">Paused by your instructor</div>
            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{data.pauseNote || "Take a moment. Your instructor will resume the visit shortly."}</p>
            <p className="mt-4 text-[12.5px] text-ink-3">The clock is stopped. The visit continues when they resume it.</p>
          </div>
        </div>
      )}

      {/* Wrap-up: a sheet over the chart, so the patient stays in view. */}
      {showWrap && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="scrim-in absolute inset-0 bg-ink/35" onClick={() => !scoring && closeWrap()} />
          <div role="dialog" aria-modal="true" aria-labelledby="wrap-title" className="sheet-in relative flex h-full w-full max-w-xl flex-col bg-surface shadow-e3">
            {scoring ? (
              <ScoringSteps />
            ) : (
              <>
                <div className="border-b border-line px-6 py-5">
                  <h2 id="wrap-title" className="font-display text-[22px] font-semibold text-ink">
                    {timeUp ? "Time is up. Write up the visit" : "End the visit and write up"}
                  </h2>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-2">
                    {data.role.noteFormat} for {p.name}. Your write-up is assessed along with the conversation. Before you leave: did you summarise, check understanding and agree next steps with {firstName}?
                  </p>
                </div>
                <div className="scroll-quiet min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                  {data.role.wrapUp.map((f) => (
                    <div key={f.id}>
                      <label htmlFor={`wrap-${f.id}`} className="mb-1.5 block text-[13px] font-semibold text-ink-2">
                        {f.label}
                      </label>
                      <textarea id={`wrap-${f.id}`} value={wrap[f.id] || ""} onChange={(e) => setWrap((w) => ({ ...w, [f.id]: e.target.value }))} placeholder={f.placeholder} rows={3} className="w-full rounded-xl border border-line-strong/60 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/20" />
                    </div>
                  ))}
                  {error && <ErrorNote message={error} title="Scoring did not finish." kept="Your visit and notes are saved; submit again." />}
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">
                  <button onClick={closeWrap} className="press inline-flex min-h-11 items-center rounded-xl px-4 text-[14px] font-medium text-ink-2 ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
                    Back to the patient
                  </button>
                  <button onClick={submit} className="press inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-5 text-[14px] font-semibold text-white hover:bg-brand-700">
                    Submit for feedback
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** What happens while the visit is scored. Steps 2 and 3 are one server call; the bar is an estimate. */
function ScoringSteps() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const i = setInterval(() => setT((Date.now() - start) / 1000), 250);
    return () => clearInterval(i);
  }, []);
  const steps = [
    { label: "Findings elicited and missed", detail: "Read straight from the disclosure ledger. No model involved.", done: t > 1.2 },
    { label: "Seven rubric domains scored", detail: "A model scores each domain and must quote your transcript with a turn number.", done: false },
    { label: "Every quote checked", detail: "Code looks each quote up in the transcript; a quote that is not there is dropped.", done: false },
  ];
  const pct = Math.min(95, (t / 60) * 100);
  return (
    <div className="flex h-full flex-col justify-center px-8 py-10" role="status" aria-live="polite">
      <h2 className="font-display text-[22px] font-semibold text-ink">Reviewing your visit</h2>
      <p className="mt-1 text-[14px] text-ink-2">Checking what you elicited against the case, then scoring the rubric with evidence from the transcript. This takes about a minute.</p>
      <ol className="mt-7 space-y-5">
        {steps.map((s, i) => {
          const active = !s.done && (i === 0 || steps[i - 1].done);
          return (
            <li key={s.label} className="flex gap-3">
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${s.done ? "bg-brand-600 text-white" : active || (i > 0 && steps[0].done) ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-500"}`}>
                {s.done ? <Check className="h-3.5 w-3.5" aria-label="done" /> : i + 1}
              </span>
              <span>
                <span className="block text-[14.5px] font-semibold text-ink">{s.label}</span>
                <span className="block text-[13px] leading-relaxed text-ink-3">{s.detail}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full origin-left rounded-full bg-brand-500 transition-transform duration-300 ease-linear" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <p className="mt-2 flex justify-between font-mono text-[12px] tabular-nums text-ink-3">
        <span>{Math.floor(t)} s</span>
        <span>estimated, about 60 s</span>
      </p>
    </div>
  );
}
