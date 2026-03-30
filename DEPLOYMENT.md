# POS Frontend Deployment

## CI/CD

This repository uses:

- `develop` for ongoing development
- `production` for deployment

Deployment runs on every push to `production` via GitHub Actions over SSH.

Required GitHub repository secrets:

- `HOST`
- `PORT`
- `USERNAME`
- `PASSWORD`

The workflow SSHes into the server and runs:

```bash
cd /home/postcode/pos-frontend
git checkout production
git pull --ff-only origin production
docker compose up -d --build --remove-orphans
```

## Required files on the server

Create `/home/postcode/pos-frontend/.env.production` before the first deploy:

```dotenv
VITE_API_BASE_URL='https://cafe-postcode.uz/api'
VITE_API_TIMEOUT='15000'
```

## Runtime port

The container is exposed only on localhost:

- `127.0.0.1:8082`

Put your public Nginx reverse proxy in front of that port.

## Example host Nginx config

```nginx
server {
    listen 80;
    server_name pos.cafe-postcode.uz;

    location / {
        proxy_pass http://127.0.0.1:8082;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
