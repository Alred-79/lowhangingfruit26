import { encounterFor } from "@/lib/access";
import { CALL_ENDED_MESSAGE, runTurn } from "@/lib/engine/encounter";
import { bad } from "@/lib/http";

/** Server-sent events: `delta` chunks of the patient's reply, then one `done` with the updated chart. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await encounterFor(id);
  if (r instanceof Response) return r;
  const text = String((await req.json().catch(() => ({}))).text || "").trim().slice(0, 2000);
  if (!text) return bad("Say something first");
  // The patient hung up: no more student messages. The client goes to the wrap-up, as for End visit.
  if (r.enc.state.endedBy) return Response.json({ error: CALL_ENDED_MESSAGE, code: "call_ended", endedBy: r.enc.state.endedBy }, { status: 409 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of runTurn(id, text)) controller.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
      } catch (e) {
        console.error(e);
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "error", message: (e as Error).message })}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
