"use client";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import "@/components/faculty/fac.css";
import { Button } from "@/components/ui";

async function post(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({ error: "Request failed" }));
  if (!res.ok || j.error) throw new Error(j.error || "Request failed");
  return j;
}

/** The join code students type in, with copy and regenerate. Shown big: it is read aloud and copied into slides. */
export function JoinCode({ courseId, code }: { courseId: string; code: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-label={`Join code ${code.split("").join(" ")}. Copy to clipboard`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable: the code is on screen */
          }
        }}
        className="press group flex flex-wrap gap-1.5 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-xp)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-ink)]"
      >
        {code.split("").map((ch, i) => (
          <span
            key={i + ch}
            className="pop-spring grid h-14 w-11 place-items-center rounded-xl bg-white/10 font-mono text-[30px] font-black text-[var(--color-xp)] ring-1 ring-inset ring-white/15 transition-colors group-hover:bg-white/15 sm:h-16 sm:w-12 sm:text-[34px]"
            style={{ ["--i" as string]: i }}
          >
            {ch}
          </span>
        ))}
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="!bg-[var(--color-xp)] !text-ink"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard unavailable: the code is on screen */
            }
          }}
        >
          {copied ? <Check className="fac-tick h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="!text-white/85 hover:!bg-white/10 hover:!text-white"
          disabled={busy}
          onClick={async () => {
            if (!confirm("Replace the join code? The current code stops working. Students already enrolled stay enrolled.")) return;
            setBusy(true);
            await post(`/api/courses/${courseId}`, "PATCH", { newCode: true }).catch((e) => alert(e.message));
            setBusy(false);
            router.refresh();
          }}
        >
          <RefreshCw className={busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden />
          New code
        </Button>
      </div>
    </div>
  );
}

export function RemoveStudent({ courseId, userId, name }: { courseId: string; userId: string; name: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        if (!confirm(`Remove ${name} from this course? Their past visits are kept.`)) return;
        await post(`/api/courses/${courseId}`, "PATCH", { removeStudentId: userId }).catch((e) => alert(e.message));
        router.refresh();
      }}
    >
      Remove
    </Button>
  );
}

/** Release held feedback to students, or hold it again. */
export function ReleaseFeedback({ assignmentId, released }: { assignmentId: string; released: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={released ? "secondary" : "primary"}
      size="sm"
      disabled={busy}
      onClick={async () => {
        if (!released && !confirm("Release feedback? Every student who has submitted will be able to see their scores and feedback.")) return;
        setBusy(true);
        await post(`/api/assignments/${assignmentId}/release`, "POST", { released: !released }).catch((e) => alert(e.message));
        setBusy(false);
        router.refresh();
      }}
    >
      {busy ? "Saving…" : released ? "Hold feedback again" : "Release feedback"}
    </Button>
  );
}

export function DeleteAssignment({ assignmentId, courseId }: { assignmentId: string; courseId: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        if (!confirm("Delete this assignment?")) return;
        try {
          await post(`/api/assignments/${assignmentId}`, "DELETE");
          router.push(`/faculty/courses/${courseId}`);
        } catch (e) {
          alert((e as Error).message);
        }
      }}
    >
      Delete
    </Button>
  );
}
