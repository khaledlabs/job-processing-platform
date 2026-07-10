import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { pool } from "./db/pool.js";
import { jobRoutes } from "./routes/jobs.js";
import { createLogger } from "@job-platform/shared";
import { initRabbitMQ, closeRabbitMQConnection } from "./queue/connection.js";

const logger = createLogger("api");

const server = Fastify({
  loggerInstance: logger,
  genReqId: (request) => {
    const incoming = request.headers["correlation-id"];
    return typeof incoming === "string" ? incoming : randomUUID();
  },
});

server.addHook("onRequest", async (request, reply) => {
  reply.header("Correlation-ID", request.id);
});

server.get("/health", async () => {
  return {
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString(),
  };
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

async function start(): Promise<void> {
  try {
    await pool.query("SELECT 1");
    logger.info("database connection verified");
    await initRabbitMQ();
    logger.info("RabbitMQ connection established, topology declared");
    await server.register(jobRoutes);
    await server.listen({ port, host });
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  await server.close();
  await pool.end();
  await closeRabbitMQConnection();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

void start();