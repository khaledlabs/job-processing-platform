import {
  createLogger,
  connectRabbitMQ,
  consumeJobMessages,
  closeRabbitMQ,
  childLoggerForJob,
  type RabbitConnection,
} from "@job-platform/shared";
import { randomUUID } from "node:crypto";

const workerId = randomUUID();
const logger = createLogger("worker").child({ workerId });

let rabbit: RabbitConnection | null = null;

async function start(): Promise<void> {
  try {
    rabbit = await connectRabbitMQ(
      process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672",
    );
    logger.info("RabbitMQ connection established, topology declared");

    await consumeJobMessages(rabbit.channel, async (message, context) => {
      // workerId isn't repeated here - it's already baked into `logger`
      // via the .child({ workerId }) call above; childLoggerForJob just
      // adds the two fields that are new per-message.
      const jobLogger = childLoggerForJob(logger, {
        correlationId: message.correlationId,
        jobId: message.jobId,
      });

      jobLogger.info({ type: message.type }, "message received");
      context.ack();
      jobLogger.info("message acked");
    });

    logger.info("consuming from jobs.process");
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
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

void start();