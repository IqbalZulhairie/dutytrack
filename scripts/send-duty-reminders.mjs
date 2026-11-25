import nextEnv from "@next/env";
import mysql from "mysql2/promise";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { loadEnvConfig } = nextEnv;
loadEnvConfig(projectRoot);

const timezone = process.env.REMINDER_TIMEZONE || "Asia/Kuala_Lumpur";
const isDryRun = process.argv.includes("--dry-run");
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

function getReminderEmail({ recipientName, dutyDate, tasks, assignedStaff = [] }) {
  const safeName = escapeHtml(recipientName);
  const formattedDate = formatDutyDate(dutyDate);
  const staffNames = assignedStaff.map((staff) => typeof staff === "string" ? staff : staff.full_name);
  const staffList = staffNames.length
    ? staffNames.map((name) => `<li>${escapeHtml(name)}</li>`).join("")
    : "<li>No staff are assigned.</li>";
  const textStaff = staffNames.length
    ? staffNames.map((name) => `- ${name}`).join("\n")
    : "- No staff are assigned.";
  const taskList = tasks.length
    ? tasks.map((task) => `<li>${escapeHtml(task.task_name)}${task.description ? ` — ${escapeHtml(task.description)}` : ""}</li>`).join("")
    : "<li>No active cleaning tasks are assigned.</li>";
  const textTasks = tasks.length
    ? tasks.map((task) => `- ${task.task_name}${task.description ? `: ${task.description}` : ""}`).join("\n")
    : "- No active cleaning tasks are assigned.";

  return {
    subject: `Cleaning duty reminder - ${dutyDate}`,
    html: `<p>Hi ${safeName},</p><p>This is a reminder that you are assigned to the cleaning duty today, ${escapeHtml(formattedDate)}.</p><p>Assigned staff:</p><ul>${staffList}</ul><p>Today's cleaning tasks:</p><ul>${taskList}</ul><p>Thank you,<br>Duty Track</p>`,
    text: `Hi ${recipientName},\n\nThis is a reminder that you are assigned to the cleaning duty today, ${formattedDate}.\n\nAssigned staff:\n${textStaff}\n\nToday's cleaning tasks:\n${textTasks}\n\nThank you,\nDuty Track`,
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

async function sendReminder({ apiKey, from, recipient, recipientId, duty, tasks, assignedStaff }) {
  const message = getReminderEmail({
    recipientName: recipient.full_name,
    dutyDate: duty.date,
    tasks,
    assignedStaff,
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
    if (!isDryRun && isBeforeReminderTime) {
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
      `SELECT id, DATE_FORMAT(duty_date, '%Y-%m-%d') AS date
       FROM duty_schedules
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
    const scheduleIds = dutyRows.map((row) => String(row.id));
    const placeholders = scheduleIds.map(() => "?").join(", ");
    const [assignmentRows] = await connection.execute(
      `SELECT schedule_id, staff_id FROM duty_assignments WHERE schedule_id IN (${placeholders}) ORDER BY schedule_id, id`,
      scheduleIds,
    );
    const [scheduleTaskRows] = await connection.execute(
      `SELECT schedule_tasks.schedule_id, schedule_tasks.task_id, cleaning_tasks.task_name, cleaning_tasks.description
       FROM schedule_tasks
       INNER JOIN cleaning_tasks ON cleaning_tasks.id = schedule_tasks.task_id
       WHERE schedule_tasks.schedule_id IN (${placeholders})
         AND cleaning_tasks.is_active = 1
       ORDER BY schedule_tasks.schedule_id, cleaning_tasks.task_name`,
      scheduleIds,
    );
    const staffById = new Map(staffRows.map((staff) => [String(staff.id), staff]));
    const staffIdsByDuty = new Map();
    for (const assignment of assignmentRows) {
      const dutyId = String(assignment.schedule_id);
      staffIdsByDuty.set(dutyId, [...(staffIdsByDuty.get(dutyId) || []), String(assignment.staff_id)]);
    }
    const tasksByDuty = new Map();
    for (const task of scheduleTaskRows) {
      const dutyId = String(task.schedule_id);
      tasksByDuty.set(dutyId, [...(tasksByDuty.get(dutyId) || []), task]);
    }

    for (const row of dutyRows) {
      const dutyId = String(row.id);
      const staffIds = [...new Set(staffIdsByDuty.get(dutyId) || [])];
      const assignedStaff = staffIds
        .map((staffId) => staffById.get(staffId))
        .filter((staff) => Boolean(staff));
      const tasks = tasksByDuty.get(dutyId) || [];
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

        let claimed = false;
        try {
          claimed = await claimDelivery(connection, dutyId, staffId, duty.date);
          if (!claimed) {
            skipped += 1;
            continue;
          }

          await sendReminder({
            apiKey,
            from,
            recipient,
            recipientId: staffId,
            duty,
            tasks,
            assignedStaff,
          });
          await updateDelivery(connection, dutyId, staffId, "sent");
          sent += 1;
        } catch (error) {
          failed += 1;
          const errorMessage = error instanceof Error ? error.message : "Unknown email delivery error.";
          if (claimed) {
            try {
              await updateDelivery(connection, dutyId, staffId, "failed", errorMessage.slice(0, 2000));
            } catch (updateError) {
              const updateMessage = updateError instanceof Error ? updateError.message : "Unknown delivery status error.";
              console.error(`Could not record failure for duty ${dutyId}, staff ${staffId}: ${updateMessage}`);
            }
          }
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
