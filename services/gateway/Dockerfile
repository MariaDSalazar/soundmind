# Gateway (BFF) — contexto de build: la RAÍZ del monorepo
#   docker build -f services/gateway/Dockerfile .
FROM node:22-bookworm-slim

WORKDIR /app

# Solo manifiestos primero → la capa de npm ci se cachea entre builds
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY services/gateway/package.json services/gateway/
COPY services/music/package.json services/music/
COPY services/users/package.json services/users/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY packages/shared packages/shared
COPY services/gateway services/gateway

# Imagen non-root (ver §9 ARQUITECTURA.md — supply chain)
USER node

ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "services/gateway"]
