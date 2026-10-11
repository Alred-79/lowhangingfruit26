import type { ReactNode } from "react";
import Aurora from "@/components/game/Aurora";
import { deriveGame } from "@/components/game/derive";
import { ShellHud } from "@/components/game/hud";
import { isFaculty } from "@/lib/auth";
import { profession } from "@/lib/professions";
import type { User } from "@/lib/types";
import { Logo, Mark } from "./Brand";
import ShellNav from "./ShellNav";

export { Logo, Mark };

export default function AppShell({ user, children, wide }: { user: User; children: ReactNode; wide?: boolean }) {
  const faculty = isFaculty(user);
  // Students carry their game state (rank, XP, streak) in the shell. Derived from stored visits only.
  const hud = faculty ? null : <ShellHud game={deriveGame(user.id, profession(user.profession_id).id)} />;
  return (
    <div className="relative min-h-full lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Aurora />
      <a href="#main" className="sr-only z-[60] rounded-md bg-ink px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <ShellNav faculty={faculty} name={user.name} roleLabel={faculty ? "Faculty" : profession(user.profession_id).name} hud={hud} />
      <main id="main" className={wide ? "relative min-w-0 px-4 py-5 pb-24 lg:pb-5" : "relative mx-auto w-full min-w-0 max-w-6xl px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:py-8"}>
        {children}
      </main>
    </div>
  );
}
