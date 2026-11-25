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
};

type ScheduleTaskRow = RowDataPacket & {
  schedule_id: number | string;
  task_id: number | string;
  status: "Pending" | "Completed";
};

type TaskRow = RowDataPacket & {
  id: number | string;
  task_name: string;
  description: string | null;
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "staff") redirect("/admin");

  const today = dateKey(new Date());
  const [dutyResult, scheduleTaskResult, taskResult] = await Promise.all([
    getDb().execute<DutyRow[]>(
      `SELECT id, DATE_FORMAT(duty_date, '%Y-%m-%d') AS date
       FROM duty_schedules
       WHERE duty_date >= ?
         AND EXISTS (
           SELECT 1 FROM duty_assignments
           WHERE duty_assignments.schedule_id = duty_schedules.id
             AND duty_assignments.staff_id = ?
         )
       ORDER BY duty_date, id`,
      [today, user.id],
    ),
    getDb().execute<ScheduleTaskRow[]>(
      `SELECT schedule_tasks.schedule_id, schedule_tasks.task_id, schedule_tasks.status
       FROM schedule_tasks
       INNER JOIN duty_schedules ON duty_schedules.id = schedule_tasks.schedule_id
       WHERE duty_schedules.duty_date >= ?
         AND EXISTS (
           SELECT 1 FROM duty_assignments
           WHERE duty_assignments.schedule_id = duty_schedules.id
             AND duty_assignments.staff_id = ?
         )
       ORDER BY schedule_tasks.schedule_id, schedule_tasks.id`,
      [today, user.id],
    ),
    getDb().execute<TaskRow[]>(
      "SELECT id, task_name, description FROM cleaning_tasks WHERE is_active = 1 ORDER BY task_name",
    ),
  ]);

  const scheduleTasksByDuty = new Map<string, ScheduleTaskRow[]>();
  for (const row of scheduleTaskResult[0]) {
    const scheduleId = String(row.schedule_id);
    scheduleTasksByDuty.set(scheduleId, [...(scheduleTasksByDuty.get(scheduleId) ?? []), row]);
  }
  const duties: Duty[] = dutyResult[0].map((row) => {
    const scheduleTasks = scheduleTasksByDuty.get(String(row.id)) ?? [];
    return {
      id: String(row.id),
      date: row.date,
      staffIds: [user.id],
      taskIds: scheduleTasks.map((task) => String(task.task_id)),
      completedTaskIds: scheduleTasks
        .filter((task) => task.status === "Completed")
        .map((task) => String(task.task_id)),
    };
  });
  const tasks: CleaningTask[] = taskResult[0].map((row) => ({
    id: String(row.id),
    label: row.task_name,
    description: row.description ?? "",
    active: true,
  }));
  return (
    <StaffDashboard
      name={user.name}
      email={user.email}
      today={today}
      duties={duties.map(({ id, date, taskIds, completedTaskIds }) => ({
        id,
        date,
        taskIds,
        completedTaskIds,
      }))}
      tasks={tasks}
    />
  );
}