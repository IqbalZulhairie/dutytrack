import Link from "next/link";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-50 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,_rgba(34,211,238,0.16),_transparent_35%),radial-gradient(circle_at_85%_80%,_rgba(99,102,241,0.18),_transparent_35%)]" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/80 shadow-2xl shadow-cyan-950/30 backdrop-blur md:min-h-[640px] md:grid-cols-2">
        <section className="hidden flex-col justify-between bg-gradient-to-br from-cyan-500/15 via-slate-900 to-indigo-500/15 p-10 md:flex lg:p-12">
          <Link href="/" className="flex w-fit items-center gap-3" aria-label="Duty Track home">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-600 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/25">
              DT
            </span>
            <span className="text-xl font-bold tracking-tight text-white">Duty Track</span>
          </Link>

          <div className="max-w-md">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Work with clarity
            </p>
            <h1 className="mt-5 text-4xl font-black leading-tight text-white lg:text-5xl">
              Your team&apos;s next great result starts here.
            </h1>
            <p className="mt-5 leading-7 text-slate-300">
              Sign in to organize your duties, follow team progress, and keep every deadline in sight.
            </p>

            <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <p className="font-semibold text-white">Everything in one place</p>
                  <p className="mt-1 text-sm text-slate-400">Tasks, priorities, and progress at a glance.</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500">Plan clearly. Deliver confidently.</p>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
          <div className="w-full max-w-sm">
            <Link href="/" className="mb-10 flex w-fit items-center gap-3 md:hidden" aria-label="Duty Track home">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 to-blue-600 text-sm font-black text-slate-950">
                DT
              </span>
              <span className="text-lg font-bold text-white">Duty Track</span>
            </Link>

            <p className="text-sm font-medium text-cyan-300">Welcome back</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">Sign in to your account</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Enter your details below to continue to your workspace.
            </p>

            <LoginForm />

            <p className="mt-8 text-center text-sm text-slate-400">
              Don&apos;t have an account?{" "}
              <a href="mailto:support@dutytrack.app" className="font-semibold text-cyan-300 transition hover:text-cyan-200">
                Contact your administrator
              </a>
            </p>

          </div>
        </section>
      </div>
    </main>
  );
}
