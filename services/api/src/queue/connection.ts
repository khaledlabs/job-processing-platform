import { connectRabbitMQ, type RabbitConnection } from "@job-platform/shared";

let rabbit: RabbitConnection | null = null;

export async function initRabbitMQ(): Promise<RabbitConnection> {
  rabbit = await connectRabbitMQ(process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672");
  return rabbit;
}

export function getChannel(): RabbitConnection["channel"] {
  if (!rabbit) {
    throw new Error("RabbitMQ connection not initialized — call initRabbitMQ() at startup first");
  }
  return rabbit.channel;
}

export async function closeRabbitMQConnection(): Promise<void> {
  if (rabbit) {
    const { closeRabbitMQ } = await import("@job-platform/shared");
    await closeRabbitMQ(rabbit);
    rabbit = null;
  }
}