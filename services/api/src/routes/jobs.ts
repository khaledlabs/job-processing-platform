import type { FastifyInstance } from "fastify";
import { createJob, getJobById, listJobs, markJobQueued } from "../db/jobs-repository.js";
import { createJobBodySchema, jobIdParamsSchema, listJobsQuerySchema } from "../schemas/job-schemas.js";
import { publishJobMessage, type JobMessage } from "@job-platform/shared";
import { getChannel } from "../queue/connection.js";

interface CreateJobBody {
  type: string;
  payload: Record<string, unknown>;
}

export async function jobRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateJobBody }>(
    "/jobs",
    { schema: { body: createJobBodySchema } },
    async (request, reply) => {
      const job = await createJob({
        type: request.body.type,
        payload: request.body.payload,
        correlationId: request.id,
      });
      request.log.info({ jobId: job.id, type: job.type }, "job created");

      const message: JobMessage = {
        jobId: job.id,
        type: job.type,
        payload: job.payload,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        priority: job.priority,
        timeoutMs: job.timeoutMs,
        correlationId: job.correlationId,
      };

      try {
        publishJobMessage(getChannel(), message);
        await markJobQueued(job.id, job.correlationId);
        request.log.info({ jobId: job.id }, "job published to queue");
      } catch (err) {
        request.log.error({ err, jobId: job.id }, "failed to publish job to queue");
      }

      reply.code(201);
      return { ...job, status: "queued" };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/jobs/:id",
    { schema: { params: jobIdParamsSchema } },
    async (request, reply) => {
      const result = await getJobById(request.params.id);
      if (!result) {
        reply.code(404);
        return { error: "job not found" };
      }
      return result;
    },
  );

  app.get<{ Querystring: { status?: string; type?: string; limit?: number } }>(
    "/jobs",
    { schema: { querystring: listJobsQuerySchema } },
    async (request) => {
      const jobs = await listJobs({
        status: request.query.status,
        type: request.query.type,
        limit: request.query.limit ?? 50,
      });
      return { jobs };
    },
  );
}