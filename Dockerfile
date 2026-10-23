# Node.js is build-only. Keep the security patch and reviewed image digest explicit.
FROM node:24.22.1-alpine3.24@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build

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
FROM nginx:1.30.6-alpine3.24-slim@sha256:d9322bba63c6cfc63dc9e86522fd4f95fd4d9020a02b5bced282bbf38b8c3960

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1
