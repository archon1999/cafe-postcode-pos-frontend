# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /app

ARG VITE_API_BASE_URL=http://127.0.0.1:18181/v1
ARG VITE_REMOTE_API_BASE_URL=https://cafe-postcode.uz/api/v1
ARG VITE_API_TIMEOUT=15000
ARG VITE_EDGE_BASE_URL=http://127.0.0.1:18181
ARG VITE_CONTROL_APP_URL=https://control.cafe-postcode.uz
ARG VITE_APP_VERSION=web
ARG VITE_MONITOR_ANNOUNCEMENT_BASE_URL=/monitor-announcements/v1/uz/female
ARG FFMPEG_BINARIES_URL=https://cdn.npmmirror.com/binaries/ffmpeg-static

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_REMOTE_API_BASE_URL=${VITE_REMOTE_API_BASE_URL} \
    VITE_API_TIMEOUT=${VITE_API_TIMEOUT} \
    VITE_EDGE_BASE_URL=${VITE_EDGE_BASE_URL} \
    VITE_CONTROL_APP_URL=${VITE_CONTROL_APP_URL} \
    VITE_APP_VERSION=${VITE_APP_VERSION} \
    VITE_MONITOR_ANNOUNCEMENT_BASE_URL=${VITE_MONITOR_ANNOUNCEMENT_BASE_URL}

COPY package*.json ./
RUN --mount=type=secret,id=npm_proxy \
    NPM_PROXY="$(cat /run/secrets/npm_proxy 2>/dev/null || true)" && \
    npm_config_proxy=${NPM_PROXY} \
    npm_config_https_proxy=${NPM_PROXY} \
    HTTP_PROXY= HTTPS_PROXY= http_proxy= https_proxy= \
    FFMPEG_BINARIES_URL=${FFMPEG_BINARIES_URL} \
    npm ci

COPY . .
RUN npm run prod:build

FROM nginx:alpine@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q -O- http://127.0.0.1/healthz || exit 1

