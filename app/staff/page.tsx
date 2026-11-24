import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import type { CleaningTask, Duty } from "@/lib/types";
import StaffDashboard from "./dashboard";

export const instant = false;

type DutyRow = RowDataPacket & {
  id: number | string;
  date: string;
  staff_ids: unknown;
  task_ids: unknown;
  completed_task_ids: unknown;
};

type TaskRow = RowDataPacket & {
  id: number | string;
  task_name: string;
  description: string | null;
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

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "staff") redirect("/admin");

  const today = dateKey(new Date());
  const [dutyResult, taskResult] = await Promise.all([
    getDb().execute<DutyRow[]>(
      `SELECT id, DATE_FORMAT(duty_date, '%Y-%m-%d') AS date, staff_ids, task_ids, completed_task_ids
       FROM duties
       WHERE duty_date >= ?
         AND (
           JSON_CONTAINS(staff_ids, JSON_QUOTE(?))
           OR JSON_CONTAINS(staff_ids, ?)
         )
       ORDER BY duty_date`,
      [today, user.id, user.id],
    ),
    getDb().execute<TaskRow[]>(
      "SELECT id, task_name, description FROM cleaning_tasks WHERE is_active = 1 ORDER BY task_name",
    ),
  ]);

  const duties: Duty[] = dutyResult[0]
    .map((row) => ({
      id: String(row.id),
      date: row.date,
      staffIds: readStringArray(row.staff_ids, "duty staff"),
      taskIds: row.task_ids == null ? taskResult[0].map((task) => String(task.id)) : readStringArray(row.task_ids, "duty task"),
      completedTaskIds: readStringArray(row.completed_task_ids, "completed task"),
    }))
    .filter((duty) => duty.staffIds.includes(user.id));
  const tasks: CleaningTask[] = taskResult[0].map((row) => ({
    id: String(row.id),
    label: row.task_name,
    description: row.description ?? "",
    active: true,
  }));
  const todayDuty = duties.find((duty) => duty.date === today);

  return (
    <StaffDashboard
      name={user.name}
      email={user.email}
      today={today}
      todayDuty={
        todayDuty
          ? {
              id: todayDuty.id,
              date: todayDuty.date,
              taskIds: todayDuty.taskIds,
              completedTaskIds: todayDuty.completedTaskIds,
            }
          : null
      }
      upcomingDuties={duties
        .filter((duty) => duty.date > today)
        .map(({ id, date }) => ({ id, date }))}
      tasks={tasks}
    />
  );
}