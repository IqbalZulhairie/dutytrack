import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isInitialAdminSetupRequired } from "@/lib/auth";
import SetupForm from "./setup-form";

export const instant = false;

export default async function SetupPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/staff");
  if (!(await isInitialAdminSetupRequired())) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f5f8] px-5 py-10 text-[#101b36]">
      <section className="w-full max-w-md rounded-3xl border border-[#dde3ed] bg-white p-7 shadow-xl sm:p-10">
        <Link href="/" className="text-sm font-bold">Duty Track</Link>
        <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-[#66873a]">Local database setup</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create administrator</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">This one-time setup creates the first administrator account for this local workspace.</p>
        <SetupForm />
      </section>
    </main>
  );
}
