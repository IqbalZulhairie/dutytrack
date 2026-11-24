"use server";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getDutyDates, getOneYearLater } from "@/lib/duty-schedule";
import type { CleaningTask, Duty, Staff, Store } from "@/lib/types";

type StaffRow = RowDataPacket & {
  id: number | string;
  full_name: string;
  staff_id: string | null;
  email: string;
  is_active: number | boolean;
};

type TaskRow = RowDataPacket & {
  id: number | string;
  task_name: string;
  description: string | null;
  is_active: number | boolean;
};

type DutyRow = RowDataPacket & {
  id: number | string;
  date: string;
  staff_ids: unknown;
  task_ids: unknown;
  completed_task_ids: unknown;
};

type ReminderSettingRow = RowDataPacket & {
  reminder_time: string;
};

function readStringArray(value: unknown, field: string): string[] {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new Error(`The database contains invalid ${field} data.`);
    }
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`The database contains invalid ${field} data.`);
  }
  return parsed.map((item) => {
    if (typeof item === "string") return item;
    if (typeof item === "number" && Number.isSafeInteger(item) && item > 0) return String(item);
    throw new Error(`The database contains invalid ${field} data.`);
  });
}

function mapStaff(row: StaffRow): Staff {
  return {
    id: String(row.id),
    name: row.full_name,
    email: row.email,
    staffId: row.staff_id ?? undefined,
    active: Boolean(row.is_active),
  };
}

function mapTask(row: TaskRow): CleaningTask {
  return {
    id: String(row.id),
    label: row.task_name,
    description: row.description ?? "",
    active: Boolean(row.is_active),
  };
}

function mapDuty(row: DutyRow, legacyTaskIds: string[] = []): Duty {
  return {
    id: String(row.id),
    date: row.date,
    staffIds: readStringArray(row.staff_ids, "duty staff"),
    taskIds: row.task_ids == null ? legacyTaskIds : readStringArray(row.task_ids, "duty task"),
    completedTaskIds: readStringArray(row.completed_task_ids, "completed task"),
  };
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function readDutyId(value: unknown): string {
  const dutyId = typeof value === "number" ? String(value) : value;
  if (typeof dutyId !== "string" || !/^[1-9]\d*$/.test(dutyId) || !Number.isSafeInteger(Number(dutyId))) {
    throw new Error("Invalid duty ID.");
  }
  return dutyId;
}

function readTaskId(value: unknown): string {
  const taskId = typeof value === "number" ? String(value) : value;
  if (typeof taskId !== "string" || !/^[1-9]\d*$/.test(taskId) || !Number.isSafeInteger(Number(taskId))) {
    throw new Error("Invalid cleaning task ID.");
  }
  return taskId;
}

function readProfileId(value: unknown) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error("Invalid staff ID.");
  }
  return value;
}

export async function getDashboardData(): Promise<Store> {
  await requireAdmin();
  const db = getDb();
  const [staffResult, taskResult, dutyResult, reminderResult] = await Promise.all([
    db.execute<StaffRow[]>(
      `SELECT profiles.id, profiles.full_name, profiles.staff_id, profiles.email, profiles.is_active
       FROM profiles
       INNER JOIN roles ON roles.id = profiles.role_id
       WHERE LOWER(roles.role_name) = 'staff'
       ORDER BY profiles.full_name`,
    ),
    db.execute<TaskRow[]>(
      "SELECT id, task_name, description, is_active FROM cleaning_tasks ORDER BY task_name",
    ),
    db.execute<DutyRow[]>(
      `SELECT id, DATE_FORMAT(duty_date, '%Y-%m-%d') AS date, staff_ids, task_ids, completed_task_ids
       FROM duties ORDER BY duty_date`,
    ),
    db.execute<ReminderSettingRow[]>(
      "SELECT TIME_FORMAT(reminder_time, '%H:%i') AS reminder_time FROM duty_reminder_settings WHERE id = 1",
    ),
  ]);

  const reminderTime = reminderResult[0][0]?.reminder_time;
  if (!reminderTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) {
    throw new Error("The daily reminder time is missing or invalid.");
  }

  const legacyTaskIds = taskResult[0]
    .filter((task) => Boolean(task.is_active))
    .map((task) => String(task.id));
  return {
    staff: staffResult[0].map(mapStaff),
    tasks: taskResult[0].map(mapTask),
    duties: dutyResult[0].map((row) => mapDuty(row, legacyTaskIds)),
    reminderTime,
  };
}

