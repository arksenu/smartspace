-- Create table for job queue persistence
CREATE TABLE IF NOT EXISTS job_queue (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Index for efficient job retrieval
CREATE INDEX idx_job_queue_status ON job_queue (status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_job_queue_next_retry ON job_queue (next_retry_at) WHERE status = 'pending';

-- Create table for failed jobs (for manual investigation)
CREATE TABLE IF NOT EXISTS failed_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  attempts INTEGER,
  last_error TEXT,
  failed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding failed jobs by type
CREATE INDEX idx_failed_jobs_type ON failed_jobs (type);
CREATE INDEX idx_failed_jobs_date ON failed_jobs (failed_at);

-- Clean up old failed jobs after 30 days
CREATE OR REPLACE FUNCTION cleanup_old_failed_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM failed_jobs WHERE failed_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Optional: Set up a scheduled job to clean up old failed jobs
-- This would need to be done through Supabase dashboard or external cron
