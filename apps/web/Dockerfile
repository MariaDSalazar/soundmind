# Web (SPA) — contexto de build: la RAÍZ del monorepo
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=... .
# Multi-stage: build con Node → servir estáticos con nginx (non-root)
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY services/gateway/package.json services/gateway/
COPY services/music/package.json services/music/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY packages/shared packages/shared
COPY apps/web apps/web

# La URL del gateway se inyecta en build (Vite la incrusta en el bundle)
ARG VITE_API_URL=http://localhost:4000/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w apps/web

FROM nginxinc/nginx-unprivileged:alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
