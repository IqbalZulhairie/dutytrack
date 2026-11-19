"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-xs font-bold text-[#253451]">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          className="h-12 w-full rounded-xl border border-[#dfe4ec] bg-white px-4 text-sm text-[#101b36] outline-none transition placeholder:text-slate-400 hover:border-[#cbd4e2] focus:border-[#90b95d] focus:ring-4 focus:ring-[#b8f26b]/20"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-xs font-bold text-[#253451]">Password</label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            className="h-12 w-full rounded-xl border border-[#dfe4ec] bg-white px-4 pr-12 text-sm text-[#101b36] outline-none transition placeholder:text-slate-400 hover:border-[#cbd4e2] focus:border-[#90b95d] focus:ring-4 focus:ring-[#b8f26b]/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-[#101b36]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 5.2A10.8 10.8 0 0112 5c5.4 0 9 7 9 7a15 15 0 01-2.1 3M6.2 6.2C4.2 7.6 3 12 3 12s3.6 7 9 7c1.4 0 2.7-.5 3.8-1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path d="M3 12s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            )}
          </button>
        </div>
      </div>
      {errorMessage && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="h-12 w-full rounded-xl bg-[#101b36] px-4 text-sm font-bold text-white shadow-[0_10px_24px_-12px_rgba(16,27,54,.75)] transition hover:-translate-y-0.5 hover:bg-[#19284a] hover:shadow-[0_14px_28px_-12px_rgba(16,27,54,.8)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
