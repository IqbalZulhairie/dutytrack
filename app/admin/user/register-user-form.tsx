"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { registerUser, type RegisterUserState } from "./actions";

const initialState: RegisterUserState = { status: "idle", message: "" };

function inputClassName() {
  return "w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20";
}

export default function RegisterUserForm() {
  const [state, formAction, isPending] = useActionState(registerUser, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
      <div>
        <label htmlFor="full-name" className="mb-2 block text-sm font-medium text-slate-200">Full name</label>
        <input id="full-name" name="fullName" type="text" autoComplete="name" maxLength={120} placeholder="e.g. Alex Morgan" required className={inputClassName()} />
      </div>

      <div>
        <label htmlFor="staff-id" className="mb-2 block text-sm font-medium text-slate-200">Staff ID</label>
        <input id="staff-id" name="staffId" type="text" maxLength={50} placeholder="e.g. S001" required className={inputClassName()} />
      </div>

      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="alex@company.com" required className={inputClassName()} />
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-200">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className={inputClassName()} />
      </div>

      <div>
        <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-slate-200">Confirm password</label>
        <input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required className={inputClassName()} />
      </div>

      <div className="border-t border-slate-800 pt-5 sm:col-span-2">
        {state.message && (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`mb-4 rounded-xl px-4 py-3 text-sm ${
              state.status === "success"
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border border-rose-500/30 bg-rose-500/10 text-rose-200"
            }`}
          >
            {state.message}
          </p>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/" className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Registering user..." : "Register user"}
          </button>
        </div>
      </div>
    </form>
  );
}
