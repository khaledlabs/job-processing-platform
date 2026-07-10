import { pool } from "./pool.js";
import type { Job, JobEvent, JobStatus, DeadLetterReason, JobErrorType } from "@job-platform/shared";

interface JobRow {
  id: string;
  type: string;
  payload: unknown;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  priority: number;
  timeout_ms: number;
  idempotency_key: string | null;
  correlation_id: string;
  cancel_requested: boolean;
  dead_letter_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

interface JobEventRow {
  id: string;
  job_id: string;
  correlation_id: string;
  from_status: JobStatus | null;
  to_status: JobStatus;
  error_type: string | null;
  error_message: string | null;
  created_at: Date;
}

function mapRowToJob(row: JobRow): Job {
  return {
    id: row.id,
    type: row.type,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    priority: row.priority,
    timeoutMs: row.timeout_ms,
    idempotencyKey: row.idempotency_key,
    correlationId: row.correlation_id,
    cancelRequested: row.cancel_requested,
    deadLetterReason: row.dead_letter_reason as DeadLetterReason | null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapRowToJobEvent(row: JobEventRow): JobEvent {
  return {
    id: row.id,
    jobId: row.job_id,
    correlationId: row.correlation_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    errorType: row.error_type as JobErrorType | null,
    errorMessage: row.error_message,
    createdAt: row.created_at.toISOString(),
  };
}

export async function createJob(params: {
  type: string;
  payload: unknown;
  correlationId: string;
}): Promise<Job> {
  const client = await pool.connect(); // get a client from the pool
  try {
    await client.query("BEGIN"); // begin a transaction

    // insert the job into the jobs table and return the inserted row
    const insertResult = await client.query<JobRow>(  
      `INSERT INTO jobs (type, payload, correlation_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [params.type, params.payload, params.correlationId],
    );
    const row = insertResult.rows[0];
    if (!row) {
      throw new Error("job insert returned no row");
    }
// you create the first event NULL -> pending so event history start immedatily 
    await client.query(
      `INSERT INTO job_events (job_id, correlation_id, from_status, to_status)
       VALUES ($1, $2, NULL, $3)`,
      [row.id, params.correlationId, row.status],
    );
// if successful commit the transaction and return the job
    await client.query("COMMIT");
    return mapRowToJob(row);
  } catch (err) {
    await client.query("ROLLBACK"); // rollback the transaction on error
    throw err;
  } finally {
    client.release();
  }
}

export async function getJobById(
  id: string,
): Promise<{ job: Job; events: JobEvent[] } | null> {
  const jobResult = await pool.query<JobRow>("SELECT * FROM jobs WHERE id = $1", [id]);
  const row = jobResult.rows[0];
  if (!row) {
    return null;
  }

  const eventsResult = await pool.query<JobEventRow>(
    "SELECT * FROM job_events WHERE job_id = $1 ORDER BY created_at ASC",
    [id],
  );

  return {
    job: mapRowToJob(row),
    events: eventsResult.rows.map(mapRowToJobEvent),
  };
}

export async function listJobs(params: {
  status?: string;
  type?: string;
  limit: number;
}): Promise<Job[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.status) {
    values.push(params.status);
    conditions.push(`status = $${values.length}`);
  }
  if (params.type) {
    values.push(params.type);
    conditions.push(`type = $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  values.push(params.limit);

  const result = await pool.query<JobRow>(
    `SELECT * FROM jobs ${whereClause} ORDER BY created_at DESC LIMIT $${values.length}`,
    values,
  );

  return result.rows.map(mapRowToJob);
}
// markJobQueued updates the job status to 'queued' and records the transition in the job_events table. It uses a transaction to ensure both operations succeed or fail together.
export async function markJobQueued(id: string, correlationId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE jobs SET status = 'queued' WHERE id = $1", [id]);
    await client.query(
      `INSERT INTO job_events (job_id, correlation_id, from_status, to_status)
       VALUES ($1, $2, 'pending', 'queued')`,
      [id, correlationId],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}