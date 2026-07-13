import { describe, it, expect } from "vitest";
import AjvImport from "ajv";
import { createJobBodySchema, jobIdParamsSchema } from "./job-schemas.js";

/**
 * ajv's own type declarations are broken under TypeScript's NodeNext
 * module resolution — a long-standing, still-unresolved upstream issue
 * (ajv-validator/ajv#2047, #2204, #2381). The commonly-cited workaround
 * (`import { default as Ajv } from "ajv"`) doesn't resolve it on this
 * ajv version either — the "correct" import syntax has genuinely
 * shifted across ajv's own releases, which isn't a target worth
 * chasing further. Isolating the cast to this one line, with a minimal
 * local type describing exactly the one method this file actually
 * uses, gives real type safety for our own usage without pretending
 * ajv's full type declarations can be trusted here.
 */
interface AjvLike {
  compile: (schema: unknown) => (data: unknown) => boolean;
}
const AjvConstructor = AjvImport as unknown as new () => AjvLike;
const ajv = new AjvConstructor();

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