"use server";

import { redirect } from "next/navigation";
import { createUser, endSession, startSession, verifyLogin } from "@/lib/auth";

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const user = await verifyLogin(String(form.get("email") || ""), String(form.get("password") || ""));
  if (!user) return "That email and password don't match an account.";
  await startSession(user.id);
  redirect(user.role === "student" ? "/student" : "/faculty");
}

export async function register(_prev: string | null, form: FormData): Promise<string | null> {
  const role = form.get("role") === "faculty" ? "faculty" : "student";
  const password = String(form.get("password") || "");
  const email = String(form.get("email") || "");
  const name = String(form.get("name") || "");
  if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) return "Enter your name and a valid email.";
  if (password.length < 8) return "Use a password of at least 8 characters.";
  try {
    const user = await createUser({ email, password, name, role, professionId: String(form.get("profession") || "") || null });
    await startSession(user.id);
  } catch (e) {
    return (e as Error).message;
  }
  redirect(role === "student" ? "/student" : "/faculty");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
