import { encounterFor } from "@/lib/access";
import { chartView, messagesOf } from "@/lib/engine/encounter";
import { profession } from "@/lib/professions";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await encounterFor((await ctx.params).id, { faculty: "also" });
  if (r instanceof Response) return r;
  const { row, c, cfg, state } = r.enc;
  const role = profession(cfg.professionId);
  return Response.json({
    id: row.id,
    status: row.status,
    mode: cfg.mode,
    attempt: row.attempt,
    level: cfg.knobs.level,
    hints: cfg.knobs.hints,
    canRewind: cfg.mode !== "exam" && cfg.mode !== "journey",
    liveAssist: !!cfg.liveAssist,
    timeLimitMin: cfg.knobs.timeLimitMin,
    startedAt: row.started_at,
    pauseNote: row.pause_note,
    role: { name: role.name, roleTitle: role.roleTitle, noteFormat: role.noteFormat, wrapUp: role.wrapUp },
    journeyRunId: row.journey_run_id,
    priorContext: cfg.journey?.priorContext || null,
    chart: chartView(c, cfg, state),
    messages: messagesOf(row.id).map((m) => ({ id: m.id, turn: m.turn, speaker: m.speaker, text: m.text })),
  });
}
