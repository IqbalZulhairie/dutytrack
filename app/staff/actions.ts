"use server";

import type { RowDataPacket } from "mysql2/promise";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { updateDutyScheduleStatus } from "@/lib/duty-schedule-status";

type DutyRow = RowDataPacket & {
  id: number | string;
};

type ScheduleTaskRow = RowDataPacket & {
  task_id: number | string;
  status: "Pending" | "Completed";
};

type TaskRow = RowDataPacket & {
  id: number | string;
};

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

export async function toggleMyDutyTask(dutyId: string, taskId: string): Promise<string[]> {
  const user = await requireUser();
  if (user.role !== "staff") throw new Error("Staff access is required.");
  const dutyKey = readDutyId(dutyId);
  const taskKey = readTaskId(taskId);

  const connection = await getDb().getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [taskRows] = await connection.execute<TaskRow[]>(
      "SELECT id FROM cleaning_tasks WHERE id = ? AND is_active = 1 LIMIT 1",
      [taskKey],
    );
    if (!taskRows[0]) throw new Error("The cleaning task is no longer active.");

    const [dutyRows] = await connection.execute<DutyRow[]>(
      `SELECT id
       FROM duty_schedules
       WHERE id = ? AND duty_date = CURDATE()
       FOR UPDATE`,
      [dutyKey],
    );
    if (!dutyRows[0]) throw new Error("No cleaning duty is assigned for today.");
    const [assignmentRows] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM duty_assignments WHERE schedule_id = ? AND staff_id = ? LIMIT 1",
      [dutyKey, user.id],
    );
    if (!assignmentRows[0]) {
      throw new Error("You are not assigned to this cleaning duty.");
    }
    const [scheduleTaskRows] = await connection.execute<ScheduleTaskRow[]>(
      "SELECT task_id, status FROM schedule_tasks WHERE schedule_id = ? AND task_id = ? FOR UPDATE",
      [dutyKey, taskKey],
    );
    if (!scheduleTaskRows[0]) {
      throw new Error("The cleaning task is not assigned to this duty.");
    }

    await connection.execute(
      "UPDATE schedule_tasks SET status = ? WHERE schedule_id = ? AND task_id = ?",
      [scheduleTaskRows[0].status === "Completed" ? "Pending" : "Completed", dutyKey, taskKey],
    );
    const [completedRows] = await connection.execute<ScheduleTaskRow[]>(
      "SELECT task_id, status FROM schedule_tasks WHERE schedule_id = ? AND status = 'Completed'",
      [dutyKey],
    );
    await updateDutyScheduleStatus(connection, dutyKey);
    await connection.commit();
    transactionStarted = false;
    return completedRows.map((row) => String(row.task_id));
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
