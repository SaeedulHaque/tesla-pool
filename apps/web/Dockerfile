# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml).

FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @tesla-pool/web -w @tesla-pool/shared

FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @tesla-pool/shared && npm run build -w @tesla-pool/web

# Next.js "standalone" output: a self-contained server plus only the files it traces.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /repo
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public apps/web/public
USER node
EXPOSE 3000
# API_INTERNAL_URL is read at request time, so one image works in Compose and production.
CMD ["node", "apps/web/server.js"]
