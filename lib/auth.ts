import "server-only";

import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2/promise";
import { getDb } from "./db";

const SESSION_COOKIE = "duty_track_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff";
};

type ProfileRow = RowDataPacket & {
  id: number | string;
  full_name: string;
  email: string;
  role: string;
};

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Password must be 72 bytes or fewer.");
  }
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  if (!/^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/.test(passwordHash)) return false;
  const compatibleHash = passwordHash.startsWith("$2y$")
    ? `$2b$${passwordHash.slice(4)}`
    : passwordHash;
  return compare(password, compatibleHash);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
  await getDb().execute(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
    [hashSessionToken(token), userId, expiresAt],
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  cookieStore.delete(SESSION_COOKIE);

  if (token) {
    await getDb().execute("DELETE FROM sessions WHERE token_hash = ?", [hashSessionToken(token)]);
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [rows] = await getDb().execute<ProfileRow[]>(
    `SELECT profiles.id, profiles.full_name, profiles.email, LOWER(roles.role_name) AS role
     FROM sessions
     INNER JOIN profiles ON profiles.id = sessions.user_id
     INNER JOIN roles ON roles.id = profiles.role_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > UTC_TIMESTAMP() AND profiles.is_active = 1
     LIMIT 1`,
    [hashSessionToken(token)],
  );
  const user = rows[0];
  if (!user) return null;
  const role = user.role.toLowerCase();
  if (role !== "admin" && role !== "staff") return null;

  return { id: String(user.id), name: user.full_name, email: user.email, role };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to continue.");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Administrator access is required.");
  return user;
}

export async function isInitialAdminSetupRequired() {
  const [rows] = await getDb().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS admin_count
     FROM profiles
     INNER JOIN roles ON roles.id = profiles.role_id
     WHERE LOWER(roles.role_name) = 'admin'`,
  );
  return Number(rows[0]?.admin_count ?? 0) === 0;
}

export { SESSION_COOKIE };
