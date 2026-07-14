FROM node:22-alpine AS build

WORKDIR /app
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com

COPY package*.json ./
RUN npm ci --force

COPY . .
RUN npm run prod:build

FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q -O- http://127.0.0.1/healthz || exit 1

