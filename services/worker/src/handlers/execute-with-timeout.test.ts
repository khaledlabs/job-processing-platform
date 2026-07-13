import { describe, it, expect } from "vitest";
import { executeWithTimeout } from "./execute-with-timeout.js";
import { TimeoutError, NonRetryableError } from "@job-platform/shared";
import type { HandlerContext, JobHandler } from "./registry.js";

const context: HandlerContext = {
  jobId: "test-job",
  correlationId: "test-correlation",
  attempts: 0,
};

describe("executeWithTimeout", () => {
  it("resolves normally when the handler finishes before the timeout", async () => {
    const fastHandler: JobHandler = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    };
    await expect(executeWithTimeout(fastHandler, {}, context, 1000)).resolves.toBeUndefined();
  });

  it("throws TimeoutError when the handler never settles", async () => {
    const hungHandler: JobHandler = () => new Promise<void>(() => {});
    await expect(executeWithTimeout(hungHandler, {}, context, 50)).rejects.toThrow(TimeoutError);
  });

  it("propagates the handler's own error, not a timeout, when it fails fast", async () => {
    const brokenHandler: JobHandler = async () => {
      throw new NonRetryableError("simulated failure");
    };
    await expect(executeWithTimeout(brokenHandler, {}, context, 1000)).rejects.toThrow(NonRetryableError);
  });
});