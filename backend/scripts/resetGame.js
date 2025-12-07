/**
 * Reset game state
 * Clears all players, properties ownership, game actions, and chat
 * Resets game to initial state
 */

const pool = require('../db');
const io = require('socket.io-client');

async function resetGame() {
  try {
    console.log('Resetting game state...\n');

    // Delete all game chat
    await pool.query('DELETE FROM game_chat');
    console.log('✓ Cleared chat messages');

    // Delete all game actions
    await pool.query('DELETE FROM game_actions');
    console.log('✓ Cleared game actions log');

    // Reset property ownership (must come before deleting players due to foreign key constraint)
    await pool.query('UPDATE properties SET owner_id = NULL, is_mortgaged = false, house_count = 0');
    console.log('✓ Reset all properties');

    // Delete all trades (must come before deleting players due to foreign key constraint)
    await pool.query('DELETE FROM trades');
    console.log('✓ Cleared all trades');

    // Delete all players
    await pool.query('DELETE FROM players');
    console.log('✓ Removed all players');

    // Reset game state to lobby
    await pool.query(`
      UPDATE game SET
        current_turn_user_id = NULL,
        turn_deadline = NULL,
        status = 'lobby',
        started_at = NULL,
        completed_at = NULL
      WHERE id = 1
    `);
    console.log('✓ Reset game state to lobby');

    // Notify all connected clients to return to login
    try {
      const socket = io('http://localhost:3001');
      socket.on('connect', () => {
        socket.emit('admin:game_reset');
        console.log('✓ Broadcast game reset to all clients');
        socket.disconnect();
        console.log('\n🎮 Game reset complete! Players can join the lobby.');
        process.exit(0);
      });

      socket.on('connect_error', (error) => {
        console.log('⚠️  Could not broadcast to clients (server may not be running)');
        console.log('\n🎮 Game reset complete! Players can join the lobby.');
        process.exit(0);
      });

      // Timeout after 2 seconds if no connection
      setTimeout(() => {
        socket.disconnect();
        console.log('⚠️  Socket connection timeout');
        console.log('\n🎮 Game reset complete! Players can join the lobby.');
        process.exit(0);
      }, 2000);
    } catch (error) {
      console.log('⚠️  Could not broadcast to clients:', error.message);
      console.log('\n🎮 Game reset complete! Players can join the lobby.');
      process.exit(0);
    }
  } catch (error) {
    console.error('Error resetting game:', error);
    process.exit(1);
  }
}

resetGame();
