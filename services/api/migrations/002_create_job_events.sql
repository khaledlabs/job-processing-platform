CREATE TABLE job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  correlation_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  error_type TEXT
    CHECK (error_type IN ('retryable', 'non_retryable', 'timeout')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_events_job_id ON job_events (job_id);