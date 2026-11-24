"use server";

import { redirect } from "next/navigation";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { createSession, hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

export type SetupState = {
  error: string;
};

export async function createInitialAdmin(_previousState: SetupState, formData: FormData): Promise<SetupState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const staffId = String(formData.get("staffId") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!fullName || fullName.length > 100) return { error: "Enter a name between 1 and 100 characters." };
  if (!staffId || staffId.length > 10) return { error: "Enter a staff ID between 1 and 10 characters." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 25) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 8 || password.length > 128 || Buffer.byteLength(password, "utf8") > 72) {
    return { error: "Password must contain between 8 and 72 UTF-8 bytes." };
  }
  if (password !== confirmPassword) return { error: "The passwords do not match." };

  let connection: PoolConnection;
  try {
    connection = await getDb().getConnection();
  } catch (error) {
    const message = error instanceof Error ? error.message : "The database request failed.";
    return { error: `Could not connect to the local database: ${message}` };
  }
  const lockName = "duty-track-initial-admin";
  let lockAcquired = false;
  let profileId: string | null = null;
  try {
    const [lockRows] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK(?, 10) AS acquired",
      [lockName],
    );
    if (Number(lockRows[0]?.acquired) !== 1) return { error: "Could not start initial setup. Please try again." };
    lockAcquired = true;

    const [adminRows] = await connection.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS admin_count
       FROM profiles
       INNER JOIN roles ON roles.id = profiles.role_id
       WHERE LOWER(roles.role_name) = 'admin'`,
    );
    if (Number(adminRows[0]?.admin_count ?? 0) > 0) {
      return { error: "An administrator is already set up. Sign in instead." };
    }

    const [roleRows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM roles WHERE LOWER(role_name) = 'admin' LIMIT 1",
    );
    if (!roleRows[0]) return { error: "The Admin role is missing from the roles table." };

    const passwordHash = await hashPassword(password);
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO profiles (full_name, staff_id, email, password, role_id, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [fullName, staffId, email, passwordHash, roleRows[0].id],
    );
    profileId = String(result.insertId);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "ER_DUP_ENTRY") return { error: "An account with that email address already exists." };
    const message = error instanceof Error ? error.message : "The database request failed.";
    return { error: `Could not create the administrator account: ${message}` };
  } finally {
    if (lockAcquired) await connection.query("SELECT RELEASE_LOCK(?)", [lockName]);
    connection.release();
  }

  if (!profileId) return { error: "Could not create the administrator account." };
  await createSession(profileId);
  redirect("/admin");
}
