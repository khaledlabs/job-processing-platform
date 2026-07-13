import amqp, {type Channel, type ChannelModel, type ConsumeMessage} from 'amqplib';
import type {JobMessage} from "../types/job.js"

export const JOBS_EXCHANGE = "jobs.direct";
export const JOBS_QUEUE = "jobs.process";
export const JOBS_ROUTING_KEY = "job"


export interface RabbitConnection {
    connection: ChannelModel
    channel: Channel
}

export async function connectRabbitMQ(url: string): Promise<RabbitConnection> {
    const connection = await amqp.connect(url); // connect to the RabbitMQ server using the provided URL
    const channel = await connection.createChannel(); //    create a channel for communication with RabbitMQ

    await channel.assertExchange(JOBS_EXCHANGE, "direct", { durable: true }); // make sure that the exchange exists before binding the queue to it
    await channel.assertQueue(JOBS_QUEUE, { durable: true }); // make sure that the queue exists before binding it to the exchange 
    await channel.bindQueue(JOBS_QUEUE, JOBS_EXCHANGE, JOBS_ROUTING_KEY); // bind the queue to the exchange with the routing key

    return { connection, channel };
}


export async function closeRabbitMQ({ connection, channel }: RabbitConnection): Promise<void> {
  await channel.close();
  await connection.close();
}

export function publishJobMessage(channel: Channel, message: JobMessage): boolean {
  const body = Buffer.from(JSON.stringify(message)); // convert the message to a Buffer for publishing
  return channel.publish(JOBS_EXCHANGE, JOBS_ROUTING_KEY, body, { // publish the message to the exchange with the routing key
    persistent: true,
    correlationId: message.correlationId,
    priority: message.priority,
  });
}

// Interface for the context in which a job message is processed
export interface JobMessageContext {
  ack: () => void;
  nack: (requeue: boolean) => void;
}

// Consume job messages from the queue and process them using the provided callback
export async function consumeJobMessages(
  channel: Channel,
  onMessage: (message: JobMessage, context: JobMessageContext) => Promise<void>,
  concurrency = 1,
): Promise<void> {
  await channel.prefetch(concurrency);

  await channel.consume(JOBS_QUEUE, (msg: ConsumeMessage | null) => {
    if (!msg) {
      return;
    }

    let message: JobMessage;
    try {
      message = JSON.parse(msg.content.toString()) as JobMessage;
    } catch {
      channel.nack(msg, false, false);
      return;
    }

    const context: JobMessageContext = {
      ack: () => channel.ack(msg),
      nack: (requeue: boolean) => channel.nack(msg, false, requeue),
    };
    void onMessage(message, context);
  });
}