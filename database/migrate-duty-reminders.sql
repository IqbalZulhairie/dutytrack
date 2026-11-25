CREATE TABLE IF NOT EXISTS duty_reminder_deliveries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  duty_id INT NOT NULL,
  staff_id INT NOT NULL,
  duty_date DATE NOT NULL,
  status ENUM('pending', 'sending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  sent_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_duty_reminder_staff_duty (duty_id, staff_id),
  KEY idx_duty_reminder_date_status (duty_date, status),
  CONSTRAINT duty_reminder_deliveries_duty_fk FOREIGN KEY (duty_id)
    REFERENCES duty_schedules (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT duty_reminder_deliveries_staff_fk FOREIGN KEY (staff_id)
    REFERENCES profiles (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS duty_reminder_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  reminder_time TIME NOT NULL DEFAULT '08:00:00'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO duty_reminder_settings (id, reminder_time)
VALUES (1, '08:00:00');
