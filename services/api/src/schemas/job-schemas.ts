export const createJobBodySchema = {
  type: "object",
  required: ["type", "payload"],
  additionalProperties: false,
  properties: {
    type: { type: "string", minLength: 1 },
    payload: { type: "object" },
  },
} as const;

export const jobIdParamsSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: {
      type: "string",
      pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
    },
  },
} as const;

export const listJobsQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ["pending", "queued", "processing", "retrying", "completed", "dead_lettered", "cancelled"],
    },
    type: { type: "string" },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
  },
} as const;

