# syntax=docker/dockerfile:1
#
# Build context for this Dockerfile is the REPO ROOT, not services/api —
# it needs access to the whole pnpm workspace to resolve the
# @job-platform/shared dependency. See docker-compose.yml.

# ---- Build stage: install all workspace deps and compile TypeScript ----
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /repo

# Copy just the manifests first so `pnpm install` is cached by Docker
# across rebuilds where only application source changed, not dependencies.
# This has to include every workspace member's package.json, or
# --frozen-lockfile will refuse to install because the lockfile doesn't
# match what it can see on disk.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/api/package.json services/api/package.json
COPY services/worker/package.json services/worker/package.json

RUN pnpm install --frozen-lockfile

# Now bring in the actual source and build only what this image needs.
COPY packages/shared packages/shared
COPY services/api services/api

RUN pnpm --filter @job-platform/shared run build
RUN pnpm --filter @job-platform/api run build

# Strip devDependencies before copying anything into the runtime image —
# this is what actually keeps it small.
RUN pnpm prune --prod

# ---- Runtime stage: just the compiled output + production deps ----
FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /repo/services/api/dist ./services/api/dist
COPY --from=build /repo/services/api/package.json ./services/api/package.json
COPY --from=build /repo/services/api/node_modules ./services/api/node_modules

USER app
EXPOSE 3000
CMD ["node", "services/api/dist/index.js"]