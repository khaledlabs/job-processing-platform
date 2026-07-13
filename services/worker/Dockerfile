# syntax=docker/dockerfile:1
#
# Build context for this Dockerfile is the REPO ROOT, same reasoning as
# services/api/Dockerfile — needs access to the whole pnpm workspace to
# resolve @job-platform/shared.

FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/api/package.json services/api/package.json
COPY services/worker/package.json services/worker/package.json

RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY services/worker services/worker

RUN pnpm --filter @job-platform/shared run build
RUN pnpm --filter @job-platform/worker run build

RUN pnpm prune --prod

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
COPY --from=build /repo/services/worker/dist ./services/worker/dist
COPY --from=build /repo/services/worker/package.json ./services/worker/package.json
COPY --from=build /repo/services/worker/node_modules ./services/worker/node_modules

USER app
CMD ["node", "services/worker/dist/index.js"]