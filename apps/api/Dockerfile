# syntax=docker/dockerfile:1

# Build from the repository root: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# The root package.json pins pnpm through `packageManager`; without it corepack downloads the latest pnpm.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile

# Only what the API is built from, so edits anywhere else in the repository keep the layers below cached.
COPY packages/typescript-config packages/typescript-config
COPY packages/common packages/common
COPY apps/api apps/api
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --offline --frozen-lockfile --filter "api..."
RUN pnpm --filter "api..." build
RUN pnpm --filter api deploy --prod /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3001}/api/health/live" || exit 1
CMD ["node", "dist/main.js"]
