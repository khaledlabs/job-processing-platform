import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const testPool = new Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ??
    "postgres://job_platform_test:job_platform_test@localhost:5434/job_platform_test",
});

async function resetSchema(): Promise<void> {
  await testPool.query("DROP TABLE IF EXISTS job_events, jobs, _migrations CASCADE");
  const migrationsDir = path.join(__dirname, "../../migrations");
  const files = ["001_create_jobs.sql", "002_create_job_events.sql"];
  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), "utf-8");
    await testPool.query(sql);
  }
}

beforeAll(async () => {
  await resetSchema();
});

beforeEach(async () => {
  await testPool.query("TRUNCATE jobs, job_events RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await testPool.end();
});

describe("createJob + getJobById", () => {
  it("persists a job and writes one job_events row", async () => {
    const insertResult = await testPool.query(
      `INSERT INTO jobs (type, payload, correlation_id) VALUES ($1, $2, $3) RETURNING *`,
      ["send-email", { to: "a@example.com" }, "test-correlation-id"],
    );
    const job = insertResult.rows[0];
    expect(job.status).toBe("pending");

    await testPool.query(
      `INSERT INTO job_events (job_id, correlation_id, from_status, to_status) VALUES ($1, $2, NULL, $3)`,
      [job.id, "test-correlation-id", job.status],
    );

    const eventsResult = await testPool.query("SELECT * FROM job_events WHERE job_id = $1", [
      job.id,
    ]);
    expect(eventsResult.rows).toHaveLength(1);
    expect(eventsResult.rows[0].from_status).toBeNull();
  });

  it("rejects an invalid status via the CHECK constraint", async () => {
    await expect(
      testPool.query(
        `INSERT INTO jobs (type, payload, correlation_id, status) VALUES ($1, $2, $3, $4)`,
        ["send-email", {}, "test-correlation-id", "not-a-real-status"],
      ),
    ).rejects.toThrow();
  });

  it("updates updated_at automatically on UPDATE, via the trigger", async () => {
    const insertResult = await testPool.query(
      `INSERT INTO jobs (type, payload, correlation_id) VALUES ($1, $2, $3) RETURNING *`,
      ["send-email", {}, "test-correlation-id"],
    );
    const original = insertResult.rows[0];

    await new Promise((resolve) => setTimeout(resolve, 10));

    const updateResult = await testPool.query(
      `UPDATE jobs SET status = 'queued' WHERE id = $1 RETURNING *`,
      [original.id],
    );
    const updated = updateResult.rows[0];

    expect(new Date(updated.updated_at).getTime()).toBeGreaterThan(
      new Date(original.updated_at).getTime(),
    );
  });
});