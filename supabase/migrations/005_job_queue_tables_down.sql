-- Down migration for 005_job_queue_tables.sql
-- Removes job queue and failed jobs tables

-- Drop function first (depends on the table)
DROP FUNCTION IF EXISTS cleanup_old_failed_jobs();

-- Drop indexes
DROP INDEX IF EXISTS idx_failed_jobs_date;
DROP INDEX IF EXISTS idx_failed_jobs_type;
DROP INDEX IF EXISTS idx_job_queue_next_retry;
DROP INDEX IF EXISTS idx_job_queue_status;

-- Drop tables
DROP TABLE IF EXISTS failed_jobs;
DROP TABLE IF EXISTS job_queue;
