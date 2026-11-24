import "server-only";

import { createPool, type Pool } from "mysql2/promise";

const globalForDb = globalThis as typeof globalThis & { dutyTrackPool?: Pool };

export function getDb() {
  if (globalForDb.dutyTrackPool) return globalForDb.dutyTrackPool;

  const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;
  const port = Number(MYSQL_PORT);

  if (!MYSQL_HOST || !MYSQL_PORT || !MYSQL_USER || !MYSQL_DATABASE || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Configure MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE in .env.local.");
  }

  const pool = createPool({
    host: MYSQL_HOST,
    port,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD ?? "",
    database: MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
    timezone: "Z",
  });

  globalForDb.dutyTrackPool = pool;
  return pool;
}
