# syntax=docker/dockerfile:1
# Build context: repository root (see docker-compose.yml).

# ---- deps: full install, cached until a package.json or the lockfile changes ----
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @tesla-pool/api -w @tesla-pool/shared

# ---- build: compile shared + api to JavaScript ----
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @tesla-pool/shared && npm run build -w @tesla-pool/api

# ---- runtime: production dependencies + compiled output only, no CLI or dev tools ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev -w @tesla-pool/api -w @tesla-pool/shared && npm cache clean --force
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
USER node
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
