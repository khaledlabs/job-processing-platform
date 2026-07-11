import type { JobErrorType } from "../types/job.js";

/**
 * A transient failure — a downstream timeout, a connection reset, a 503.
 * The job might succeed if tried again. Handlers should throw this (or
 * let a genuine timeout produce a TimeoutError, below) for anything
 * where retrying is a reasonable response.
 */
export class RetryableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RetryableError";
  }
}

/**
 * The job cannot succeed no matter how many times it's retried — a
 * malformed payload, a reference to something that doesn't exist, a job
 * type that was removed. Throwing this skips the retry ladder entirely
 * and routes straight to the DLQ (Milestone 5) — see the "poison
 * message" section of docs/02-ARCHITECTURE.md.
 */
export class NonRetryableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "NonRetryableError";
  }
}

/**
 * A handler exceeded its timeoutMs. Deliberately a *subclass* of
 * RetryableError, not a sibling — a timeout is retryable (see
 * docs/02-ARCHITECTURE.md's "Job timeout" section), but job_events
 * still needs to record specifically that it was a timeout, not a
 * generic retryable failure, hence the distinct class + errorType.
 */
export class TimeoutError extends RetryableError {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export interface ErrorClassification {
  errorType: JobErrorType;
  message: string;
}

/**
 * Turns whatever a handler actually threw into the classification
 * job_events needs. Handles the "well-behaved handler" cases explicitly;
 * anything else (a plain Error, or a non-Error value someone threw) is
 * treated as retryable by default — matching the handler contract in
 * docs/02-ARCHITECTURE.md — but that fallback is itself a signal the
 * handler should be updated to throw a proper classified error instead.
 */
export function classifyError(err: unknown): ErrorClassification {
  if (err instanceof TimeoutError) {
    return { errorType: "timeout", message: err.message };
  }
  if (err instanceof NonRetryableError) {
    return { errorType: "non_retryable", message: err.message };
  }
  if (err instanceof RetryableError) {
    return { errorType: "retryable", message: err.message };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { errorType: "retryable", message };
}