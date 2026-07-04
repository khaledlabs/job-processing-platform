console.log("[worker] scaffold only — real consumer logic starts in Milestone 2");

// Keeps the process alive so this behaves like the long-running consumer
// it will become once it's actually connected to RabbitMQ, rather than
// exiting immediately the way a one-off script would.
const heartbeat = setInterval(() => {
  console.log("[worker] idle — waiting for Milestone 2");
}, 30_000);

function shutdown(signal: string): void {
  console.log(`[worker] received ${signal}, shutting down`);
  clearInterval(heartbeat);
  process.exit(0);
}   

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));