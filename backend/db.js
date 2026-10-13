const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME
});

// An idle client losing its connection (Postgres restart) emits here; without a listener it crashes the process.
pool.on('error', (err) => {
  console.error('Postgres pool error:', err.message);
});

module.exports = pool;
