ALTER TABLE schedule_tasks
  MODIFY COLUMN status ENUM('Pending', 'Complete', 'Completed') NOT NULL DEFAULT 'Pending';

UPDATE schedule_tasks
SET status = 'Completed'
WHERE status = 'Complete';

ALTER TABLE schedule_tasks
  MODIFY COLUMN status ENUM('Pending', 'Completed') NOT NULL DEFAULT 'Pending';

ALTER TABLE duty_schedules
  MODIFY COLUMN status ENUM('Scheduled', 'Completed') NOT NULL DEFAULT 'Scheduled';

UPDATE duty_schedules
SET status = CASE
  WHEN EXISTS (SELECT 1 FROM schedule_tasks WHERE schedule_id = duty_schedules.id)
    AND NOT EXISTS (
      SELECT 1 FROM schedule_tasks
      WHERE schedule_id = duty_schedules.id AND status <> 'Completed'
    )
  THEN 'Completed'
  ELSE 'Scheduled'
END;
