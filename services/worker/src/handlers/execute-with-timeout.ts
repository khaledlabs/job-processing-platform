import { TimeoutError } from "@job-platform/shared";
import type { JobHandler, HandlerContext } from "./registry.js";

export async function executeWithTimeout(
  handler: JobHandler,
  payload: unknown,
  context: HandlerContext,
  timeoutMs: number,
): Promise<void> {
  let timer: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(`Handler exceeded timeout of ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    await Promise.race([handler(payload, context), timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}