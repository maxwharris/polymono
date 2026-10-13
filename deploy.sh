#!/bin/bash
# Deploy hook for Polymono (mp.maxharris.io). Runs ON the box (ec2p) in /var/www/polymono, after `git pull`.
# From your Mac, run `deployp` in this repo: it pushes, pulls on the box, runs this, then checks
# the URLs below. Running it by hand on the box works too. Box conventions: dev-personal/CLAUDE.md
#
# check: http://mp.maxharris.io/
# check: http://mp.maxharris.io/socket.io/?EIO=4&transport=polling
#
# nginx (sites-available/mp.maxharris.io) serves frontend/dist/ and proxies the API and socket.io to :3002.
# backend/.env and the Postgres database exist only on the box. SQL in backend/migrations/ is applied by hand.

set -e
[ "$(uname)" = Linux ] || { echo "deploy.sh runs on the box. From your Mac: deployp"; exit 1; }
cd "$(dirname "$0")"

# Frontend: build beside the live dist/ and swap it in only if the build succeeds.
cd frontend
rm -rf dist.next
npm ci --no-audit --no-fund
npx vite build --outDir dist.next --emptyOutDir
[ ! -d dist ] || [ -O dist ] || sudo chown -R "$USER:$USER" dist   # the old monop.sh gave dist/ to www-data
rm -rf dist.prev && { [ ! -d dist ] || mv dist dist.prev; } && mv dist.next dist && rm -rf dist.prev
cd ..

# Backend
(cd backend && npm ci --omit=dev --no-audit --no-fund)
pm2 restart monop-backend 2>/dev/null || (cd backend && pm2 start index.js --name monop-backend)
pm2 save
