const express = require('express');
const { authenticateToken, requirePlayer } = require('../middleware/auth');
const { getChatMessages, createChatMessage } = require('../db/queries');

const router = express.Router();

const MAX_MESSAGE_LENGTH = 500;

router.use(authenticateToken);

// GET /api/chat/messages - Get chat history
router.get('/messages', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
    res.json(await getChatMessages(undefined, limit));
  } catch (error) {
    console.error('Get chat messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/chat/send - Send message (players only; spectators read along)
router.post('/send', requirePlayer, async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) {
    return res.status(400).json({ message: 'Message cannot be empty' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ message: `Messages are limited to ${MAX_MESSAGE_LENGTH} characters` });
  }
  try {
    const chatMessage = await createChatMessage(undefined, req.user.id, message);
    const payload = { ...chatMessage, username: req.user.username };
    req.app.io?.emit('chat:message', payload);
    res.json(payload);
  } catch (error) {
    console.error('Send chat message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
