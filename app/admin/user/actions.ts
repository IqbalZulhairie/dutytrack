"use server";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

export type RegisterUserState = {
  status: "idle" | "success" | "error";
  message: string;
  createdUser?: { id: string; fullName: string; staffId: string; email: string };
};

function readField(formData: FormData, name: string, trim = true) {
  const value = formData.get(name);
  if (typeof value !== "string") return "";
  return trim ? value.trim() : value;
}

export async function registerUser(
  _previousState: RegisterUserState,
  formData: FormData,
): Promise<RegisterUserState> {
  void _previousState;

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { status: "error", message: "Sign in to register users." };
  }
  if (currentUser.role !== "admin") {
    return { status: "error", message: "Only administrators can register staff accounts." };
  }

  const fullName = readField(formData, "fullName");
  const staffId = readField(formData, "staffId");
  const email = readField(formData, "email").toLowerCase();
  const password = readField(formData, "password", false);
  const confirmPassword = readField(formData, "confirmPassword", false);

  if (!fullName || fullName.length > 100) {
    return { status: "error", message: "Enter a name between 1 and 100 characters." };
  }
  if (!staffId || staffId.length > 10) {
    return { status: "error", message: "Enter a staff ID between 1 and 10 characters." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 25) {
    return { status: "error", message: "Enter a valid email address." };
  }
  if (password.length < 8 || password.length > 128 || Buffer.byteLength(password, "utf8") > 72) {
    return { status: "error", message: "Password must contain between 8 and 72 UTF-8 bytes." };
  }
  if (password !== confirmPassword) {
    return { status: "error", message: "The passwords do not match." };
  }

  try {
    const passwordHash = await hashPassword(password);
    const db = getDb();
    const [roleRows] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM roles WHERE LOWER(role_name) = 'staff' LIMIT 1",
    );
    if (!roleRows[0]) return { status: "error", message: "The Staff role is missing from the roles table." };

    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO profiles (full_name, staff_id, email, password, role_id, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [fullName, staffId, email, passwordHash, roleRows[0].id],
    );
    if (result.affectedRows !== 1) {
      return { status: "error", message: "The staff profile was not created." };
    }

    return {
      status: "success",
      message: `${fullName} was registered successfully.`,
      createdUser: { id: String(result.insertId), fullName, staffId, email },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The database request failed.";
    if (error && typeof error === "object" && "code" in error && error.code === "ER_DUP_ENTRY") {
      return { status: "error", message: "A user with that email address or staff ID already exists." };
    }
    return { status: "error", message: `Could not create the staff account: ${message}` };
  }
}
