-- 002_initial_schema_down.sql

DROP TABLE IF EXISTS leave_days;
ALTER TABLE leaves DROP COLUMN total_days;
DROP TABLE IF EXISTS holidays;