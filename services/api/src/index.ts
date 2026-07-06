import Fastify from "fastify";
import { pool } from "./db/pool.js";
import { jobRoutes } from "./routes/jobs.js";

const server = Fastify({
  logger: true,
});

server.get("/health", async () => {
  return {
    status: "ok",
    service: "api",
    timestamp: new Date().toISOString(),
  };
});

const port = Number(process.env.PORT ?? 3010);
const host = process.env.HOST ?? "0.0.0.0";

async function start(): Promise<void> {
  try {
    await pool.query("SELECT 1");
    server.log.info("database connection verified");
    await server.register(jobRoutes);
    await server.listen({ port, host });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  server.log.info(`received ${signal}, shutting down`);
  await server.close();
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

void start();
