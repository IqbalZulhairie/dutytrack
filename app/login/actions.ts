"use server";

import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";
import { clearSession, createSession, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

type LoginRow = RowDataPacket & {
  id: number | string;
  password: string;
  role: string;
  is_active: number | boolean;
};

export async function signIn(email: string, password: string) {
  if (typeof email !== "string" || typeof password !== "string" || password.length > 128) {
    return { success: false as const, message: "Enter a valid email address and password." };
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 25 || !password) {
    return { success: false as const, message: "Enter a valid email address and password." };
  }

  try {
    const [rows] = await getDb().execute<LoginRow[]>(
      `SELECT profiles.id, profiles.password, LOWER(roles.role_name) AS role, profiles.is_active
       FROM profiles
       INNER JOIN roles ON roles.id = profiles.role_id
       WHERE profiles.email = ?
       LIMIT 1`,
      [normalizedEmail],
    );
    const user = rows[0];
    if (!user || !Boolean(user.is_active) || !(await verifyPassword(password, user.password))) {
      return { success: false as const, message: "Email or password is incorrect." };
    }
    const role = user.role.toLowerCase();
    if (role !== "admin" && role !== "staff") {
      return { success: false as const, message: "This account does not have a supported role." };
    }

    await createSession(String(user.id));
    return { success: true as const, destination: role === "admin" ? "/admin" : "/staff" };
  } catch {
    return {
      success: false as const,
      message: "Unable to sign in because of a server or local database error. Check your .env.local settings and Laragon MySQL service.",
    };
  }
}

export async function signOut() {
  await clearSession();
  redirect("/login");
}
