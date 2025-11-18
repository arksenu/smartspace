-- Create table for performance metrics
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  metadata JSONB,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) -- Optional user reference
);

-- Indexes for efficient querying
CREATE INDEX idx_performance_metrics_operation ON performance_metrics (operation);
CREATE INDEX idx_performance_metrics_recorded_at ON performance_metrics (recorded_at DESC);
CREATE INDEX idx_performance_metrics_operation_time ON performance_metrics (operation, recorded_at DESC);
CREATE INDEX idx_performance_metrics_duration ON performance_metrics (duration_ms);

-- Create a view for hourly statistics
CREATE OR REPLACE VIEW performance_stats_hourly AS
SELECT
  operation,
  DATE_TRUNC('hour', recorded_at) as hour,
  COUNT(*) as count,
  ROUND(AVG(duration_ms)) as avg_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) as p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_ms,
  MIN(duration_ms) as min_ms,
  MAX(duration_ms) as max_ms
FROM performance_metrics
GROUP BY operation, DATE_TRUNC('hour', recorded_at);

-- Create a view for daily statistics
CREATE OR REPLACE VIEW performance_stats_daily AS
SELECT
  operation,
  DATE_TRUNC('day', recorded_at) as day,
  COUNT(*) as count,
  ROUND(AVG(duration_ms)) as avg_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) as p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_ms,
  MIN(duration_ms) as min_ms,
  MAX(duration_ms) as max_ms
FROM performance_metrics
GROUP BY operation, DATE_TRUNC('day', recorded_at);

-- Function to clean up old metrics (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_performance_metrics()
RETURNS void AS $$
BEGIN
  DELETE FROM performance_metrics WHERE recorded_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Optional: Set up a scheduled job to clean up old metrics
-- This would need to be done through Supabase dashboard or external cron
