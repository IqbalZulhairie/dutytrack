import Link from "next/link";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f3f5f8] text-[#101b36]">
      <div className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full bg-[#b8f26b]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-[-4rem] h-80 w-80 rounded-full bg-[#9aaaf6]/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1200px] items-center px-5 py-8 sm:px-8 lg:px-12">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-[#dde3ed] bg-white shadow-[0_24px_70px_-32px_rgba(16,27,54,0.28)] lg:min-h-[680px] lg:grid-cols-[1.08fr_.92fr]">
          <section className="relative hidden overflow-hidden bg-[#101b36] p-12 lg:flex lg:flex-col">
            <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
            <div className="relative">
              <Link href="/" className="flex w-fit items-center gap-3" aria-label="Duty Track home">
                <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#b8f26b] text-sm font-black text-[#101b36]">DT</span>
                <span className="text-xl font-bold tracking-tight text-white">dutytrack<span className="text-[#b8f26b]">.</span></span>
              </Link>
            </div>

            <div className="relative my-auto max-w-md py-12">
              <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07]">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-[#b8f26b]" aria-hidden="true">
                  <path d="M8 12.5l2.2 2.2L16.5 8.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[#b8f26b]">One workspace</p>
              <h1 className="text-[42px] font-semibold leading-[1.08] tracking-[-0.04em] text-white">
                Keep every duty on track.
              </h1>
              <p className="mt-5 max-w-sm text-[15px] leading-7 text-slate-400">
                Organize schedules, support your team, and know exactly what needs attention.
              </p>
            </div>

            <div className="relative flex items-center gap-3 border-t border-white/10 pt-6 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-[#b8f26b] shadow-[0_0_12px_rgba(184,242,107,.65)]" />
              Workspace services operational
            </div>
          </section>

          <section className="flex min-h-[620px] items-center justify-center px-6 py-10 sm:px-12 lg:min-h-0 lg:px-14">
            <div className="w-full max-w-[390px]">
              <Link href="/" className="mb-12 flex w-fit items-center gap-3 lg:hidden" aria-label="Duty Track home">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#101b36] text-sm font-black text-[#b8f26b]">DT</span>
                <span className="text-lg font-bold tracking-tight text-[#101b36]">dutytrack<span className="text-[#79a93e]">.</span></span>
              </Link>

              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#66873a]">Welcome back</p>
              <h2 className="text-[34px] font-semibold leading-tight tracking-[-0.035em] text-[#101b36]">Sign in to your workspace</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Enter your account details to continue.
              </p>

              <LoginForm />

              <p className="mt-8 text-center text-xs text-slate-500">
                Need access?{" "}
                <a href="mailto:support@dutytrack.app" className="font-bold text-[#101b36] underline decoration-[#b8f26b] decoration-2 underline-offset-4 transition hover:text-[#66873a]">
                  Contact your administrator
                </a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
