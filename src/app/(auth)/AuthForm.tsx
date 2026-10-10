"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Input, Label, Select } from "@/components/ui";
import { login, register } from "./actions";

type Group = { group: string; items: { id: string; name: string }[] };

export default function AuthForm({ mode, groups }: { mode: "login" | "register"; groups?: Group[] }) {
  const [error, action, pending] = useActionState(mode === "login" ? login : register, null);
  const [role, setRole] = useState("student");
  return (
    <form action={action} className="space-y-4">
      {mode === "register" && (
        <>
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" required autoComplete="name" />
          </div>
          <div>
            <Label>I am a</Label>
            <div className="grid grid-cols-2 gap-2">
              {["student", "faculty"].map((r) => (
                <label key={r} className={`cursor-pointer rounded-md border px-3 py-2 text-center text-sm capitalize ${role === r ? "border-brand-500 bg-brand-50 font-medium text-brand-700" : "border-slate-300 text-slate-600"}`}>
                  <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                  {r === "faculty" ? "Faculty / instructor" : "Student"}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="profession">{role === "student" ? "Your program" : "Your discipline"}</Label>
            <Select id="profession" name="profession" defaultValue="medicine">
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
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required minLength={mode === "register" ? 8 : undefined} autoComplete={mode === "login" ? "current-password" : "new-password"} />
      </div>
      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? "One moment..." : mode === "login" ? "Sign in" : "Create account"}
      </Button>
      <p className="text-center text-sm text-slate-600">
        {mode === "login" ? (
          <>
            New here? <Link href="/register" className="font-medium text-brand-600 hover:underline">Create an account</Link>
          </>
        ) : (
          <>
            Already have an account? <Link href="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link>
          </>
        )}
      </p>
    </form>
  );
}
