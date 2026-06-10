# Users service — contexto de build: la RAÍZ del monorepo
#   docker build -f services/users/Dockerfile .
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY services/gateway/package.json services/gateway/
COPY services/music/package.json services/music/
COPY services/users/package.json services/users/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY packages/shared packages/shared
COPY services/users services/users

USER node

ENV NODE_ENV=production
EXPOSE 4003
CMD ["npm", "run", "start", "-w", "services/users"]
