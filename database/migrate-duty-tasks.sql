CREATE TABLE IF NOT EXISTS duties (
  id INT NOT NULL AUTO_INCREMENT,
  duty_date DATE NOT NULL,
  staff_ids JSON NOT NULL,
  task_ids JSON NULL,
  completed_task_ids JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @duty_date_unique_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'duties'
    AND INDEX_NAME = 'duty_date'
);

SET @duty_date_unique_migration = IF(
  @duty_date_unique_exists > 0,
  'ALTER TABLE duties DROP INDEX duty_date',
  'SELECT 1'
);

PREPARE duty_date_unique_statement FROM @duty_date_unique_migration;
EXECUTE duty_date_unique_statement;
DEALLOCATE PREPARE duty_date_unique_statement;

ALTER TABLE duties
  MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;

SET @task_ids_column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'duties'
    AND COLUMN_NAME = 'task_ids'
);

SET @task_ids_migration = IF(
  @task_ids_column_exists = 0,
  'ALTER TABLE duties ADD COLUMN task_ids JSON NULL AFTER staff_ids',
  'SELECT 1'
);

PREPARE task_ids_statement FROM @task_ids_migration;
EXECUTE task_ids_statement;
DEALLOCATE PREPARE task_ids_statement;
