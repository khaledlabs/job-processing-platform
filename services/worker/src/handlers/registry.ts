export interface HandlerContext {
  jobId: string;
  correlationId: string;
  attempts: number;
}

export type JobHandler = (payload: unknown, context: HandlerContext) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function registerHandler(type: string, handler: JobHandler): void {
  if (handlers.has(type)) {
    throw new Error(`Handler for job type "${type}" is already registered`);
  }
  handlers.set(type, handler);
}

export function getHandler(type: string): JobHandler | undefined {
  return handlers.get(type);
}