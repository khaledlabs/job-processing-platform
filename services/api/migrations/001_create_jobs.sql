CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'queued', 'processing', 'retrying', 'completed', 'dead_lettered', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  priority INTEGER NOT NULL DEFAULT 5
    CHECK (priority BETWEEN 0 AND 10),
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  idempotency_key TEXT UNIQUE,
  correlation_id TEXT NOT NULL,
  cancel_requested BOOLEAN NOT NULL DEFAULT false,
  dead_letter_reason TEXT
    CHECK (dead_letter_reason IN ('retries_exhausted', 'poison_message')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_status ON jobs (status);
CREATE INDEX idx_jobs_type ON jobs (type);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_set_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();