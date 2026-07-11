import { pool } from "./pool.js";
import type { ErrorClassification } from "@job-platform/shared";

export async function markJobProcessing(id: string, correlationId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Known simplification: hardcodes 'queued' as fromStatus, since M3's
    // only real path into 'processing' is from 'queued'. Once Milestone 4
    // lets a job re-enter 'processing' from 'retrying' too, this needs to
    // read the actual prior status instead of assuming it.
    await client.query("UPDATE jobs SET status = 'processing' WHERE id = $1", [id]);
    await client.query(
      `INSERT INTO job_events (job_id, correlation_id, from_status, to_status)
       VALUES ($1, $2, 'queued', 'processing')`,
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

export async function markJobCompleted(id: string, correlationId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE jobs SET status = 'completed' WHERE id = $1", [id]);
    await client.query(
      `INSERT INTO job_events (job_id, correlation_id, from_status, to_status)
       VALUES ($1, $2, 'processing', 'completed')`,
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

export async function markJobFailed(
  id: string,
  correlationId: string,
  classification: ErrorClassification,
): Promise<void> {
  const isPoison = classification.errorType === "non_retryable";
  const newStatus = isPoison ? "dead_lettered" : "retrying";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (isPoison) {
      await client.query(
        `UPDATE jobs SET status = $1, dead_letter_reason = 'poison_message' WHERE id = $2`,
        [newStatus, id],
      );
    } else {
      await client.query("UPDATE jobs SET status = $1 WHERE id = $2", [newStatus, id]);
    }
    await client.query(
      `INSERT INTO job_events (job_id, correlation_id, from_status, to_status, error_type, error_message)
       VALUES ($1, $2, 'processing', $3, $4, $5)`,
      [id, correlationId, newStatus, classification.errorType, classification.message],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}