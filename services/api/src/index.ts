import Fastify from "fastify";

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

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

async function start(): Promise<void> {
  try {
    await server.listen({ port, host });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  server.log.info(`received ${signal}, shutting down`);
  await server.close();
  process.exit(0);
}

// Kubernetes sends SIGTERM during rolling deploys (Milestone 11) — the
// server needs to stop accepting connections cleanly when that happens,
// not just get killed mid-request. Nothing here needs cleaning up yet,
// but the pattern is worth establishing now rather than retrofitting it
// once there's an actual queue connection to close gracefully too.
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

void start();