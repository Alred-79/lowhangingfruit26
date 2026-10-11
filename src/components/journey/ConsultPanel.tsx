"use client";

import { useState } from "react";
import { Badge, Button, Select, Textarea, cx } from "@/components/ui";
import type { RunView } from "@/lib/journey/types";
import { Megaphone, Send } from "lucide-react";
import { Avatar, post, Spinner } from "./shared";

const ACT_LABEL: Record<string, string> = { request: "Request", question: "Question", information: "Information", checkback: "Check-back", confirmation: "Confirmation", callout: "Call-out", readback: "Read-back", answer: "Answer", correction: "Correction", clarifying_question: "Asks for clarification" };

/** Page any colleague, earlier or later in the journey, or call something out to the whole team. */
export default function ConsultPanel({ view, refresh, compact }: { view: RunView; refresh: () => void; compact?: boolean }) {
  const colleagues = view.stages.filter((s) => !s.isStudent);
  const owner = view.viewerIsOwner;
  // Faculty read a student's threads; they cannot send. They start on the first thread that has messages.
  const firstThread = view.messages.find((m) => m.thread.startsWith("consult:") || m.thread === "callout")?.thread;
  const [to, setTo] = useState((!owner && firstThread ? (firstThread === "callout" ? "team" : firstThread.slice(8)) : "") || colleagues[0]?.stage.id || "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const target = to === "team" ? null : colleagues.find((s) => s.stage.id === to);
  const thread = view.messages.filter((m) => (to === "team" ? m.thread === "callout" : m.thread === `consult:${to}`));

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr("");
    const r = await post(`/api/journeys/runs/${view.id}/consult`, to === "team" ? { callout: true, text } : { toStageId: to, text });
    setBusy(false);
    if (r.error) return setErr(r.error);
    setText("");
    refresh();
  }

  if (!view.viewerIsOwner && !view.messages.some((m) => m.thread.startsWith("consult:") || m.thread === "callout")) return <p className="rounded-2xl border-2 border-dashed border-brand-200 px-4 py-4 text-sm text-ink-3">The student did not message any colleague outside the handoff order.</p>;
  return (
    <div className="space-y-3">
      {owner ? (
        <div>
          <label htmlFor="consult-to" className="mb-1.5 block text-[12.5px] font-bold text-ink-2">Who do you want to reach?</label>
          <Select id="consult-to" value={to} onChange={(e) => setTo(e.target.value)}>
            {colleagues.map((s) => (
              <option key={s.stage.id} value={s.stage.id}>
                {s.clinicianName}, {s.stage.roleTitle} ({s.status === "complete" ? "has seen the patient" : "has not seen the patient yet"})
              </option>
            ))}
            <option value="team">Whole team (call-out)</option>
          </Select>
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-ink-2 ring-1 ring-inset ring-brand-100">{to === "team" ? <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden /> : <Send className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />}<span>
            {to === "team"
              ? "A call-out announces critical information to everyone at once. Each colleague reads it back."
              : target?.status === "complete"
                ? "Ask for clarification of something they recorded, or request a consult."
                : "They know only the shared record so far. You can tell them what to look out for when they see the patient."}
          </span></p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5" aria-label="The student's message threads">
          {[...colleagues.map((s) => ({ id: s.stage.id, label: `${s.clinicianName}, ${s.stage.roleTitle}`, n: view.messages.filter((m) => m.thread === `consult:${s.stage.id}`).length })), { id: "team", label: "Call-outs to the whole team", n: view.messages.filter((m) => m.thread === "callout").length }]
            .filter((t) => t.n > 0)
            .map((t) => (
              <button key={t.id} type="button" aria-pressed={to === t.id} onClick={() => setTo(t.id)} className={cx("press inline-flex min-h-9 items-center gap-2 rounded-full pl-3 pr-1 text-xs font-bold pointer-coarse:min-h-11", to === t.id ? "bg-ink text-white" : "bg-surface text-ink-2 ring-1 ring-inset ring-line hover:ring-brand-300")}>
                {t.label} <span className={cx("grid h-6 min-w-6 place-items-center rounded-full px-1 font-mono", to === t.id ? "bg-[var(--color-xp)] text-ink" : "bg-surface-2 text-ink-2")}>({t.n})</span>
              </button>
            ))}
        </div>
      )}
      {thread.length > 0 && (
        <ol className={cx("scroll-quiet space-y-2.5 overflow-y-auto rounded-2xl bg-surface-2 p-2.5", compact ? "max-h-64" : "max-h-96")}>
          {thread.map((m) => (
            <li key={m.id} className={cx("flex max-w-[94%] items-start gap-2", !m.fromIsAi && "ml-auto flex-row-reverse")}>
              <Avatar name={m.fromIsAi ? m.fromName : view.studentName} you={!m.fromIsAi} className="h-7 w-7 text-[10.5px]" />
              <div className={cx("min-w-0 rounded-2xl px-3 py-2 text-[13.5px] leading-relaxed text-ink", m.fromIsAi ? "rounded-tl-md bg-surface" : "rounded-tr-md bg-[var(--color-mastery-soft)]")}>
              <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-ink-3">
                {m.fromIsAi ? m.fromName : owner ? "You" : view.studentName}
                {m.meta?.act && ACT_LABEL[m.meta.act] && <Badge tone="slate">{ACT_LABEL[m.meta.act]}</Badge>}
                {m.meta?.loop === "closed" && <Badge tone="green">Loop closed</Badge>}
              </div>
              <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {view.viewerIsOwner && (
        <>
          <Textarea rows={compact ? 2 : 3} value={text} onChange={(e) => setText(e.target.value)} placeholder={to === "team" ? "State the critical information plainly, e.g. what you found and why everyone needs to know now." : thread.length ? "Reply. Repeating back what you understood closes the loop." : "Say what you need and why."} />
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={send} disabled={busy || !text.trim()}>{to === "team" ? <Megaphone className="h-3.5 w-3.5" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}{to === "team" ? "Call out to the team" : thread.length ? "Send reply" : "Send"}</Button>
            {busy && <Spinner label={to === "team" ? "Each colleague is reading the call-out back" : `${target?.clinicianName || "Colleague"} is replying from the shared record${target?.status === "complete" ? " and their own visit" : ""}`} hint="Usually 5 to 15 seconds" />}
            {err && <span className="text-sm font-semibold text-rose-700">{err}</span>}
          </div>
        </>
      )}
    </div>
  );
}
