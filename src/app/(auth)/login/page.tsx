import { redirect } from "next/navigation";
import { getUser, safeNextPath } from "@/lib/auth";
import AuthForm from "../AuthForm";

const DEMO = [
  { label: "Faculty", email: "faculty@poscere.demo", password: "poscere-demo", tone: "violet" as const },
  { label: "Student, Medicine", email: "student@poscere.demo", password: "poscere-demo", tone: "brand" as const },
  { label: "Student, Dietetics (Riley)", email: "dietetics@poscere.demo", password: "poscere-demo", tone: "lime" as const },
  { label: "Student, Nursing", email: "nursing@poscere.demo", password: "poscere-demo", tone: "pink" as const },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const raw = (await searchParams).next;
  const next = safeNextPath(Array.isArray(raw) ? raw[0] : raw) || undefined;
  const u = await getUser();
  if (u) redirect(next || (u.role === "student" ? "/student" : "/faculty"));
  return (
    <>
      <h2 className="font-display text-[30px] font-extrabold leading-tight tracking-[-0.03em] text-ink">Sign in</h2>
      <p className="mb-6 mt-1 text-[15px] text-ink-2">{next ? "Sign in to continue to the page you asked for." : "Welcome back. Your patients are waiting."}</p>
      <AuthForm mode="login" next={next} demo={DEMO} />
    </>
  );
}