export async function saveReminderTime(reminderTime: string) {
  await requireAdmin();
  if (
    typeof reminderTime !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)
  ) {
    throw new Error("Choose a valid reminder time.");
  }

  const db = getDb();
  await db.execute(
    "UPDATE duty_reminder_settings SET reminder_time = ? WHERE id = 1",
    [`${reminderTime}:00`],
  );
  const [rows] = await db.execute<ReminderSettingRow[]>(
    "SELECT TIME_FORMAT(reminder_time, '%H:%i') AS reminder_time FROM duty_reminder_settings WHERE id = 1",
  );
  if (!rows[0]) throw new Error("The reminder settings have not been initialized.");
  return rows[0].reminder_time;
}

export async function saveCleaningTask(input: {
  id?: string;
  label: string;
  description: string;
}): Promise<CleaningTask> {
  await requireAdmin();
  if (!input || typeof input !== "object") throw new Error("Invalid cleaning task.");
  if (input.id !== undefined) readTaskId(input.id);
  if (typeof input.label !== "string" || typeof input.description !== "string") {
    throw new Error("Enter a task name and description.");
  }
  const label = input.label.trim();
  const description = input.description.trim();
  if (!label || label.length > 120) throw new Error("Enter a task name between 1 and 120 characters.");
  if (description.length > 500) throw new Error("Description must be 500 characters or fewer.");

  const db = getDb();
  if (input.id) {
    const id = readTaskId(input.id);
    await db.execute(
      "UPDATE cleaning_tasks SET task_name = ?, description = ? WHERE id = ?",
      [label, description || null, id],
    );
    const [rows] = await db.execute<TaskRow[]>(
      "SELECT id, task_name, description, is_active FROM cleaning_tasks WHERE id = ? LIMIT 1",
      [id],
    );
    if (!rows[0]) throw new Error("The cleaning task no longer exists.");
    return mapTask(rows[0]);
  }

  const [result] = await db.execute<ResultSetHeader>(
    "INSERT INTO cleaning_tasks (task_name, description, is_active) VALUES (?, ?, 1)",
    [label, description || null],
  );
  if (!Number.isSafeInteger(result.insertId) || result.insertId < 1) {
    throw new Error("Could not retrieve the new cleaning task ID.");
  }
  const id = String(result.insertId);
  return { id, label, description, active: true };
}

export async function toggleCleaningTask(taskId: string): Promise<boolean> {
  await requireAdmin();
  const id = readTaskId(taskId);
  const db = getDb();
  const [result] = await db.execute(
    "UPDATE cleaning_tasks SET is_active = IF(is_active = 1, 0, 1) WHERE id = ?",
    [id],
  );
  if (!("affectedRows" in result) || result.affectedRows !== 1) {
    throw new Error("The cleaning task no longer exists.");
  }

  const [rows] = await db.execute<TaskRow[]>(
    "SELECT id, task_name, description, is_active FROM cleaning_tasks WHERE id = ? LIMIT 1",
    [id],
  );
  if (!rows[0]) throw new Error("The cleaning task no longer exists.");
  return Boolean(rows[0].is_active);
}

