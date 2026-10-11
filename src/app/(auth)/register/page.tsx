import { redirect } from "next/navigation";
import { getUser, safeNextPath } from "@/lib/auth";
import { professionGroups } from "@/lib/professions";
import AuthForm from "../AuthForm";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const raw = (await searchParams).next;
  const next = safeNextPath(Array.isArray(raw) ? raw[0] : raw) || undefined;
  const u = await getUser();
  if (u) redirect(next || (u.role === "student" ? "/student" : "/faculty"));
  const groups = professionGroups().map((g) => ({ group: g.group, items: g.items.map((p) => ({ id: p.id, name: p.name })) }));
  return (
    <>
      <h2 className="font-display text-[28px] font-semibold leading-tight text-ink">Create your account</h2>
      <p className="mb-7 mt-1.5 text-[15px] text-ink-2">Students practise visits. Faculty build patients and courses.</p>
      <AuthForm mode="register" groups={groups} next={next} />
    </>
  );
}
