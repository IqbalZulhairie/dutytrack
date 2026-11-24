ALTER TABLE sessions
  DROP FOREIGN KEY fk_sessions_user,
  MODIFY COLUMN user_id INT NOT NULL,
  ADD CONSTRAINT fk_sessions_profile
    FOREIGN KEY (user_id) REFERENCES profiles (id) ON DELETE CASCADE;

ALTER TABLE profiles
  ADD CONSTRAINT uq_profiles_email UNIQUE (email),
  ADD CONSTRAINT uq_profiles_staff_id UNIQUE (staff_id);