export async function updateStaffDetails(input: {
  id: string;
  name: string;
  email: string;
}) {
  await requireAdmin();
  if (!input || typeof input !== "object") throw new Error("Invalid staff details.");
  readProfileId(input.id);
  if (typeof input.name !== "string" || typeof input.email !== "string") {
    throw new Error("Enter a name and email address.");
  }
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name || name.length > 100) throw new Error("Enter a name between 1 and 100 characters.");
  if (email.length > 25 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  const db = getDb();
  await db.execute(
    `UPDATE profiles
     INNER JOIN roles ON roles.id = profiles.role_id
     SET profiles.full_name = ?, profiles.email = ?
     WHERE profiles.id = ? AND LOWER(roles.role_name) = 'staff'`,
    [name, email, input.id],
  );
  const [rows] = await db.execute<StaffRow[]>(
    `SELECT profiles.id, profiles.full_name, profiles.staff_id, profiles.email, profiles.is_active
     FROM profiles
     INNER JOIN roles ON roles.id = profiles.role_id
     WHERE profiles.id = ? AND LOWER(roles.role_name) = 'staff'
     LIMIT 1`,
    [input.id],
  );
  if (!rows[0]) throw new Error("The staff account no longer exists.");
  return mapStaff(rows[0]);
}

export async function toggleStaffStatus(input: {
  id: string;
  active: boolean;
  today: string;
}) {
  await requireAdmin();
  if (!input || typeof input !== "object") throw new Error("Invalid staff status update.");
  readProfileId(input.id);
  if (typeof input.active !== "boolean" || typeof input.today !== "string" || !isValidDate(input.today)) {
    throw new Error("Invalid staff status update.");
  }
  const db = getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const [updateResult] = await connection.execute(
      `UPDATE profiles
       INNER JOIN roles ON roles.id = profiles.role_id
       SET profiles.is_active = ?
       WHERE profiles.id = ? AND LOWER(roles.role_name) = 'staff'`,
      [input.active ? 1 : 0, input.id],
    );
    if (!("affectedRows" in updateResult) || updateResult.affectedRows !== 1) {
      const [rows] = await connection.execute<StaffRow[]>(
        `SELECT profiles.id, profiles.full_name, profiles.staff_id, profiles.email, profiles.is_active
         FROM profiles
         INNER JOIN roles ON roles.id = profiles.role_id
         WHERE profiles.id = ? AND LOWER(roles.role_name) = 'staff'
         LIMIT 1`,
        [input.id],
      );
      if (!rows[0]) throw new Error("The staff account no longer exists.");
    }

    if (!input.active) {
      const [dutyRows] = await connection.execute<DutyRow[]>(
        `SELECT id, DATE_FORMAT(duty_date, '%Y-%m-%d') AS date, staff_ids, completed_task_ids
         FROM duties WHERE duty_date >= ? FOR UPDATE`,
        [input.today],
      );
      for (const row of dutyRows) {
        const duty = mapDuty(row);
        const staffIds = duty.staffIds.filter((staffId) => staffId !== input.id);
        if (staffIds.length < 2) {
          await connection.execute("DELETE FROM duties WHERE id = ?", [duty.id]);
        } else if (staffIds.length !== duty.staffIds.length) {
          await connection.execute("UPDATE duties SET staff_ids = ? WHERE id = ?", [
            JSON.stringify(staffIds),
            duty.id,
          ]);
        }
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function saveDuty(input: {
  id?: string;
  startDate: string;
  endDate: string;
  repeatWeekly: boolean;
  repeatDays: number[];
  staffIds: string[];
  taskIds: string[];
}) {
  await requireAdmin();
  if (
    !input ||
    typeof input.startDate !== "string" ||
    typeof input.endDate !== "string" ||
    !isValidDate(input.startDate) ||
    !isValidDate(input.endDate) ||
    input.endDate < input.startDate
  ) {
    throw new Error("Choose a valid start and end date.");
  }
  const dutyId = input.id === undefined ? undefined : readDutyId(input.id);
  if (typeof input.repeatWeekly !== "boolean" || !Array.isArray(input.repeatDays)) {
    throw new Error("Choose valid repeat days.");
  }
  const repeatDays = [...new Set(input.repeatDays)];
  if (repeatDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new Error("Choose valid repeat days.");
  }
  if (input.repeatWeekly && repeatDays.length === 0) {
    throw new Error("Select at least one day for the weekly repeat.");
  }
  if (input.repeatWeekly && input.endDate > getOneYearLater(input.startDate)) {
    throw new Error("Weekly duty schedules cannot span more than one year.");
  }
  if (!input.repeatWeekly && input.startDate !== input.endDate) {
    throw new Error("Without repeat, choose one duty date.");
  }
  if (input.id && input.repeatWeekly) {
    throw new Error("Edit one duty at a time; create a new duty to repeat.");
  }
  if (!Array.isArray(input.staffIds) || input.staffIds.some((id) => typeof id !== "string")) {
    throw new Error("Choose valid staff members.");
  }
  const staffIds = [...new Set(input.staffIds)];
  if (staffIds.length < 2) throw new Error("Select at least two active staff members.");
  if (!Array.isArray(input.taskIds) || input.taskIds.some((id) => typeof id !== "string")) {
    throw new Error("Choose valid cleaning tasks.");
  }
  const taskIds = [...new Set(input.taskIds.map((id) => readTaskId(id)))];
  if (taskIds.length === 0) throw new Error("Select at least one cleaning task.");

  const dates = getDutyDates(input.startDate, input.endDate, input.repeatWeekly ? repeatDays : []);
  if (dates.length === 0) throw new Error("The selected weekdays do not occur in this date range.");

  const db = getDb();
  const connection = await db.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const placeholders = staffIds.map(() => "?").join(", ");
    const [staffRows] = await connection.execute<StaffRow[]>(
      `SELECT profiles.id, profiles.full_name, profiles.staff_id, profiles.email, profiles.is_active
       FROM profiles
       INNER JOIN roles ON roles.id = profiles.role_id
       WHERE LOWER(roles.role_name) = 'staff'
         AND profiles.is_active = 1
         AND profiles.id IN (${placeholders})
       FOR UPDATE`,
      staffIds,
    );
    if (staffRows.length !== staffIds.length) {
      throw new Error("Choose at least two active staff members.");
    }

    const [activeTaskRows] = await connection.execute<TaskRow[]>(
      "SELECT id, task_name, description, is_active FROM cleaning_tasks WHERE is_active = 1 FOR UPDATE",
    );
    const legacyTaskIds = activeTaskRows.map((task) => String(task.id));
    if (taskIds.some((id) => !legacyTaskIds.includes(id))) {
      throw new Error("Choose only active cleaning tasks.");
    }

    const datePlaceholders = dates.map(() => "?").join(", ");
    const [dateRows] = await connection.execute<DutyRow[]>(
      `SELECT id, DATE_FORMAT(duty_date, '%Y-%m-%d') AS date, staff_ids, task_ids, completed_task_ids
       FROM duties WHERE duty_date IN (${datePlaceholders}) FOR UPDATE`,
      dates,
    );
    const dutiesByDate = new Map(dateRows.map((row) => [row.date, mapDuty(row, legacyTaskIds)]));
    let source: Duty | null = null;
    if (dutyId) {
      const [sourceRows] = await connection.execute<DutyRow[]>(
        `SELECT id, DATE_FORMAT(duty_date, '%Y-%m-%d') AS date, staff_ids, task_ids, completed_task_ids
         FROM duties WHERE id = ? FOR UPDATE`,
        [dutyId],
      );
      source = sourceRows[0] ? mapDuty(sourceRows[0], legacyTaskIds) : null;
    }
    if (dutyId && !source) throw new Error("The cleaning duty no longer exists.");

    if (source) {
      const date = dates[0];
      const existing = dutiesByDate.get(date);
      if (existing && existing.id !== source.id) {
        const mergedStaff = [...new Set([...existing.staffIds, ...staffIds])];
        const mergedTasks = [...new Set([...existing.taskIds, ...taskIds])];
        const completedTaskIds = [...new Set([
          ...existing.completedTaskIds,
          ...source.completedTaskIds.filter((id) => mergedTasks.includes(id)),
        ])].filter((id) => mergedTasks.includes(id));
        await connection.execute(
          "UPDATE duties SET staff_ids = ?, task_ids = ?, completed_task_ids = ? WHERE id = ?",
          [JSON.stringify(mergedStaff), JSON.stringify(mergedTasks), JSON.stringify(completedTaskIds), existing.id],
        );
        await connection.execute("DELETE FROM duties WHERE id = ?", [source.id]);
      } else {
        const completedTaskIds = source.completedTaskIds.filter((id) => taskIds.includes(id));
        await connection.execute(
          "UPDATE duties SET duty_date = ?, staff_ids = ?, task_ids = ?, completed_task_ids = ? WHERE id = ?",
          [date, JSON.stringify(staffIds), JSON.stringify(taskIds), JSON.stringify(completedTaskIds), source.id],
        );
      }
    } else {
      for (const date of dates) {
        const existing = dutiesByDate.get(date);
        if (existing) {
          const mergedStaff = [...new Set([...existing.staffIds, ...staffIds])];
          const mergedTasks = [...new Set([...existing.taskIds, ...taskIds])];
          const completedTaskIds = existing.completedTaskIds.filter((id) => mergedTasks.includes(id));
          await connection.execute(
            "UPDATE duties SET staff_ids = ?, task_ids = ?, completed_task_ids = ? WHERE id = ?",
            [JSON.stringify(mergedStaff), JSON.stringify(mergedTasks), JSON.stringify(completedTaskIds), existing.id],
          );
        } else {
          await connection.execute(
            "INSERT INTO duties (duty_date, staff_ids, task_ids, completed_task_ids) VALUES (?, ?, ?, ?)",
            [date, JSON.stringify(staffIds), JSON.stringify(taskIds), JSON.stringify([])],
          );
        }
      }
    }
    await connection.commit();
    transactionStarted = false;
    return dates;
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteDuty(dutyId: string) {
  await requireAdmin();
  const id = readDutyId(dutyId);
  const [result] = await getDb().execute("DELETE FROM duties WHERE id = ?", [id]);
  if (!("affectedRows" in result) || result.affectedRows !== 1) {
    throw new Error("The cleaning duty no longer exists.");
  }
}

export async function toggleDutyTask(dutyId: string, taskId: string) {
  await requireAdmin();
  const dutyKey = readDutyId(dutyId);
  const id = readTaskId(taskId);
  const connection = await getDb().getConnection();
  try {
    await connection.beginTransaction();
    const [taskRows] = await connection.execute<TaskRow[]>(
      "SELECT id, task_name, description, is_active FROM cleaning_tasks WHERE id = ? AND is_active = 1 LIMIT 1",
      [id],
    );
    if (!taskRows[0]) throw new Error("The cleaning task is no longer active.");
    const [rows] = await connection.execute<DutyRow[]>(
      `SELECT id, DATE_FORMAT(duty_date, '%Y-%m-%d') AS date, staff_ids, task_ids, completed_task_ids
       FROM duties WHERE id = ? FOR UPDATE`,
      [dutyKey],
    );
    if (!rows[0]) throw new Error("The cleaning duty no longer exists.");
    const duty = mapDuty(rows[0]);
    if (rows[0].task_ids != null && !duty.taskIds.includes(id)) {
      throw new Error("The cleaning task is not assigned to this duty.");
    }
    const completedTaskIds = duty.completedTaskIds.includes(id)
      ? duty.completedTaskIds.filter((completedId) => completedId !== id)
      : [...duty.completedTaskIds, id];
    await connection.execute(
      "UPDATE duties SET completed_task_ids = ? WHERE id = ?",
      [JSON.stringify(completedTaskIds), dutyKey],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
