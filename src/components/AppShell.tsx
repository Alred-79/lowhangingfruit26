import type { ReactNode } from "react";
import { isFaculty } from "@/lib/auth";
import { profession } from "@/lib/professions";
import type { User } from "@/lib/types";
import { Logo, Mark } from "./Brand";
import ShellNav from "./ShellNav";

export { Logo, Mark };


export default function AppShell({ user, children, wide }: { user: User; children: ReactNode; wide?: boolean }) {
  const faculty = isFaculty(user);
  return (
    <div className="min-h-full lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a href="#main" className="sr-only z-[60] rounded-md bg-ink px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <ShellNav faculty={faculty} name={user.name} roleLabel={faculty ? "Faculty" : profession(user.profession_id).name} />
      <main id="main" className={wide ? "min-w-0 px-4 py-5 pb-24 lg:pb-5" : "mx-auto w-full min-w-0 max-w-6xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8"}>
        {children}
      </main>
    </div>
  );
}
