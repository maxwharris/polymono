const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Query database for user
    const result = await pool.query(
      'SELECT id, username, password_hash, token_type FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password using bcrypt
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        tokenType: user.token_type
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/register', async (req, res) => {
  const { username, password, tokenType } = req.body;

  try {
    // Validate input
    if (!username || !password || !tokenType) {
      return res.status(400).json({ message: 'Username, password, and token type are required' });
    }

    // Validate token type
    const validTokenTypes = ['car', 'hat', 'dog', 'ship', 'thimble', 'shoe', 'boot', 'wheelbarrow', 'iron', 'battleship', 'cannon', 'horse'];
    if (!validTokenTypes.includes(tokenType)) {
      return res.status(400).json({ message: 'Invalid token type' });
    }

    // Check if username already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Check if token type is already taken
    const existingToken = await pool.query(
      'SELECT id FROM users WHERE token_type = $1',
      [tokenType]
    );

    if (existingToken.rows.length > 0) {
      return res.status(400).json({ message: 'Token type already taken' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, token_type) VALUES ($1, $2, $3) RETURNING id, username, token_type',
      [username, passwordHash, tokenType]
    );

    const newUser = result.rows[0];

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        tokenType: newUser.token_type
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

router.post('/spectate', (req, res) => {
  try {
    // Generate JWT token for spectator (ID 0)
    const token = jwt.sign(
      { id: 0, username: 'Spectator', isSpectator: true },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: 0,
        username: 'Spectator',
        token_type: 'spectator'
      }
    });
  } catch (error) {
    console.error('Spectate error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, token_type, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Check if user exists
    const userCheck = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const username = userCheck.rows[0].username;

    // Delete user (this will cascade delete related records if foreign keys are set up)
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({
      message: 'User deleted successfully',
      username: username
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
