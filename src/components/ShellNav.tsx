"use client";

import { ArrowLeftRight, GraduationCap, History, House, Library, LogOut, Menu, Radio, Route, Search, Stethoscope, TrendingUp, UserRoundPen, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { logout } from "@/app/(auth)/actions";
import { Logo } from "./Brand";
import CommandPalette, { type Command } from "./CommandPalette";

type Item = { href: string; label: string; Icon: LucideIcon; short?: string; tone?: string };

// Every destination has its own accent tile, so the nav doubles as color wayfinding.
const T = {
  brand: "bg-brand-600 text-white",
  teal: "bg-[var(--color-tier-initial)] text-white",
  amber: "bg-[var(--color-flame-2)] text-ink",
  violet: "bg-[var(--color-mastery)] text-white",
  pink: "bg-[var(--color-tier-hidden)] text-white",
  lime: "bg-[var(--color-xp)] text-ink",
  live: "bg-[var(--color-live)] text-white",
};
const FACULTY_NAV: Item[] = [
  { href: "/faculty", label: "Home", Icon: House, tone: T.brand },
  { href: "/faculty/cases", label: "Patient Studio", Icon: UserRoundPen, tone: T.violet },
  { href: "/faculty/journeys", label: "Care Journeys", Icon: Route, tone: T.amber },
  { href: "/faculty/courses", label: "Courses", Icon: GraduationCap, tone: T.teal },
  { href: "/faculty/live", label: "Live Visits", Icon: Radio, tone: T.live },
  { href: "/episodes", label: "Episodes", Icon: Library, tone: T.pink },
];
const STUDENT_NAV: Item[] = [
  { href: "/student", label: "Home", Icon: House, tone: T.brand },
  { href: "/student/practice", label: "Practice", Icon: Stethoscope, tone: T.teal },
  { href: "/student/journeys", label: "Care Journeys", Icon: Route, short: "Journeys", tone: T.amber },
  { href: "/student/progress", label: "Progress", Icon: TrendingUp, tone: T.violet },
  { href: "/episodes", label: "My visits", Icon: History, short: "Visits", tone: T.pink },
];

const EXTRA: Record<"faculty" | "student", Command[]> = {
  faculty: [
    { label: "New patient", href: "/faculty/cases/new", hint: "Patient Studio, drafted in about 80 seconds" },
    { label: "New care journey", href: "/faculty/journeys/new", hint: "Care Journeys" },
    { label: "Student view", href: "/student", hint: "See what students see" },
  ],
  student: [{ label: "Make your own practice patient", href: "/student/practice", hint: "Practice" }],
};

const isActive = (path: string, href: string) => (href === "/student" || href === "/faculty" ? path === href : path === href || path.startsWith(href + "/"));

function NavLink({ item, active, onNavigate }: { item: Item; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`press group flex min-h-11 items-center gap-3 rounded-2xl px-2 text-[14.5px] transition-[background-color,box-shadow,color] duration-200 ${active ? "bg-surface font-bold text-ink shadow-e2 ring-1 ring-line" : "font-semibold text-ink-2 hover:bg-surface/80 hover:text-ink"}`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-rotate-6 group-hover:scale-110 ${active ? `${item.tone || T.brand} clay` : "bg-surface/80 text-ink-2 ring-1 ring-line"}`}>
        <item.Icon className="h-[17px] w-[17px]" strokeWidth={2.1} aria-hidden />
      </span>
      {item.label}
      {active && <span className="ml-auto mr-1 h-2 w-2 rounded-full bg-[var(--color-xp)] ring-2 ring-ink/80" aria-hidden />}
    </Link>
  );
}

function Account({ name, roleLabel }: { name: string; roleLabel: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--color-flame-2)] to-[var(--color-flame)] font-display text-[13px] font-black text-ink clay">{initials}</span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-[13.5px] font-medium text-ink">{name}</span>
        <span className="block truncate text-[12px] text-ink-3">{roleLabel}</span>
      </span>
      <form action={logout}>
        <button className="press grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-200/60 hover:text-ink" title="Sign out" aria-label="Sign out">
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}

export default function ShellNav({ faculty, name, roleLabel, hud }: { faculty: boolean; name: string; roleLabel: string; hud?: ReactNode }) {
  const path = usePathname() || "";
  const nav = faculty ? FACULTY_NAV : STUDENT_NAV;
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const commands: Command[] = [...nav.map((n) => ({ label: n.label, href: n.href })), ...EXTRA[faculty ? "faculty" : "student"]];
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const studentView = faculty && <NavLink item={{ href: "/student", label: "Student view", Icon: ArrowLeftRight }} active={false} onNavigate={() => setOpen(false)} />;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="relative z-10 hidden border-r border-line/70 bg-surface/55 backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="px-4 pb-4 pt-5">
          <Link href={faculty ? "/faculty" : "/student"} aria-label="Poscere home">
            <Logo />
          </Link>
        </div>
        <div className="px-3 pb-3">
          {hud && <div className="mb-3">{hud}</div>}
          <button onClick={() => setPalette(true)} className="press flex min-h-10 w-full items-center gap-2.5 rounded-xl bg-surface/80 px-3 text-[13.5px] font-medium text-ink-3 ring-1 ring-inset ring-line transition-colors hover:text-ink hover:ring-brand-300">
            <Search className="h-4 w-4" aria-hidden />
            <span className="flex-1 text-left">Go to</span>
            <kbd className="rounded border border-line bg-surface-2 px-1 font-mono text-[11px]">⌘K</kbd>
          </button>
        </div>
        <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {nav.map((n) => (
            <NavLink key={n.href} item={n} active={isActive(path, n.href)} />
          ))}
          {faculty && (
            <div className="mt-4 border-t border-line pt-3">
              {studentView}
            </div>
          )}
        </nav>
        <div className="border-t border-line p-2">
          <Account name={name} roleLabel={roleLabel} />
        </div>
      </aside>

      {/* Small screens: top bar + menu sheet */}
      <header className="relative z-10 flex h-14 items-center justify-between border-b border-line/70 bg-surface/70 px-4 backdrop-blur-xl lg:hidden">
        <Link href={faculty ? "/faculty" : "/student"} aria-label="Poscere home">
          <Logo />
        </Link>
        <button onClick={() => setOpen(true)} className="press grid h-11 w-11 place-items-center rounded-lg text-ink-2 hover:bg-slate-100" aria-label="Open menu" aria-expanded={open}>
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="scrim-in absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="sheet-in absolute inset-y-0 right-0 flex w-[19rem] max-w-[88vw] flex-col bg-surface-2 shadow-e3">
            <div className="flex h-14 items-center justify-between px-4">
              <Logo />
              <button onClick={() => setOpen(false)} className="press grid h-11 w-11 place-items-center rounded-lg text-ink-2 hover:bg-slate-200/60" aria-label="Close menu">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {hud && <div className="px-3 pb-3">{hud}</div>}
            <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3">
              {nav.map((n) => (
                <NavLink key={n.href} item={n} active={isActive(path, n.href)} onNavigate={() => setOpen(false)} />
              ))}
              {faculty && <div className="mt-4 border-t border-line pt-3">{studentView}</div>}
            </nav>
            <div className="border-t border-line p-2">
              <Account name={name} roleLabel={roleLabel} />
            </div>
          </div>
        </div>
      )}

      <CommandPalette commands={commands} open={palette} setOpen={setPalette} />

      {/* Students on phones: bottom tab bar */}
      {!faculty && (
        <nav aria-label="Main" className="fixed inset-x-2 bottom-2 z-20 grid grid-cols-5 rounded-[22px] bg-ink/95 p-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-e3 backdrop-blur lg:hidden">
          {nav.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={`press flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[18px] text-[11px] transition-colors ${active ? "font-bold text-white" : "font-medium text-white/70"}`}>
                <span className={`grid h-7 w-9 place-items-center rounded-xl transition-transform duration-300 ease-[var(--ease-spring)] ${active ? `${n.tone || T.brand} -translate-y-0.5 scale-110` : ""}`}>
                  <n.Icon className="h-[18px] w-[18px]" strokeWidth={2.1} aria-hidden />
                </span>
                {n.short || n.label}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
