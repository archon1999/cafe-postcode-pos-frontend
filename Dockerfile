FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install -g npm@10.9.2 && npm ci --force

COPY . .
RUN npm run prod:build

FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q -O- http://127.0.0.1/healthz || exit 1
