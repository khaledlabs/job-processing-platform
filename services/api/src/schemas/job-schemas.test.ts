import { describe, it, expect } from "vitest";
import Ajv from "ajv";
import { createJobBodySchema, jobIdParamsSchema } from "./job-schemas.js";

const ajv = new Ajv();

describe("createJobBodySchema", () => {
  it("accepts a valid job body", () => {
    const validate = ajv.compile(createJobBodySchema);
    const valid = validate({ type: "send-email", payload: { to: "a@example.com" } });
    expect(valid).toBe(true);
  });

  it("rejects a body missing 'type'", () => {
    const validate = ajv.compile(createJobBodySchema);
    const valid = validate({ payload: { to: "a@example.com" } });
    expect(valid).toBe(false);
  });

  it("rejects a body with an unknown extra field", () => {
    const validate = ajv.compile(createJobBodySchema);
    const valid = validate({ type: "send-email", payload: {}, sneaky: "field" });
    expect(valid).toBe(false);
  });
});

describe("jobIdParamsSchema", () => {
  it("accepts a well-formed UUID", () => {
    const validate = ajv.compile(jobIdParamsSchema);
    const valid = validate({ id: "9e7b83b7-6345-4ea2-8488-f7a6e83e179b" });
    expect(valid).toBe(true);
  });

  it("rejects a malformed id", () => {
    const validate = ajv.compile(jobIdParamsSchema);
    const valid = validate({ id: "not-a-real-uuid" });
    expect(valid).toBe(false);
  });
});