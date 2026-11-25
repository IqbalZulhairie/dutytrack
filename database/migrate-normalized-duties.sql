CREATE TABLE IF NOT EXISTS duty_schedules (
  id INT NOT NULL AUTO_INCREMENT,
  duty_date DATE NOT NULL,
  status ENUM('Scheduled', 'Completed') NOT NULL DEFAULT 'Scheduled',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS duty_assignments (
  id INT NOT NULL AUTO_INCREMENT,
  schedule_id INT NOT NULL,
  staff_id INT NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY schedule_id (schedule_id),
  KEY staff_id (staff_id),
  CONSTRAINT duty_assignments_schedule_fk FOREIGN KEY (schedule_id)
    REFERENCES duty_schedules (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT duty_assignments_staff_fk FOREIGN KEY (staff_id)
    REFERENCES profiles (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS schedule_tasks (
  id INT NOT NULL AUTO_INCREMENT,
  schedule_id INT NOT NULL,
  task_id INT NOT NULL,
  status ENUM('Pending', 'Completed') NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY schedule_id (schedule_id),
  KEY task_id (task_id),
  CONSTRAINT schedule_tasks_schedule_fk FOREIGN KEY (schedule_id)
    REFERENCES duty_schedules (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT schedule_tasks_task_fk FOREIGN KEY (task_id)
    REFERENCES cleaning_tasks (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO duty_schedules (id, duty_date, status, created_at)
SELECT duties.id, duties.duty_date, 'Scheduled', duties.created_at
FROM duties
WHERE NOT EXISTS (
  SELECT 1 FROM duty_schedules
  WHERE duty_schedules.id = duties.id
);

INSERT INTO duty_assignments (schedule_id, staff_id)
SELECT duties.id, assigned_staff.staff_id
FROM duties
JOIN JSON_TABLE(
  duties.staff_ids,
  '$[*]' COLUMNS (staff_id INT PATH '$')
) AS assigned_staff
WHERE NOT EXISTS (
  SELECT 1
  FROM duty_assignments
  WHERE duty_assignments.schedule_id = duties.id
    AND duty_assignments.staff_id = assigned_staff.staff_id
);

INSERT INTO schedule_tasks (schedule_id, task_id, status)
SELECT legacy_tasks.schedule_id,
       legacy_tasks.task_id,
       IF(JSON_CONTAINS(legacy_tasks.completed_task_ids, JSON_ARRAY(legacy_tasks.task_id)), 'Completed', 'Pending')
FROM (
  SELECT duties.id AS schedule_id, assigned_tasks.task_id, duties.completed_task_ids
  FROM duties
  JOIN JSON_TABLE(
    duties.task_ids,
    '$[*]' COLUMNS (task_id INT PATH '$')
  ) AS assigned_tasks
  WHERE duties.task_ids IS NOT NULL

  UNION ALL

  SELECT duties.id AS schedule_id, cleaning_tasks.id AS task_id, duties.completed_task_ids
  FROM duties
  JOIN cleaning_tasks ON cleaning_tasks.is_active = 1
  WHERE duties.task_ids IS NULL
) AS legacy_tasks
WHERE NOT EXISTS (
  SELECT 1
  FROM schedule_tasks
  WHERE schedule_tasks.schedule_id = legacy_tasks.schedule_id
    AND schedule_tasks.task_id = legacy_tasks.task_id
);

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
