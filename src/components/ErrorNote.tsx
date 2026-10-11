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
    <div role="alert" className={cx("rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[14px] text-rose-950", className)}>
      <div className="flex gap-2.5">
        {service ? <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />}
        <div className="min-w-0">
          <p className="font-semibold">{title || (service ? "The AI service did not answer." : "That did not work.")}</p>
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
