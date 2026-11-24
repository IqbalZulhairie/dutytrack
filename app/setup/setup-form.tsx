"use client";

import { useActionState } from "react";
import { createInitialAdmin, type SetupState } from "./actions";

const initialState: SetupState = { error: "" };

export default function SetupForm() {
  const [state, formAction, isPending] = useActionState(createInitialAdmin, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <label className="block">
        <span className="mb-2 block text-xs font-bold text-[#253451]">Full name</span>
        <input name="fullName" autoComplete="name" maxLength={100} required className="h-12 w-full rounded-xl border border-[#dfe4ec] px-4 text-sm outline-none focus:border-[#90b95d] focus:ring-4 focus:ring-[#b8f26b]/20" />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-bold text-[#253451]">Staff ID</span>
        <input name="staffId" maxLength={10} required className="h-12 w-full rounded-xl border border-[#dfe4ec] px-4 text-sm outline-none focus:border-[#90b95d] focus:ring-4 focus:ring-[#b8f26b]/20" />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-bold text-[#253451]">Email address</span>
        <input name="email" type="email" autoComplete="email" maxLength={25} required className="h-12 w-full rounded-xl border border-[#dfe4ec] px-4 text-sm outline-none focus:border-[#90b95d] focus:ring-4 focus:ring-[#b8f26b]/20" />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-bold text-[#253451]">Password</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required className="h-12 w-full rounded-xl border border-[#dfe4ec] px-4 text-sm outline-none focus:border-[#90b95d] focus:ring-4 focus:ring-[#b8f26b]/20" />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-bold text-[#253451]">Confirm password</span>
        <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={72} required className="h-12 w-full rounded-xl border border-[#dfe4ec] px-4 text-sm outline-none focus:border-[#90b95d] focus:ring-4 focus:ring-[#b8f26b]/20" />
      </label>
      {state.error && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.error}</p>}
      <button type="submit" disabled={isPending} className="h-12 w-full rounded-xl bg-[#101b36] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">
        {isPending ? "Creating account..." : "Create administrator"}
      </button>
    </form>
  );
}
