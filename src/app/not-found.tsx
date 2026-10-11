import { Compass } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Brand";
import Aurora from "@/components/game/Aurora";

export default function NotFound() {
  return (
    <main className="relative grid min-h-full place-items-center overflow-hidden bg-stage px-5 py-16 text-white">
      <Aurora dark />
      <div className="relative max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo inverse />
        </div>
        <span className="float-idle mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[var(--color-xp)] text-ink clay">
          <Compass className="h-8 w-8" aria-hidden />
        </span>
        <h1 className="mt-5 font-display text-[40px] font-black leading-none tracking-[-0.035em]">This room is empty.</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-white/80">The page you asked for does not exist, or you do not have access to it.</p>
        <Link href="/" className="press mt-7 inline-flex min-h-12 items-center rounded-2xl bg-brand-600 px-6 text-[15px] font-bold text-white shadow-[inset_0_1.5px_0_rgb(255_255_255/0.22)] hover:bg-brand-500">
          Back to your home
        </Link>
      </div>
    </main>
  );
}
