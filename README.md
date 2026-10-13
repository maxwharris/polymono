# Polymono: Manhattan Edition

An online multiplayer Monopoly game with a Manhattan/NYC theme. This is a long-form, asynchronous game designed for 5-6 players to play over extended periods with real-time WebSocket communication and a 3D game board.

## Tech Stack

### Frontend
- React 19 with Vite
- React Three Fiber + Drei (3D graphics)
- Tailwind CSS
- Zustand (state management)
- Socket.io-client

### Backend
- Node.js with Express 5
- PostgreSQL
- Socket.io
- JWT authentication
- bcryptjs

## Project Structure

```
polymono/
├── backend/                # Node.js + Express server
│   ├── index.js           # Main server entry point
│   ├── db.js              # PostgreSQL connection
│   ├── schema.sql         # Database schema
│   ├── game/              # Game logic
│   │   ├── gameController.js
│   │   └── mechanics/     # Game mechanics modules
│   ├── routes/            # API endpoints
│   ├── db/                # Database queries
│   ├── data/              # Static data (properties)
│   └── scripts/           # Utility scripts
│
├── frontend/              # React + Vite
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── store/         # Zustand state
│   │   ├── services/      # API/WebSocket services
│   │   └── assets/        # Images/icons
│   └── public/
│
└── assets/                # 3D board assets
```

## Development Setup

Prerequisites: Node.js 20+, PostgreSQL 16.

```bash
cd backend
npm install
cp .env.example .env          # set the DB_* values and a JWT_SECRET
psql -U <user> -d <db> -f schema.sql
node scripts/seedProperties.js
npm run dev                   # http://localhost:3002

cd ../frontend
npm install
npm run dev                   # http://localhost:5173, proxies /api and /socket.io to :3002
                              # (BACKEND_URL=http://localhost:3102 npm run dev to point it elsewhere)
```

`schema.sql` creates the six seed accounts with each password equal to the username. Change them
(menu → Change password, or /admin → reset password) before the site is public.

The server is authoritative: every rule, turn phase and money movement happens in the backend, and clients
render the snapshots it pushes. The API and socket contract is in [backend/API.md](backend/API.md).

## Production Deployment

### Using the Deployment Script

Live at http://mp.maxharris.io, from `/var/www/polymono` on the personal EC2 box. From your Mac, run
`deployp` in this repo: it pushes, pulls on the box and runs `deploy.sh` there (build, restart
`monop-backend`), then checks the site. `deploy.sh` can also be run by hand on the box.

### Database changes

SQL in `backend/migrations/` is applied by hand with `psql`, in the order listed at the top of `deploy.sh`.
`add_game_engine.sql` is safe to re-run.

## Features

- Login (case-insensitive usernames), spectator mode, change password; `/admin` for admins (`ADMIN_USERS`)
  to add or remove players, reset passwords, reset the game and set the turn timer
- Lobby with ready check; the host starts the game with 2 to 6 players
- Monopoly rules enforced by the server: one roll per turn (doubles roll again, three doubles go to jail),
  buy or decline, rent with full-set and house/hotel tiers, railroads, utilities, taxes, shuffled
  Opportunity / Community Fund decks with landing effects, jail (doubles, $50 fine, card, forced fine on the
  third try), houses and hotels with even building and a limited bank supply, selling buildings,
  mortgages, debts, bankruptcy and a winner
- Trades with counter-offers
- Turn timer (default 24 hours): an expired turn is skipped
- Persistent activity log and chat; everything survives a server restart

## Scripts

### Backend
- `npm start` / `npm run dev`
- `node scripts/seedProperties.js` - load the 28 properties (needed once per database)
- `node scripts/updateProperties.js` - re-apply prices and rents from `data/properties.js`
- `node scripts/resetGame.js` - back to the lobby (asks the running server, so clients update)

### Frontend
- `npm run dev`, `npm run build`, `npm run lint`

## Environment Variables

Backend: see `backend/.env.example` (`DB_*`, `JWT_SECRET`, `PORT`, `ADMIN_USERS`).
Frontend: `VITE_BACKEND_URL` only when the API is on another origin (by default it uses the page's origin).

## License

Private project - All rights reserved.
