"use client";
import { GraduationCap, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input, Label, Select } from "@/components/ui";

export default function CreateCourse({ professions }: { professions: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [professionId, setProfessionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, professionId }) });
    const j = await res.json().catch(() => ({ error: "Could not create the course" }));
    if (!res.ok || j.error) {
      setBusy(false);
      return setError(j.error || "Could not create the course");
    }
    router.push(`/faculty/courses/${j.id}`);
  }
  const role = professions.find((p) => p.id === professionId)?.name || "Mixed / interprofessional";
  return (
    <form onSubmit={create} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="grid content-start gap-3 sm:grid-cols-[2fr_1.5fr] sm:items-end">
        <ol className="flex flex-wrap gap-2 sm:col-span-2" aria-label="How a course starts">
          {["Name it", "Pick who it trains", "Share the join code"].map((t, i) => (
            <li key={t} className="inline-flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-3 text-[12.5px] font-bold text-ink-2">
              <span className={i === 0 && name.trim() ? "grid h-6 w-6 place-items-center rounded-full bg-[var(--color-xp)] font-display text-[12px] font-black text-ink" : "grid h-6 w-6 place-items-center rounded-full bg-brand-600 font-display text-[12px] font-black text-white"}>{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
        <div>
          <Label htmlFor="course-name">Course name</Label>
          <Input id="course-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. NUTR 5420 Clinical Counseling, Fall" maxLength={120} />
        </div>
        <div>
          <Label htmlFor="course-prof">Students are training as</Label>
          <Select id="course-prof" value={professionId} onChange={(e) => setProfessionId(e.target.value)}>
            <option value="">Mixed / interprofessional</option>
            {professions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        {error && <p className="text-[12.5px] font-semibold text-rose-700 sm:col-span-2">{error}</p>}
      </div>
      {/* Live preview of the course as students will see it once they join, with the create action attached. */}
      <div className="rounded-[20px] bg-ink p-4 text-white clay" aria-live="polite">
        <p className="text-[11.5px] font-bold text-white/70">Students will see</p>
        <div className="mt-2 flex items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 clay">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className={name.trim() ? "truncate font-display text-[16px] font-extrabold" : "truncate font-display text-[16px] font-extrabold text-white/45"}>{name.trim() || "Your course name"}</p>
            <p className="truncate text-[12px] text-white/70">{role}</p>
          </div>
        </div>
        <p className="mt-2 text-[12px] text-white/70">You get a six-character join code as soon as it exists.</p>
        <Button type="submit" disabled={busy || !name.trim()} className="mt-3 w-full !bg-[var(--color-xp)] !text-ink disabled:!bg-white/15 disabled:!text-white/60">
          <Plus className="h-4 w-4" aria-hidden />
          {busy ? "Creating…" : "Create course"}
        </Button>
      </div>
    </form>
  );
}
