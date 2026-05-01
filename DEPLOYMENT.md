# POS Frontend Deployment

## CI/CD

This repository uses:

- `develop` for ongoing development
- `production` for deployment

CI runs on `develop`, `production`, and pull requests. Deployment runs only on every push to `production` via GitHub Actions over SSH.

Required GitHub repository secrets:

- `HOST`
- `PORT`
- `USERNAME`
- `PASSWORD`

The workflow SSHes into the server and runs:

```bash
cd /home/postcode/pos-frontend
test -f .env.production
git fetch origin production
git checkout production
git pull --ff-only origin production
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
```

## Required files on the server

Create `/home/postcode/pos-frontend/.env.production` before the first deploy:

```dotenv
VITE_API_BASE_URL='https://cafe-postcode.uz/api'
VITE_API_TIMEOUT='15000'
```

## Docker

The app is built inside Docker and served by Nginx from the final image:

```bash
docker compose --env-file .env.production up -d --build
```

The container listens on `127.0.0.1:4300` by default. Override it with:

```dotenv
POS_FRONTEND_PORT=4300
```

TLS should terminate at the host or edge proxy and forward traffic to that local port.
