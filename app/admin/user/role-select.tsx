"use client";

import { useEffect, useState } from "react";
import supabase from "@/lib/supabase";

type Role = { id: string | number; role_name: string };

export default function RoleSelect() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    Promise.resolve(
      supabase
        .from("roles")
        .select("id, role_name")
        .ilike("role_name", "staff"),
    )
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setErrorMessage(error.message);
        } else {
          setRoles(data ?? []);
        }
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "Could not load roles.");
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <select
        id="role"
        name="role_id"
        defaultValue=""
        required
        disabled={isLoading || Boolean(errorMessage) || roles.length === 0}
        className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <option value="" disabled>
          {isLoading
            ? "Loading roles..."
            : errorMessage
              ? "Unable to load roles"
              : roles.length === 0
                ? "No roles configured"
                : "Select a role"}
        </option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.role_name}
          </option>
        ))}
      </select>
      {errorMessage && (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          Could not load roles: {errorMessage}
        </p>
      )}
      {!isLoading && !errorMessage && roles.length === 0 && (
        <p className="mt-2 text-xs text-amber-300">
          No role records were found in the roles table.
        </p>
      )}
    </>
  );
}
