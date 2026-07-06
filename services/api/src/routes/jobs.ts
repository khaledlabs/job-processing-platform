import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { createJob, getJobById, listJobs } from "../db/jobs-repository.js";
import { createJobBodySchema, jobIdParamsSchema, listJobsQuerySchema } from "../schemas/job-schemas.js";


interface CreateJobBody {
  type: string;
  payload: Record<string, unknown>;
}

export async function jobRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateJobBody }>(
    "/jobs",
    { schema: { body: createJobBodySchema } },
    async (request, reply) => {
      const correlationId = randomUUID();
      const job = await createJob({
        type: request.body.type,
        payload: request.body.payload,
        correlationId,
      });
      reply.code(201);
      return job;
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