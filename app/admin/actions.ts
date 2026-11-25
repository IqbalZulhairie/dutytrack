"use server";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getDutyDates, getOneYearLater } from "@/lib/duty-schedule";
import { updateDutyScheduleStatus } from "@/lib/duty-schedule-status";
import type { CleaningTask, Staff, Store } from "@/lib/types";

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
};

type DutyAssignmentRow = RowDataPacket & {
  schedule_id: number | string;
  staff_id: number | string;
};

type ScheduleTaskRow = RowDataPacket & {
  schedule_id: number | string;
  task_id: number | string;
  status: "Pending" | "Completed";
};

type ReminderSettingRow = RowDataPacket & {
  reminder_time: string;
};

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

async function removeSchedule(connection: PoolConnection, scheduleId: string) {
  await connection.execute("DELETE FROM duty_assignments WHERE schedule_id = ?", [scheduleId]);
  await connection.execute("DELETE FROM schedule_tasks WHERE schedule_id = ?", [scheduleId]);
  return connection.execute("DELETE FROM duty_schedules WHERE id = ?", [scheduleId]);
}

export async function getDashboardData(): Promise<Store> {
  await requireAdmin();
  const db = getDb();
  const [staffResult, taskResult, dutyResult, assignmentResult, scheduleTaskResult, reminderResult] = await Promise.all([
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
      `SELECT id, DATE_FORMAT(duty_date, '%Y-%m-%d') AS date
       FROM duty_schedules ORDER BY duty_date, id`,
    ),
    db.execute<DutyAssignmentRow[]>(
      `SELECT duty_assignments.schedule_id, duty_assignments.staff_id
       FROM duty_assignments
       INNER JOIN duty_schedules ON duty_schedules.id = duty_assignments.schedule_id
       ORDER BY duty_assignments.schedule_id, duty_assignments.id`,
    ),
    db.execute<ScheduleTaskRow[]>(
      `SELECT schedule_tasks.schedule_id, schedule_tasks.task_id, schedule_tasks.status
       FROM schedule_tasks
       INNER JOIN duty_schedules ON duty_schedules.id = schedule_tasks.schedule_id
       ORDER BY schedule_tasks.schedule_id, schedule_tasks.id`,
    ),
    db.execute<ReminderSettingRow[]>(
      "SELECT TIME_FORMAT(reminder_time, '%H:%i') AS reminder_time FROM duty_reminder_settings WHERE id = 1",
    ),
  ]);

  const reminderTime = reminderResult[0][0]?.reminder_time;
  if (!reminderTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) {
    throw new Error("The daily reminder time is missing or invalid.");
  }

  const staffIdsByDuty = new Map<string, string[]>();
  for (const row of assignmentResult[0]) {
    const dutyId = String(row.schedule_id);
    staffIdsByDuty.set(dutyId, [...(staffIdsByDuty.get(dutyId) ?? []), String(row.staff_id)]);
  }
  const tasksByDuty = new Map<string, ScheduleTaskRow[]>();
  for (const row of scheduleTaskResult[0]) {
    const dutyId = String(row.schedule_id);
    tasksByDuty.set(dutyId, [...(tasksByDuty.get(dutyId) ?? []), row]);
  }
  return {
    staff: staffResult[0].map(mapStaff),
    tasks: taskResult[0].map(mapTask),
    duties: dutyResult[0].map((row) => {
      const scheduleTasks = tasksByDuty.get(String(row.id)) ?? [];
      return {
        id: String(row.id),
        date: row.date,
        staffIds: staffIdsByDuty.get(String(row.id)) ?? [],
        taskIds: scheduleTasks.map((task) => String(task.task_id)),
        completedTaskIds: scheduleTasks
          .filter((task) => task.status === "Completed")
          .map((task) => String(task.task_id)),
      };
    }),
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
      const [assignmentRows] = await connection.execute<DutyAssignmentRow[]>(
        `SELECT duty_assignments.schedule_id, duty_assignments.staff_id
         FROM duty_assignments
         INNER JOIN duty_schedules ON duty_schedules.id = duty_assignments.schedule_id
         WHERE duty_schedules.duty_date >= ?
         FOR UPDATE`,
        [input.today],
      );
      const staffIdsByDuty = new Map<string, string[]>();
      for (const row of assignmentRows) {
        const scheduleId = String(row.schedule_id);
        staffIdsByDuty.set(scheduleId, [...(staffIdsByDuty.get(scheduleId) ?? []), String(row.staff_id)]);
      }
      for (const [scheduleId, assignedStaffIds] of staffIdsByDuty) {
        const staffIds = assignedStaffIds.filter((staffId) => staffId !== input.id);
        if (staffIds.length === assignedStaffIds.length) continue;
        if (staffIds.length < 2) {
          await removeSchedule(connection, scheduleId);
        } else {
          await connection.execute(
            "DELETE FROM duty_assignments WHERE schedule_id = ? AND staff_id = ?",
            [scheduleId, input.id],
          );
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
  const staffIds = [...new Set(input.staffIds.map((id) => readProfileId(id)))];
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
    const activeTaskIds = activeTaskRows.map((task) => String(task.id));
    if (taskIds.some((id) => !activeTaskIds.includes(id))) {
      throw new Error("Choose only active cleaning tasks.");
    }

    let completedTaskIds: string[] = [];
    if (dutyId) {
      const [sourceRows] = await connection.execute<DutyRow[]>(
        `SELECT id, DATE_FORMAT(duty_date, '%Y-%m-%d') AS date
         FROM duty_schedules WHERE id = ? FOR UPDATE`,
        [dutyId],
      );
      if (!sourceRows[0]) throw new Error("The cleaning duty no longer exists.");
      const [scheduleTaskRows] = await connection.execute<ScheduleTaskRow[]>(
        "SELECT schedule_id, task_id, status FROM schedule_tasks WHERE schedule_id = ? FOR UPDATE",
        [dutyId],
      );
      completedTaskIds = scheduleTaskRows
        .filter((task) => task.status === "Completed")
        .map((task) => String(task.task_id))
        .filter((id) => taskIds.includes(id));
      await connection.execute("UPDATE duty_schedules SET duty_date = ? WHERE id = ?", [dates[0], dutyId]);
      await connection.execute("DELETE FROM duty_assignments WHERE schedule_id = ?", [dutyId]);
      await connection.execute("DELETE FROM schedule_tasks WHERE schedule_id = ?", [dutyId]);
      for (const staffId of staffIds) {
        await connection.execute(
          "INSERT INTO duty_assignments (schedule_id, staff_id) VALUES (?, ?)",
          [dutyId, staffId],
        );
      }
      for (const taskId of taskIds) {
        await connection.execute(
          "INSERT INTO schedule_tasks (schedule_id, task_id, status) VALUES (?, ?, ?)",
          [dutyId, taskId, completedTaskIds.includes(taskId) ? "Completed" : "Pending"],
        );
      }
      await updateDutyScheduleStatus(connection, dutyId);
    } else {
      for (const date of dates) {
        const [result] = await connection.execute<ResultSetHeader>(
          "INSERT INTO duty_schedules (duty_date, status) VALUES (?, 'Scheduled')",
          [date],
        );
        if (!Number.isSafeInteger(result.insertId) || result.insertId < 1) {
          throw new Error("Could not retrieve the new duty schedule ID.");
        }
        const scheduleId = String(result.insertId);
        for (const staffId of staffIds) {
          await connection.execute(
            "INSERT INTO duty_assignments (schedule_id, staff_id) VALUES (?, ?)",
            [scheduleId, staffId],
          );
        }
        for (const taskId of taskIds) {
          await connection.execute(
            "INSERT INTO schedule_tasks (schedule_id, task_id, status) VALUES (?, ?, 'Pending')",
            [scheduleId, taskId],
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
  const connection = await getDb().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await removeSchedule(connection, id);
    if (!("affectedRows" in result) || result.affectedRows !== 1) {
      throw new Error("The cleaning duty no longer exists.");
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
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
      `SELECT id, DATE_FORMAT(duty_date, '%Y-%m-%d') AS date
       FROM duty_schedules WHERE id = ? FOR UPDATE`,
      [dutyKey],
    );
    if (!rows[0]) throw new Error("The cleaning duty no longer exists.");
    const [scheduleTaskRows] = await connection.execute<ScheduleTaskRow[]>(
      "SELECT schedule_id, task_id, status FROM schedule_tasks WHERE schedule_id = ? AND task_id = ? FOR UPDATE",
      [dutyKey, id],
    );
    if (!scheduleTaskRows[0]) {
      throw new Error("The cleaning task is not assigned to this duty.");
    }
    await connection.execute(
      "UPDATE schedule_tasks SET status = ? WHERE schedule_id = ? AND task_id = ?",
      [scheduleTaskRows[0].status === "Completed" ? "Pending" : "Completed", dutyKey, id],
    );
    await updateDutyScheduleStatus(connection, dutyKey);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
