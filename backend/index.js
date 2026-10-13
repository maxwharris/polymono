const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('JWT_SECRET must be set (16+ characters) in backend/.env');
  process.exit(1);
}

const pool = require('./db');
const { userFromToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
app.set('trust proxy', 'loopback'); // nginx on the same box; req.ip is the client when it sends X-Forwarded-For

const corsOptions = {
  origin: [
    "https://mp.maxharris.io",
    "http://mp.maxharris.io",
    "http://localhost:5173"
  ],
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  credentials: true
};

const io = socketIo(server, {
  cors: corsOptions
});

app.use(cors(corsOptions));
app.use(express.json({ limit: '50kb' }));

// userId -> number of open sockets (a player may have the game open on a phone and a laptop)
const online = new Map();

// Initialize game controller
const GameController = require('./game/gameController');
app.gameController = new GameController(io);
app.gameController.isOnline = (userId) => online.has(userId);
app.io = io;

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/game', require('./routes/game'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/trade', require('./routes/trade'));
app.use('/api/admin', require('./routes/admin'));

// Health check for deploys: the database answers, every migration in backend/migrations is applied, and the
// board is seeded. deployp treats anything but 200 as a failed deploy.
const { pendingMigrations } = require('./scripts/migrate');
app.get('/api/health', async (req, res) => {
  try {
    const pending = await pendingMigrations(pool);
    const properties = (await pool.query('SELECT COUNT(*)::int AS n FROM properties')).rows[0].n;
    const ok = pending.length === 0 && properties === 28;
    res.status(ok ? 200 : 500).json({ ok, properties, ...(pending.length ? { pendingMigrations: pending } : {}) });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'PolyMono: Manhattan Edition Backend API' });
});

// Malformed JSON bodies and other errors thrown before a route runs.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON' });
  console.error(`${req.method} ${req.originalUrl} failed:`, err);
  res.status(err.status || 500).json({ message: 'Server error' });
});

// Sockets: the client sends its JWT in the handshake; the server only pushes to it.
io.use(async (socket, next) => {
  try {
    socket.data.user = await userFromToken(socket.handshake.auth?.token);
    next();
  } catch {
    next(new Error('unauthorized'));
  }
});


function broadcastPresence() {
  io.emit('presence', { online: [...online.keys()] });
}

io.on('connection', async (socket) => {
  const user = socket.data.user;
  if (!user.isSpectator) {
    socket.join(`user:${user.id}`);
    online.set(user.id, (online.get(user.id) || 0) + 1);
    broadcastPresence();
  }

  socket.on('disconnect', () => {
    if (user.isSpectator) return;
    const n = (online.get(user.id) || 1) - 1;
    if (n > 0) online.set(user.id, n);
    else online.delete(user.id);
    broadcastPresence();
  });

  try {
    socket.emit('game:state', await app.gameController.getState());
    socket.emit('presence', { online: [...online.keys()] });
  } catch (error) {
    console.error('Error sending game state:', error);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  app.gameController.startTurnTimer();
});

module.exports = { app, server };
