ALTER TABLE duty_reminder_deliveries
  ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST;

UPDATE duty_reminder_deliveries AS latest
JOIN (
  SELECT duty_id, staff_id, SUM(attempt_count) AS total_attempts, MAX(updated_at) AS latest_updated_at
  FROM duty_reminder_deliveries
  GROUP BY duty_id, staff_id
  HAVING COUNT(*) > 1
) AS duplicate_attempts
  ON duplicate_attempts.duty_id = latest.duty_id
  AND duplicate_attempts.staff_id = latest.staff_id
  AND duplicate_attempts.latest_updated_at = latest.updated_at
SET latest.attempt_count = duplicate_attempts.total_attempts;

DELETE older
FROM duty_reminder_deliveries AS older
JOIN duty_reminder_deliveries AS newer
  ON newer.duty_id = older.duty_id
  AND newer.staff_id = older.staff_id
  AND (
    newer.updated_at > older.updated_at
    OR (newer.updated_at = older.updated_at AND newer.id > older.id)
  );

ALTER TABLE duty_reminder_deliveries
  ADD UNIQUE KEY uq_duty_reminder_staff_duty (duty_id, staff_id),
  DROP FOREIGN KEY duty_reminder_deliveries_ibfk_2,
  ADD CONSTRAINT duty_reminder_deliveries_staff_fk FOREIGN KEY (staff_id)
    REFERENCES profiles (id) ON DELETE RESTRICT ON UPDATE RESTRICT;
