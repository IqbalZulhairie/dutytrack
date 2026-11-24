import nextEnv from "@next/env";
import mysql from "mysql2/promise";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { loadEnvConfig } = nextEnv;
loadEnvConfig(projectRoot);

const timezone = process.env.REMINDER_TIMEZONE || "Asia/Kuala_Lumpur";
const isDryRun = process.argv.includes("--dry-run");
const isScheduledRun = process.argv.includes("--scheduled");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidSender(value) {
  if (emailPattern.test(value)) return true;
  const displayNameAddress = value.match(/^(.+?)\s*<([^<>]+)>$/);
  return Boolean(displayNameAddress?.[1].trim() && emailPattern.test(displayNameAddress[2]));
}

function getLocalDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutesAfterMidnight: Number(values.hour) * 60 + Number(values.minute),
  };
}

function readIdArray(value, field) {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new Error(`Invalid ${field} JSON in the database.`);
    }
  }
  if (!Array.isArray(parsed)) throw new Error(`Invalid ${field} data in the database.`);

  return parsed.map((item) => {
    const id = typeof item === "number" ? String(item) : item;
    if (typeof id !== "string" || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
      throw new Error(`Invalid ${field} ID in the database.`);
    }
    return id;
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatDutyDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00.000Z`));
}

function getDatabaseConfig() {
  const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;
  const port = Number(MYSQL_PORT);
  if (!MYSQL_HOST || !MYSQL_PORT || !MYSQL_USER || !MYSQL_DATABASE || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Configure MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE in .env.local.");
  }

  return {
    host: MYSQL_HOST,
    port,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD || "",
    database: MYSQL_DATABASE,
    dateStrings: true,
    timezone: "Z",
  };
}

function getReminderEmail({ recipientName, dutyDate, tasks }) {
  const safeName = escapeHtml(recipientName);
  const formattedDate = formatDutyDate(dutyDate);
  const taskList = tasks.length
    ? tasks.map((task) => `<li>${escapeHtml(task.task_name)}${task.description ? ` — ${escapeHtml(task.description)}` : ""}</li>`).join("")
    : "<li>No active cleaning tasks are assigned.</li>";
  const textTasks = tasks.length
    ? tasks.map((task) => `- ${task.task_name}${task.description ? `: ${task.description}` : ""}`).join("\n")
    : "- No active cleaning tasks are assigned.";

  return {
    subject: `Cleaning duty reminder - ${dutyDate}`,
    html: `<p>Hi ${safeName},</p><p>This is a reminder that you are assigned to the cleaning duty today, ${escapeHtml(formattedDate)}.</p><p>Today's cleaning tasks:</p><ul>${taskList}</ul><p>Thank you,<br>Duty Track</p>`,
    text: `Hi ${recipientName},\n\nThis is a reminder that you are assigned to the cleaning duty today, ${formattedDate}.\n\nToday's cleaning tasks:\n${textTasks}\n\nThank you,\nDuty Track`,
  };
}

