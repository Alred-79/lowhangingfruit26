"use client";

import { CloudOff, TriangleAlert } from "lucide-react";
import { cx } from "@/components/ui";

// Model calls (Bedrock) can fail with long technical messages: signatures, credentials, throttling,
// timeouts. Show a plain sentence and what is kept, with the original text one click away.
const TECHNICAL = /(aws|bedrock|signature|credential|access key|throttl|ECONN|ETIMEDOUT|socket|fetch failed|status code|model|service|500|502|503|504|timed out|timeout)/i;

export function isServiceError(message: string) {
  return message.length > 140 || TECHNICAL.test(message);
}

export default function ErrorNote({ message, title, kept, className }: { message: string; title?: string; kept?: string; className?: string }) {
  const service = isServiceError(message);
  // When the title already says the first sentence, do not repeat it in the body.
  const t = (title || "").replace(/\.$/, "");
  const body = !service && t && message.startsWith(t) ? message.slice(t.length).replace(/^[.:]\s*/, "") : message;
  return (
    <div role="alert" className={cx("shake rounded-2xl bg-rose-50 px-3.5 py-3 text-[14px] text-rose-950 ring-2 ring-inset ring-rose-200", className)}>
      <div className="flex gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-600 text-white shadow-[0_6px_14px_-6px_rgb(225_29_72/0.7)]">
          {service ? <CloudOff className="h-[18px] w-[18px]" aria-hidden /> : <TriangleAlert className="h-[18px] w-[18px]" aria-hidden />}
        </span>
        <div className="min-w-0">
          <p className="font-display text-[15px] font-extrabold">{title || (service ? "The AI service did not answer." : "That did not work.")}</p>
          <p className="mt-0.5 leading-relaxed text-rose-900">
            {service ? "This is a problem with the model service, not with what you entered." : body} {kept}
          </p>
          {service && (
            <details className="mt-1.5">
              <summary className="cursor-pointer text-[12.5px] font-medium text-rose-800">Technical details</summary>
              <p className="mt-1 break-words font-mono text-[11.5px] leading-relaxed text-rose-900/80">{message}</p>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
