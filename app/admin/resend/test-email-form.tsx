"use client";

import { useActionState } from "react";
import { sendTestEmail, type TestEmailState } from "./actions";

const initialState: TestEmailState = { status: "idle", message: "" };

export default function TestEmailForm({
  recipient,
  canSend,
}: {
  recipient: string;
  canSend: boolean;
}) {
  const [state, formAction, pending] = useActionState(sendTestEmail, initialState);

  return (
    <form action={formAction} className="mt-5">
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`mb-4 rounded-xl p-3 text-xs leading-5 ${
            state.status === "success"
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border border-rose-500/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={!canSend || !recipient || pending}
        className="w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Sending test email…" : "Send one test email"}
      </button>
    </form>
  );
}