async function claimDelivery(connection, dutyId, staffId, dutyDate) {
  await connection.beginTransaction();
  try {
    await connection.execute(
      `INSERT IGNORE INTO duty_reminder_deliveries
         (duty_id, staff_id, duty_date, status, attempt_count)
       VALUES (?, ?, ?, 'pending', 0)`,
      [dutyId, staffId, dutyDate],
    );
    const [result] = await connection.execute(
      `UPDATE duty_reminder_deliveries
       SET status = 'sending', attempt_count = attempt_count + 1, last_error = NULL
       WHERE duty_id = ? AND staff_id = ?
         AND (
             status = 'pending'
             OR (status = 'failed' AND updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE))
           OR (status = 'sending' AND updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE))
         )`,
      [dutyId, staffId],
    );
    await connection.commit();
    return result.affectedRows === 1;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function updateDelivery(connection, dutyId, staffId, status, errorMessage = null) {
  await connection.execute(
    `UPDATE duty_reminder_deliveries
     SET status = ?, sent_at = IF(? = 'sent', UTC_TIMESTAMP(), sent_at), last_error = ?
     WHERE duty_id = ? AND staff_id = ?`,
    [status, status, errorMessage, dutyId, staffId],
  );
}

async function sendReminder({ apiKey, from, recipient, recipientId, duty, tasks }) {
  const message = getReminderEmail({
    recipientName: recipient.full_name,
    dutyDate: duty.date,
    tasks,
  });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `duty-reminder-${duty.id}-${recipientId}-${duty.date}`,
    },
    body: JSON.stringify({
      from,
      to: [recipient.email],
      ...message,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  const responseText = await response.text();
  let payload = {};
  try {
    const parsed = JSON.parse(responseText);
    if (typeof parsed === "object" && parsed !== null) payload = parsed;
  } catch {
    if (response.ok) return;
  }
  if (!response.ok) {
    const detail = typeof payload.message === "string" ? payload.message : `HTTP ${response.status}`;
    throw new Error(`Resend rejected the email: ${detail}`);
  }
}

async function main() {
  const dateTime = getLocalDateTime();
  const connection = await mysql.createConnection(getDatabaseConfig());
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const [settingsRows] = await connection.execute(
      "SELECT TIME_FORMAT(reminder_time, '%H:%i') AS reminder_time FROM duty_reminder_settings WHERE id = 1",
    );
    const reminderTime = settingsRows[0]?.reminder_time;
    if (typeof reminderTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) {
      throw new Error("The daily reminder time is missing or invalid.");
    }
    const [, reminderHour, reminderMinute] = reminderTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    const reminderMinutesAfterMidnight = Number(reminderHour) * 60 + Number(reminderMinute);
    const isBeforeReminderTime = dateTime.minutesAfterMidnight < reminderMinutesAfterMidnight;
    const isOutsideScheduledMinute = isScheduledRun && dateTime.minutesAfterMidnight !== reminderMinutesAfterMidnight;
    if (!isDryRun && (isScheduledRun ? isOutsideScheduledMinute : isBeforeReminderTime)) {
      console.info(`Not due now: reminders are scheduled for ${reminderTime} in ${timezone}.`);
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL?.trim();
    if (!isDryRun && !apiKey) throw new Error("RESEND_API_KEY is not configured.");
    if (!isDryRun && (!from || !isValidSender(from))) {
      throw new Error("Set RESEND_FROM_EMAIL to a verified Resend sender address, optionally with a display name.");
    }

    const [dutyRows] = await connection.execute(
      `SELECT id, DATE_FORMAT(duty_date, '%Y-%m-%d') AS date, staff_ids, task_ids
       FROM duties
       WHERE duty_date = ?
       ORDER BY id`,
      [dateTime.date],
    );
    if (dutyRows.length === 0) {
      console.info(`No cleaning duties scheduled for ${dateTime.date} (${timezone}).`);
      return;
    }

    const [staffRows] = await connection.execute(
      `SELECT profiles.id, profiles.full_name, profiles.email
       FROM profiles
       INNER JOIN roles ON roles.id = profiles.role_id
       WHERE LOWER(roles.role_name) = 'staff' AND profiles.is_active = 1`,
    );
    const [taskRows] = await connection.execute(
      "SELECT id, task_name, description FROM cleaning_tasks WHERE is_active = 1 ORDER BY task_name",
    );
    const staffById = new Map(staffRows.map((staff) => [String(staff.id), staff]));

    for (const row of dutyRows) {
      const dutyId = String(row.id);
      const staffIds = readIdArray(row.staff_ids, "duty staff");
      const assignedTaskIds = row.task_ids == null
        ? new Set(taskRows.map((task) => String(task.id)))
        : new Set(readIdArray(row.task_ids, "duty task"));
      const tasks = taskRows.filter((task) => assignedTaskIds.has(String(task.id)));
      const duty = { id: dutyId, date: row.date };

      for (const staffId of new Set(staffIds)) {
        const recipient = staffById.get(staffId);
        if (!recipient || typeof recipient.email !== "string" || !emailPattern.test(recipient.email)) {
          skipped += 1;
          console.warn(`Skipped duty ${dutyId}, staff ${staffId}: no active staff account with a valid email.`);
          continue;
        }

        if (isDryRun) {
          skipped += 1;
          continue;
        }

        if (!await claimDelivery(connection, dutyId, staffId, duty.date)) {
          skipped += 1;
          continue;
        }

        try {
          await sendReminder({
            apiKey,
            from,
            recipient,
            recipientId: staffId,
            duty,
            tasks,
          });
          await updateDelivery(connection, dutyId, staffId, "sent");
          sent += 1;
        } catch (error) {
          failed += 1;
          const errorMessage = error instanceof Error ? error.message : "Unknown email delivery error.";
          await updateDelivery(connection, dutyId, staffId, "failed", errorMessage.slice(0, 2000));
          console.error(`Reminder delivery failed for duty ${dutyId}, staff ${staffId}: ${errorMessage}`);
        }
      }
    }

    if (isDryRun) {
      console.info(`Dry run for ${dateTime.date} (${timezone}), scheduled at ${reminderTime}: ${dutyRows.length} duty(s), ${skipped} assigned staff recipient(s); no email sent.`);
    } else {
      console.info(`Reminder run for ${dateTime.date} (${timezone}): ${sent} sent, ${skipped} skipped, ${failed} failed.`);
    }
    if (failed > 0) process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Duty reminder job failed.");
  process.exitCode = 1;
});
