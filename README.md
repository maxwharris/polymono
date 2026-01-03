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
monop/
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

### Prerequisites
- Node.js 18+
- PostgreSQL
- npm or yarn

### Backend Setup

```bash
cd backend
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your database credentials

# Initialize database
psql -U your_user -d your_db -f schema.sql

# Seed properties
node scripts/seedProperties.js

# Hash passwords (if needed)
node scripts/hashPasswords.js

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install

# Start development server
npm run dev
```

The frontend runs on `http://localhost:5173` and the backend on `http://localhost:3001`.

## Production Deployment

### Using the Deployment Script

A deployment script is provided for EC2 servers using PM2 and Nginx:

```bash
# Make the script executable
chmod +x monop.sh

# Run the script
./monop.sh
```

### Manual Deployment

#### Backend
```bash
cd /var/www/monop/backend
npm install --production
pm2 start index.js --name monop-backend
```

#### Frontend
```bash
cd /var/www/monop/frontend
npm install
npm run build
# Serve the dist/ folder with Nginx
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /var/www/monop/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Features

- **Authentication:** JWT-based login with player accounts
- **3D Game Board:** 40-space Monopoly board with Manhattan properties
- **Real-time Multiplayer:** WebSocket synchronization
- **Full Monopoly Rules:**
  - Dice rolling and movement
  - Property purchasing and rent
  - Houses and hotels
  - Mortgaging
  - Trading between players
  - Jail mechanics
  - Chance and Community Chest cards
- **Chat:** Real-time player communication
- **Admin Controls:** Game reset and action logs

## Scripts

### Backend Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with hot reload
- `node scripts/seedProperties.js` - Initialize properties in database
- `node scripts/hashPasswords.js` - Hash user passwords
- `node scripts/resetGame.js` - Reset game state

### Frontend Scripts
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

## Environment Variables

### Backend (.env)
```
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/monopoly
JWT_SECRET=your-secret-key
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3001
```

## License

Private project - All rights reserved.
