import pino, { type Logger } from "pino";

export function createLogger(serviceName: string): Logger {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: { service: serviceName },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export interface JobLogContext {
  correlationId: string;
  jobId?: string;
  workerId?: string;
}

export function childLoggerForJob(logger: Logger, context: JobLogContext): Logger {
  return logger.child(context);
}

export type { Logger };