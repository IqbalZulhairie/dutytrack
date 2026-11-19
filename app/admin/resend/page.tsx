import TestEmailForm from "./test-email-form";

export default function ResendTestPage() {
  const recipient = process.env.RESEND_TEST_RECIPIENT ?? "";
  const canSend = Boolean(
    process.env.RESEND_API_KEY &&
    recipient &&
    process.env.NODE_ENV !== "production",
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-50">
      <section className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Duty Track</p>
        <h1 className="mt-3 text-2xl font-bold">Test email notification</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Send one immediate test email to verify the Resend integration. This does not create or schedule a cleaning duty.
        </p>

        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
          <p className="text-xs font-semibold text-slate-300">Test recipient</p>
          <p className="mt-1 break-all text-sm text-white">{recipient || "Not configured"}</p>
        </div>

        {!canSend && (
          <p role="status" className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-200">
            Add <code>RESEND_API_KEY</code> and <code>RESEND_TEST_RECIPIENT</code> to the local <code>.env.local</code> file. Test sending is disabled in production.
          </p>
        )}

        <TestEmailForm recipient={recipient} canSend={canSend} />
      </section>
    </main>
  );
}
