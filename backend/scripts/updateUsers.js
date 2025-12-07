/**
 * Update users in the database
 * Removes old users and creates new ones
 */

const pool = require('../db');
const bcrypt = require('bcryptjs');

const newUsers = [
  { username: 'max', password: 'max', token: 'taxi' },
  { username: 'jack', password: 'jack', token: 'pigeon' },
  { username: 'youngeun', password: 'youngeun', token: 'rat' },
  { username: 'seabass', password: 'seabass', token: 'subway' },
  { username: 'jason', password: 'jason', token: 'bull' },
  { username: 'raymond', password: 'raymond', token: 'empire' }
];

async function updateUsers() {
  try {
    console.log('Updating user token types...\n');

    // Update existing users' token types
    for (const user of newUsers) {
      const result = await pool.query(
        'UPDATE users SET token_type = $1 WHERE username = $2',
        [user.token, user.username]
      );
      if (result.rowCount > 0) {
        console.log(`✓ Updated ${user.username}: token_type = '${user.token}'`);
      } else {
        console.log(`⚠️  User ${user.username} not found`);
      }
    }

    console.log('\n🎮 User token types updated successfully!');
    console.log('\nUpdated token assignments:');
    newUsers.forEach(u => {
      console.log(`  ${u.username}: ${u.token}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error updating users:', error);
    process.exit(1);
  }
}

updateUsers();
