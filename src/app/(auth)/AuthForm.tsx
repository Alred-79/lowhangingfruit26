"use client";

import { ArrowRight, GraduationCap, Stethoscope } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useRef, useState } from "react";
import { Button, Input, Label, Select, cx } from "@/components/ui";
import { login, register } from "./actions";

type Group = { group: string; items: { id: string; name: string }[] };
type Demo = { label: string; email: string; password: string };

export default function AuthForm({ mode, groups, next, demo }: { mode: "login" | "register"; groups?: Group[]; next?: string; demo?: Demo[] }) {
  const [error, action, pending] = useActionState(mode === "login" ? login : register, null);
  const [role, setRole] = useState("student");
  // Submitted by hand rather than through the form's action: React resets a form after its action
  // returns, which wiped the name and email (and put the role and program back to their defaults)
  // whenever the server sent back an error such as a duplicate email.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profession, setProfession] = useState("medicine");
  const pw = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const q = next ? `?next=${encodeURIComponent(next)}` : "";

  function fillDemo(d: Demo) {
    setEmail(d.email);
    if (pw.current) pw.current.value = d.password;
    // Let React commit the email before the form is read.
    setTimeout(() => form.current?.requestSubmit(), 0);
  }

  return (
    <>
      <form
        ref={form}
        action={action}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => action(data));
        }}
        className="space-y-4"
      >
        {next && <input type="hidden" name="next" value={next} />}
        {mode === "register" && (
          <>
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" name="name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <fieldset>
              <legend className="mb-1.5 block text-[12.5px] font-medium text-ink-2">I am a</legend>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "student", label: "Student", Icon: GraduationCap },
                  { v: "faculty", label: "Faculty / instructor", Icon: Stethoscope },
                ].map(({ v, label, Icon }) => (
                  <label
                    key={v}
                    className={cx(
                      "press flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-center text-sm ring-1 ring-inset transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500",
                      role === v ? "bg-brand-50 font-medium text-brand-800 ring-brand-500" : "bg-surface text-ink-2 ring-slate-300 hover:ring-slate-400",
                    )}
                  >
                    <input type="radio" name="role" value={v} checked={role === v} onChange={() => setRole(v)} className="sr-only" />
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-ink-3">Faculty accounts can see every patient&apos;s answer key.</p>
            </fieldset>
            <div>
              <Label htmlFor="profession">{role === "student" ? "Your program" : "Your discipline"}</Label>
              <Select id="profession" name="profession" value={profession} onChange={(e) => setProfession(e.target.value)}>
                {groups?.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>
          </>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input ref={pw} id="password" name="password" type="password" required minLength={mode === "register" ? 8 : undefined} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </div>
        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full" size="lg">
          {pending ? "One moment..." : mode === "login" ? "Sign in" : "Create account"}
          {!pending && <ArrowRight className="h-4 w-4" aria-hidden />}
        </Button>
        <p className="text-center text-sm text-ink-3">
          {mode === "login" ? (
            <>
              New here?{" "}
              <Link href={`/register${q}`} className="font-medium text-brand-700 underline-offset-2 hover:underline">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href={`/login${q}`} className="font-medium text-brand-700 underline-offset-2 hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </form>
      {demo && demo.length > 0 && (
        <div className="mt-8 rounded-xl border border-line bg-surface-2 p-3">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <span className="text-[13px] font-semibold text-ink">Demo accounts</span>
            <span className="text-[12px] text-ink-3">password rounds-demo</span>
          </div>
          <ul className="space-y-1.5">
            {demo.map((d) => (
              <li key={d.email}>
                <button type="button" onClick={() => fillDemo(d)} disabled={pending} className="press flex min-h-11 w-full items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2 text-left ring-1 ring-inset ring-line transition-colors hover:ring-brand-300">
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium text-ink">{d.label}</span>
                    <span className="block truncate font-mono text-[12px] text-ink-3">
                      {d.email} / {d.password}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12.5px] font-medium text-brand-700">Sign in</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
