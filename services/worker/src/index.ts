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

        // Acked unconditionally, success or failure — see Ticket 2's
        // notes: Postgres's `status` column is the source of truth for
        // whether a job actually succeeded, and there's no real
        // retry-republish (Milestone 4) or DLQ routing (Milestone 5)
        // mechanism yet for a nack to meaningfully act on.
        context.ack();
      },
      concurrency,
    );

    logger.info({ concurrency }, "consuming from jobs.process");
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  if (rabbit) {
    await closeRabbitMQ(rabbit);
  }
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

void start(); 