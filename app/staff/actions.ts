"use server";

import type { RowDataPacket } from "mysql2/promise";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

type DutyRow = RowDataPacket & {
  staff_ids: unknown;
  task_ids: unknown;
  completed_task_ids: unknown;
};

type TaskRow = RowDataPacket & {
  id: number | string;
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
  if (!Array.isArray(parsed)) throw new Error(`The database contains invalid ${field} data.`);

  return parsed.map((item) => {
    if (typeof item === "string") return item;
    if (typeof item === "number" && Number.isSafeInteger(item) && item > 0) return String(item);
    throw new Error(`The database contains invalid ${field} data.`);
  });
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
      `SELECT staff_ids, task_ids, completed_task_ids
       FROM duties
       WHERE id = ? AND duty_date = CURDATE()
       FOR UPDATE`,
      [dutyKey],
    );
    const duty = dutyRows[0];
    if (!duty) throw new Error("No cleaning duty is assigned for today.");
    if (!readStringArray(duty.staff_ids, "duty staff").includes(user.id)) {
      throw new Error("You are not assigned to this cleaning duty.");
    }
    if (duty.task_ids != null && !readStringArray(duty.task_ids, "duty task").includes(taskKey)) {
      throw new Error("The cleaning task is not assigned to this duty.");
    }

    const completedTaskIds = readStringArray(duty.completed_task_ids, "completed task");
    const updatedTaskIds = completedTaskIds.includes(taskKey)
      ? completedTaskIds.filter((completedId) => completedId !== taskKey)
      : [...completedTaskIds, taskKey];
    await connection.execute(
      "UPDATE duties SET completed_task_ids = ? WHERE id = ?",
      [JSON.stringify(updatedTaskIds), dutyKey],
    );
    await connection.commit();
    transactionStarted = false;
    return updatedTaskIds;
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
