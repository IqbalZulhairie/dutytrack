import type { PoolConnection } from "mysql2/promise";

export async function updateDutyScheduleStatus(connection: PoolConnection, scheduleId: string) {
  await connection.execute(
    `UPDATE duty_schedules
     SET status = CASE
       WHEN EXISTS (SELECT 1 FROM schedule_tasks WHERE schedule_id = ?)
         AND NOT EXISTS (
           SELECT 1 FROM schedule_tasks
           WHERE schedule_id = ? AND status <> 'Completed'
         )
       THEN 'Completed'
       ELSE 'Scheduled'
     END
     WHERE id = ?`,
    [scheduleId, scheduleId, scheduleId],
  );
}
