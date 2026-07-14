# syntax=docker/dockerfile:1.8
ARG TARGETPLATFORM=linux/amd64
FROM --platform=${TARGETPLATFORM} docker.io/library/node:20.19.5-bookworm-slim@sha256:d08621e478133b0492bd661ceee5d13a22b8c55297f3dbbb57f1c15d0c214942 AS build

RUN corepack enable && corepack prepare pnpm@10.8.1 --activate
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/marketplace-api-contract/package.json packages/marketplace-api-contract/package.json
COPY packages/marketplace-registry/package.json packages/marketplace-registry/package.json
COPY services/marketplace-api/package.json services/marketplace-api/package.json
RUN pnpm install --frozen-lockfile

COPY packages/marketplace-api-contract/ packages/marketplace-api-contract/
COPY packages/marketplace-registry/ packages/marketplace-registry/
COPY services/marketplace-api/ services/marketplace-api/
RUN pnpm --filter @biblio/marketplace-api typecheck \
    && pnpm --filter @biblio/marketplace-api test \
    && pnpm --filter @biblio/marketplace-api build \
    && pnpm --filter @biblio/marketplace-api deploy --prod /output

FROM --platform=${TARGETPLATFORM} docker.io/library/node:20.19.5-bookworm-slim@sha256:d08621e478133b0492bd661ceee5d13a22b8c55297f3dbbb57f1c15d0c214942

ARG API_VERSION=development
ENV NODE_ENV=production \
    PORT=3001 \
    API_VERSION=${API_VERSION} \
    MARKETPLACE_REGISTRY_PATH=/app/config/chains.json

WORKDIR /app
COPY --from=build --chown=node:node /output/ /app/
COPY --chown=node:node config/marketplace/chains.json /app/config/chains.json

LABEL org.opencontainers.image.title="Biblio marketplace API" \
      org.opencontainers.image.version="${API_VERSION}"

USER node
EXPOSE 3001 3002
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/bootstrap.js"]
