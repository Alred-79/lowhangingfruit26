"use client";

import { ArrowLeftRight, GraduationCap, History, House, Library, LogOut, Menu, Radio, Route, Search, Stethoscope, TrendingUp, UserRoundPen, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/app/(auth)/actions";
import { Logo } from "./Brand";
import CommandPalette, { type Command } from "./CommandPalette";

type Item = { href: string; label: string; Icon: LucideIcon; short?: string };

const FACULTY_NAV: Item[] = [
  { href: "/faculty", label: "Home", Icon: House },
  { href: "/faculty/cases", label: "Patient Studio", Icon: UserRoundPen },
  { href: "/faculty/journeys", label: "Care Journeys", Icon: Route },
  { href: "/faculty/courses", label: "Courses", Icon: GraduationCap },
  { href: "/faculty/live", label: "Live Visits", Icon: Radio },
  { href: "/episodes", label: "Episodes", Icon: Library },
];
const STUDENT_NAV: Item[] = [
  { href: "/student", label: "Home", Icon: House },
  { href: "/student/practice", label: "Practice", Icon: Stethoscope },
  { href: "/student/journeys", label: "Care Journeys", Icon: Route, short: "Journeys" },
  { href: "/student/progress", label: "Progress", Icon: TrendingUp },
  { href: "/episodes", label: "My visits", Icon: History, short: "Visits" },
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
      className={`group flex min-h-10 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors ${active ? "bg-surface font-semibold text-ink shadow-e1 ring-1 ring-line" : "text-ink-2 hover:bg-surface/70 hover:text-ink"}`}
    >
      <item.Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-brand-600" : "text-slate-500 group-hover:text-ink-2"}`} strokeWidth={1.85} aria-hidden />
      {item.label}
    </Link>
  );
}

function Account({ name, roleLabel }: { name: string; roleLabel: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-800">{initials}</span>
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

export default function ShellNav({ faculty, name, roleLabel }: { faculty: boolean; name: string; roleLabel: string }) {
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
      <aside className="hidden border-r border-line bg-surface-2 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="px-4 pb-4 pt-5">
          <Link href={faculty ? "/faculty" : "/student"} aria-label="Poscere home">
            <Logo />
          </Link>
        </div>
        <div className="px-3 pb-3">
          <button onClick={() => setPalette(true)} className="flex min-h-10 w-full items-center gap-2.5 rounded-lg bg-surface px-3 text-[13.5px] text-ink-3 ring-1 ring-inset ring-line transition-colors hover:text-ink hover:ring-slate-300">
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
      <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
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
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          {nav.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? "font-semibold text-brand-700" : "text-ink-3"}`}>
                <n.Icon className="h-5 w-5" strokeWidth={active ? 2.1 : 1.8} aria-hidden />
                {n.short || n.label}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
