#!/bin/bash
# Deploy hook for Polymono (mp.maxharris.io). Runs ON the box (ec2p) in /var/www/polymono, after `git pull`.
# From your Mac, run `deployp` in this repo: it pushes, pulls on the box, runs this, then checks
# the URLs below. Running it by hand on the box works too. Box conventions: dev-personal/CLAUDE.md
#
# check: https://mp.maxharris.io/
# check: https://mp.maxharris.io/api/health
# check: https://mp.maxharris.io/socket.io/?EIO=4&transport=polling
#
# nginx (sites-available/mp.maxharris.io) serves frontend/dist/ and proxies the API and socket.io to :3002.
# backend/.env and the Postgres database exist only on the box.
# Order: build the frontend aside, install the backend, back up the database (backend/scripts/backup.sh, to
# ~/backups/polymono, newest 10 kept), apply pending migrations (backend/scripts/migrate.js), and only then swap
# in the new frontend and restart the backend. If the backup or a migration fails, the deploy stops with the old
# frontend and backend still running.
# /api/health fails until the board is seeded (node scripts/seedProperties.js, once per database).

set -e
[ "$(uname)" = Linux ] || { echo "deploy.sh runs on the box. From your Mac: deployp"; exit 1; }
cd "$(dirname "$0")"

# Frontend: build beside the live dist/ (swapped in below).
cd frontend
rm -rf dist.next
npm ci --no-audit --no-fund
npx vite build --outDir dist.next --emptyOutDir
cd ..

# Backend: dependencies, a backup, then migrations. Nothing is swapped or restarted unless all three succeed.
(cd backend && npm ci --omit=dev --no-audit --no-fund)
bash backend/scripts/backup.sh predeploy "$(git rev-parse --short HEAD)" || { echo "deploy.sh: backup failed, nothing restarted"; exit 1; }
(cd backend && node scripts/migrate.js) || { echo "deploy.sh: migrations failed, nothing restarted"; exit 1; }

cd frontend
[ ! -d dist ] || [ -O dist ] || sudo chown -R "$USER:$USER" dist   # the old monop.sh gave dist/ to www-data
rm -rf dist.prev && { [ ! -d dist ] || mv dist dist.prev; } && mv dist.next dist && rm -rf dist.prev
cd ..

pm2 restart monop-backend 2>/dev/null || (cd backend && pm2 start index.js --name monop-backend)
pm2 save
