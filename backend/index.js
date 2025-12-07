const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: [
    "https://mp.maxharris.io",
    "http://mp.maxharris.io",
    "http://localhost:5173"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
};

const io = socketIo(server, {
  cors: corsOptions
});

app.use(cors(corsOptions));
app.use(express.json());

// Initialize game controller
const GameController = require('./game/gameController');
app.gameController = new GameController(io);
app.io = io;

// Routes
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const chatRoutes = require('./routes/chat');
const tradeRoutes = require('./routes/trade');

app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/trade', tradeRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'PolyMono: Manhattan Edition Backend API' });
});

// Socket.io connection
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('user:authenticate', async (data) => {
    const { userId, username } = data;
    connectedUsers.set(socket.id, { userId, username });

    console.log(`User authenticated: ${username} (${userId})`);

    // Broadcast to all clients
    io.emit('player:connected', { userId, username });

    // Send current game state to new connection
    try {
      const gameState = await app.gameController.getFullGameState();
      socket.emit('game:state', gameState);
    } catch (error) {
      console.error('Error sending game state:', error);
    }
  });

  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      io.emit('player:disconnected', user);
      connectedUsers.delete(socket.id);
      console.log(`User disconnected: ${user.username}`);
    } else {
      console.log('User disconnected:', socket.id);
    }
  });

  // Handle game reset from admin script
  socket.on('admin:game_reset', () => {
    console.log('Game reset requested - broadcasting to all clients');
    io.emit('game:reset');
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
});
