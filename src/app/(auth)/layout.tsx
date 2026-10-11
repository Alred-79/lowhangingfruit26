import type { ReactNode } from "react";
import { Logo } from "@/components/Brand";
import OrbStage from "@/components/landing/OrbStage";

const PROOF = [
  { n: "81", t: "patients across 63 learner roles, each one pure case data" },
  { n: "4", t: "disclosure tiers; code, not the model, decides what is released" },
  { n: "1", t: "disclosure ledger behind the chart, the feedback and the team record" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-full lg:grid-cols-[minmax(0,1.15fr)_minmax(26rem,1fr)]">
      {/* The one brand moment: the disclosure orb. */}
      <section className="relative hidden overflow-hidden bg-stage text-white lg:flex lg:flex-col" aria-label="About Poscere">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_42%,oklch(0.3_0.05_186/0.55),transparent_70%)]" />
        <div className="relative flex items-center gap-2 px-10 pt-9">
          <Logo inverse />
        </div>
        <div className="relative grid flex-1 grid-cols-[minmax(0,1fr)] items-center gap-6 px-10 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
          <div className="max-w-md py-8">
            <h1 className="font-display text-[clamp(2.4rem,3.6vw,3.4rem)] font-semibold leading-[1.04] tracking-[-0.03em]">Practise the visit before the visit.</h1>
            <p className="mt-5 text-[17px] leading-relaxed text-white/75">
              A telehealth visit with a virtual patient on one side and the chart filling in on the other. <span className="text-white">Code decides what the patient reveals; trust unlocks the rest.</span> Then feedback you can trace back to what you actually said.
            </p>
            <ul className="mt-8 space-y-3">
              {PROOF.map((p) => (
                <li key={p.t} className="flex items-baseline gap-3 text-[14.5px] text-white/70">
                  <span className="w-8 shrink-0 text-right font-display text-[22px] font-semibold tabular text-[oklch(0.82_0.15_168)]">{p.n}</span>
                  {p.t}
                </li>
              ))}
            </ul>
          </div>
          <OrbStage className="mx-auto w-full max-w-[34rem] pb-6" />
        </div>
        <p className="relative px-10 pb-8 text-[12.5px] text-white/55">Synthetic patients for education only. Not for clinical use.</p>
      </section>

      <div className="flex flex-col">
        {/* Phones and narrow windows: a compact brand band instead of the panel. */}
        <div className="bg-stage px-6 pb-6 pt-5 text-white lg:hidden">
          <Logo inverse compact />
          <p className="mt-4 font-display text-[26px] font-semibold leading-tight tracking-[-0.02em]">Practise the visit before the visit.</p>
          <p className="mt-2 text-[14px] leading-relaxed text-white/70">Code decides what the patient reveals; trust unlocks the rest.</p>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>
        <p className="px-6 pb-6 text-center text-[12px] text-ink-3 lg:hidden">Synthetic patients for education only. Not for clinical use.</p>
      </div>
    </div>
  );
}
