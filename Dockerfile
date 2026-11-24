# Node.js is build-only. Keep the security patch and reviewed image digest explicit.
FROM node:24.22.3-alpine3.24@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build

WORKDIR /app
ARG NODE_MAX_OLD_SPACE_SIZE=768
ENV NODE_OPTIONS="--max-old-space-size=${NODE_MAX_OLD_SPACE_SIZE}"
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Strict type checking runs in the normal build/CI quality gate. The image stage
# bundles only, avoiding a redundant TypeScript heap peak on memory-limited VPS
# builders while producing the same Vite assets.
RUN npm run build:bundle

# Static serving needs no curl or optional XML/image/JavaScript modules.
FROM nginx:1.31.9-alpine3.24-slim@sha256:5bfced78d24d644270bedb0a9968697042e38d5c03fb6354603df025279c1cbe

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1
