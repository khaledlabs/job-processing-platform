import {
  createLogger,
  connectRabbitMQ,
  closeRabbitMQ,
  consumeJobMessages,
  childLoggerForJob,
  classifyError,
  type RabbitConnection,
} from "@job-platform/shared";
import { randomUUID } from "node:crypto";
import { pool } from "./db/pool.js";
import { markJobProcessing, markJobCompleted, markJobFailed } from "./db/jobs-repository.js";
import { registerFakeHandlers } from "./handlers/fake-handlers.js";
import { getHandler } from "./handlers/registry.js";
import { executeWithTimeout } from "./handlers/execute-with-timeout.js";

const workerId = randomUUID();
const logger = createLogger("worker").child({ workerId });
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 1);

let rabbit: RabbitConnection | null = null;
let activeMessageCount = 0;
let shuttingDown = false;

async function start(): Promise<void> {
  try {
    registerFakeHandlers();
    logger.info("job handlers registered");

    await pool.query("SELECT 1");
    logger.info("database connection verified");

    rabbit = await connectRabbitMQ(
      process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672",
    );
    logger.info("RabbitMQ connection established, topology declared");

    await consumeJobMessages(
      rabbit.channel,
      async (message, context) => {
        activeMessageCount += 1;
        try {
          const jobLogger = childLoggerForJob(logger, {
            correlationId: message.correlationId,
            jobId: message.jobId,
          });

          jobLogger.info({ type: message.type }, "message received");

          const handler = getHandler(message.type);
          if (!handler) {
            jobLogger.error({ type: message.type }, "no handler registered for job type — treating as poison message");
            await markJobFailed(message.jobId, message.correlationId, {
              errorType: "non_retryable",
              message: `No handler registered for job type "${message.type}"`,
            });
            context.ack();
            return;
          }

          await markJobProcessing(message.jobId, message.correlationId);

          try {
            await executeWithTimeout(
              handler,
              message.payload,
              { jobId: message.jobId, correlationId: message.correlationId, attempts: message.attempts },
              message.timeoutMs,
            );
            await markJobCompleted(message.jobId, message.correlationId);
            jobLogger.info("job completed");
          } catch (err) {
            const classification = classifyError(err);
            jobLogger.error(
              { errorType: classification.errorType, errorMessage: classification.message },
              "job failed",
            );
            await markJobFailed(message.jobId, message.correlationId, classification);
          }

          context.ack();
        } finally {
          activeMessageCount -= 1;
        }
      },
      concurrency,
    );

    logger.info({ concurrency }, "consuming from jobs.process");
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

async function waitForActiveMessages(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (activeMessageCount > 0 && Date.now() < deadline) {
    logger.info({ activeMessageCount }, "waiting for in-flight messages to finish");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (activeMessageCount > 0) {
    logger.error(
      { activeMessageCount },
      "shutdown timeout exceeded with messages still in flight — exiting anyway",
    );
  }
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  logger.info({ signal, activeMessageCount }, "shutting down — waiting for in-flight messages");
  await waitForActiveMessages(30_000);

  if (rabbit) {
    await closeRabbitMQ(rabbit);
  }
  await pool.end();
  logger.info("shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

void start();