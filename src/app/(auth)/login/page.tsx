import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import AuthForm from "../AuthForm";

export default async function LoginPage() {
  const u = await getUser();
  if (u) redirect(u.role === "student" ? "/student" : "/faculty");
  return (
    <>
      <h2 className="mb-1 text-xl font-semibold">Sign in</h2>
      <p className="mb-6 text-sm text-slate-600">Welcome back.</p>
      <AuthForm mode="login" />
      <div className="mt-6 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
        <div className="mb-1 font-medium text-slate-800">Demo accounts</div>
        Faculty: faculty@rounds.demo / rounds-demo
        <br />
        Student: student@rounds.demo / rounds-demo
      </div>
    </>
  );
}
