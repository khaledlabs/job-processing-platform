# Job Processing Platform

A distributed job processing platform — submit a job, watch it queue, get picked up by a worker pool, retried with exponential backoff on failure, and dead-lettered if it never succeeds. Built to exercise the core primitives behind almost every real distributed system: queues, retries, DLQs, idempotency, worker pools, observability, and autoscaling.

This is a learning project with a dual goal: understand these concepts by building them by hand, and end up with something that reads as genuine system-design work, not a tutorial follow-along.

## Tech stack

- **Runtime**: TypeScript / Node.js, pnpm workspaces (monorepo: `services/api`, `services/worker`, `packages/shared`)
- **API**: Fastify
- **Messaging**: RabbitMQ
- **Persistence**: PostgreSQL
- **Cache / idempotency / heartbeats**: Redis
- **Observability**: Prometheus + Grafana
- **Deployment path**: Docker Compose → Kubernetes (Kind) → AWS demo

Full reasoning for every choice above lives in [`docs/03-TECH-STACK-DECISIONS.md`](./docs/03-TECH-STACK-DECISIONS.md).

## Quick start

Requires Docker Desktop running and pnpm installed.

```bash
git clone git@github.com:khaledlabs/job-processing-platform.git
cd job-processing-platform
docker compose up --build
```

Once every service reports healthy:

- API health check: http://localhost:3010/health
- RabbitMQ management UI: http://localhost:15672 (guest / guest)

## Project structure