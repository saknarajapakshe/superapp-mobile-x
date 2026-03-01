-- 002_initial_schema.sql

CREATE TABLE IF NOT EXISTS holidays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL
);

ALTER TABLE leaves
  ADD COLUMN total_days DECIMAL(3,1) NOT NULL DEFAULT 0.0;

CREATE TABLE IF NOT EXISTS leave_days (
    id VARCHAR(255) PRIMARY KEY,
    leave_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    is_half_day BOOLEAN NOT NULL DEFAULT FALSE,
    half_day_period VARCHAR(10) NULL DEFAULT NULL,
    FOREIGN KEY (leave_id) REFERENCES leaves(id) ON DELETE CASCADE,
    UNIQUE KEY uq_leave_date (leave_id, date)
);