/**
 * Core domain types shared between services/api and services/worker.
 *
 * Naming convention: these types use camelCase (application-layer
 * convention). The Postgres schema uses snake_case column
 * names (e.g. `cancel_requested`, `correlation_id`) per SQL convention —
 * the data-access layer is responsible for translating between the two.
 * Don't let the two conventions drift into each other in either direction.
 */

export type JobStatus =
  | "pending"
  | "queued"
  | "processing"
  | "retrying"
  | "completed"
  | "dead_lettered"
  | "cancelled";

/**
 * Why a single attempt failed. A different granularity than
 * `DeadLetterReason` below — see "Two related but distinct
 * classifications" in docs/02-ARCHITECTURE.md.
 */
export type JobErrorType = "retryable" | "non_retryable" | "timeout";

/** Why a job's overall lifecycle ended the way it did — set once, on a terminal state. */
export type DeadLetterReason = "retries_exhausted" | "poison_message";

/**
 * The durable record of a job, as persisted in Postgres. Postgres is the
 * source of truth for job state — RabbitMQ messages are a transport, not
 * a system of record.
 */
export interface Job {
  id: string;
  type: string;
  payload: unknown;
  status: JobStatus;

  attempts: number;
  maxAttempts: number;

  /** 0 (lowest) – 10 (highest). Default 5.*/
  priority: number;

  /** Per-job-type execution deadline, enforced by the worker. */
  timeoutMs: number;

  /** Optional client-supplied key for deduplication. */
  idempotencyKey: string | null;

  /** Generated or propagated at submission time; carried through every hop.*/
  correlationId: string;

  /** Set via POST /jobs/:id/cancel; checked cooperatively by the worker. */
  cancelRequested: boolean;

  /** Set only once the job reaches `dead_lettered`. */
  deadLetterReason: DeadLetterReason | null;

  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/** Append-only audit log of every state transition a job goes through. */
export interface JobEvent {
  id: string;
  jobId: string;
  correlationId: string;
  fromStatus: JobStatus | null;
  toStatus: JobStatus;
  errorType: JobErrorType | null;
  errorMessage: string | null;
  createdAt: string; // ISO 8601
}

/**
 * The shape of the message actually published to / consumed from
 * RabbitMQ — deliberately a subset of `Job`, only what a worker needs to
 * process it. Every field here must be explicitly carried forward by
 * hand whenever the worker republishes a message (e.g. into a retry
 * queue) — RabbitMQ does not do this automatically except on its own
 * TTL-driven dead-lettering.
 */
export interface JobMessage {
  jobId: string;
  type: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  priority: number;
  timeoutMs: number;
  correlationId: string;
}