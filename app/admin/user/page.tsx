import Link from "next/link";
import RegisterUserForm from "./register-user-form";

export default function RegisterUserPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-50 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,_rgba(34,211,238,0.16),_transparent_35%),radial-gradient(circle_at_85%_80%,_rgba(99,102,241,0.18),_transparent_35%)]" />

      <section className="relative w-full max-w-3xl rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur sm:p-10">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-3" aria-label="Duty Track home">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-600 text-sm font-black text-slate-950">
                DT
              </span>
              <span className="text-lg font-bold text-white">Duty Track</span>
            </Link>
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
              User management
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Register a new user
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Add a team member and assign their access details for the Duty Track workspace.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Back to home
          </Link>
        </header>

        <RegisterUserForm />
      </section>
    </main>
  );
}