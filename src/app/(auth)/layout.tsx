import { FileJson2, KeyRound, Quote } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Logo } from "@/components/Brand";
import Aurora from "@/components/game/Aurora";
import OrbStage from "@/components/landing/OrbStage";

const v = (o: Record<string, string | number>) => o as CSSProperties;
const TIERS = [
  { label: "Volunteered", c: "#33dbca", w: "100%" },
  { label: "When asked", c: "#5ca3ff", w: "82%" },
  { label: "Needs trust", c: "#ffb22e", w: "55%" },
  { label: "Guarded", c: "#ff6b4a", w: "28%" },
];

/** The three proof points, each with its own small living demonstration (CSS only; still under reduced motion). */
function ProofTiles() {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      <li className="rise rounded-[22px] bg-white/[0.07] p-4 ring-1 ring-white/12" style={v({ "--i": 3 })}>
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--color-xp)] text-ink">
            <FileJson2 className="h-4 w-4" aria-hidden />
          </span>
          <span className="font-display text-[28px] font-black leading-none tabular">
            <span className="count-up" aria-hidden style={v({ "--to": 81 })} />
            <span className="sr-only">81</span>
          </span>
        </div>
        <p className="mt-2 text-[14px] font-bold leading-snug">Cases are data</p>
        <p className="mt-0.5 text-[13px] leading-snug text-white/75">81 patients across 63 learner roles, each one a file faculty can read and edit.</p>
      </li>
      <li className="rise rounded-[22px] bg-white/[0.07] p-4 ring-1 ring-white/12" style={v({ "--i": 4 })}>
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#ffb22e] text-ink">
            <KeyRound className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-[14px] font-bold leading-snug">Code gates disclosure</span>
        </div>
        <ul className="mt-2.5 space-y-1.5" aria-label="Four disclosure tiers, from volunteered to guarded">
          {TIERS.map((t, i) => (
            <li key={t.label} className="flex items-center gap-2 text-[11.5px] font-semibold text-white/85">
              <span className="w-[4.6rem] shrink-0">{t.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/12">
                <span className="tier-fill block h-full rounded-full" style={v({ width: t.w, background: t.c, "--d": `${i * 0.35}s` })} />
              </span>
            </li>
          ))}
        </ul>
      </li>
      <li className="rise rounded-[22px] bg-white/[0.07] p-4 ring-1 ring-white/12" style={v({ "--i": 5 })}>
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#ff6b4a] text-ink">
            <Quote className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-[14px] font-bold leading-snug">Feedback with evidence</span>
        </div>
        <p className="mt-2.5 rounded-xl bg-white/10 px-2.5 py-2 text-[12.5px] leading-snug text-white/90">
          <span className="quote-mark">&ldquo;That sounds really frightening.&rdquo;</span>
        </p>
        <p className="mt-1.5 flex items-center justify-between text-[11.5px] font-semibold text-white/75">
          <span>Empathy, turn 4</span>
          <span className="rounded-full bg-[var(--color-xp)] px-2 py-0.5 font-mono text-ink">4 / 4</span>
        </p>
      </li>
    </ul>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-full overflow-hidden bg-stage text-white">
      <Aurora dark />
      {/* Phones: headline, then the form, then the show. Wide screens: the show on the left, the form on the right. */}
      <div className="auth-grid relative min-h-full">
        <header className="relative z-10 px-5 pt-5 sm:px-10 sm:pt-9 xl:max-w-[31rem] xl:pr-0" style={{ gridArea: "head" }}>
          <Logo inverse />
          <h1 className="rise mt-6 font-display text-[clamp(2.3rem,4.4vw,4.1rem)] font-black leading-[0.98] tracking-[-0.035em] lg:mt-14">
            Practise the <span className="hl hl-lime">visit</span> before the <span className="hl hl-pink">visit.</span>
          </h1>
          <p className="rise mt-4 max-w-lg text-[17px] leading-relaxed text-white/85 lg:mt-5" style={v({ "--i": 2 })}>
            Talk to a virtual patient on video. Earn their trust, unlock their story, and see exactly which words did it.
          </p>
        </header>
        <section className="px-5 pb-6 sm:px-10" style={{ gridArea: "show" }} aria-label="How Poscere works">
          <div className="grid items-center gap-4 pb-5 pt-2 xl:-mt-[15rem] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:pb-6 xl:pt-0">
            <div className="hidden xl:block" />
            <OrbStage className="mx-auto w-full max-w-[17rem] sm:max-w-[22rem] xl:max-w-[27rem]" />
          </div>
          <ProofTiles />
          <p className="mt-5 text-[12.5px] text-white/65">Synthetic patients for education only. Not for clinical use.</p>
        </section>
        <div className="flex items-start justify-center px-4 py-6 sm:px-10 lg:items-center lg:py-10" style={{ gridArea: "form" }}>
          <div className="rise w-full max-w-[26rem] rounded-[28px] bg-surface p-6 text-ink shadow-e3 ring-1 ring-white/30 sm:p-8" style={v({ "--i": 3 })}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
