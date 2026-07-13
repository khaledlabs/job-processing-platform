import { NonRetryableError } from "@job-platform/shared";
import { registerHandler, type JobHandler } from "./registry.js";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const sendEmailHandler: JobHandler = async (_payload, _context) => {
  // Simulates a normal job that takes a couple seconds and succeeds —
  // the "everything working as expected" baseline every other fake
  // handler gets compared against.
  await sleep(2000);
};

const alwaysBrokenHandler: JobHandler = async (_payload, _context) => {
  // Simulates a poison message — a payload that could never succeed no
  // matter how many times it's retried. Should route straight to
  // dead_lettered on the very first attempt, per markJobFailed's
  // classification logic from Ticket 2.
  throw new NonRetryableError("simulated poison message — this payload can never succeed");
};

const hangsForeverHandler: JobHandler = async (_payload, _context) => {
  // Simulates a handler that never returns — a hung downstream call, an
  // infinite loop, a deadlock. Nothing in this function itself ever
  // resolves; only Ticket 4's timeout wrapper is what's supposed to cut
  // this off. If this job type ever completes "successfully," something
  // is wrong with the timeout enforcement, not this handler.
  await new Promise<void>(() => {
    // deliberately never resolves or rejects
  });
};

export function registerFakeHandlers(): void {
  registerHandler("send-email", sendEmailHandler);
  registerHandler("always-broken", alwaysBrokenHandler);
  registerHandler("hangs-forever", hangsForeverHandler);
}