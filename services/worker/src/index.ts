import { createLogger, connectRabbitMQ, closeRabbitMQ, type RabbitConnection } from "@job-platform/shared";
import { randomUUID } from "node:crypto";
import { pool } from "./db/pool.js";

const workerId = randomUUID();
const logger = createLogger("worker").child({ workerId });

let rabbit: RabbitConnection | null = null;

async function start(): Promise<void> {
  try {
    await pool.query("SELECT 1");
    logger.info("database connection verified");

    rabbit = await connectRabbitMQ(
      process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672",
    );
    logger.info("RabbitMQ connection established, topology declared");

    logger.info("worker ready — real consumer logic starts next ticket");
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