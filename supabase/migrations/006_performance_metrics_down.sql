-- Down migration for 006_performance_metrics.sql
-- Removes performance metrics tables, views, and functions

-- Drop function first
DROP FUNCTION IF EXISTS cleanup_old_performance_metrics();

-- Drop views
DROP VIEW IF EXISTS performance_stats_daily;
DROP VIEW IF EXISTS performance_stats_hourly;

-- Drop indexes
DROP INDEX IF EXISTS idx_performance_metrics_duration;
DROP INDEX IF EXISTS idx_performance_metrics_operation_time;
DROP INDEX IF EXISTS idx_performance_metrics_recorded_at;
DROP INDEX IF EXISTS idx_performance_metrics_operation;

-- Drop table
DROP TABLE IF EXISTS performance_metrics;
