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
npm install
npm run prod:build
gzipper compress ./dist
```

## Required files on the server

Create `/home/postcode/pos-frontend/.env.production` before the first deploy:

```dotenv
VITE_API_BASE_URL='https://cafe-postcode.uz/api'
VITE_API_TIMEOUT='15000'
```

## Server requirements

Install Node.js and make sure `npm` and `npx` are available for the SSH user.

After the build finishes, compressed assets are written into `dist/`.

Serve `/home/postcode/pos-frontend/dist` with your own Nginx configuration.
```
