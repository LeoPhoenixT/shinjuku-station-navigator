FROM node:24-alpine AS build

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

FROM nginx:1.28-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1
