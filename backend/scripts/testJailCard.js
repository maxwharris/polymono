const pool = require('../db');

async function testJailCard() {
  console.log('Testing Get Out of Jail Free card functionality...\n');

  try {
    // Get the first player
    const playerResult = await pool.query('SELECT * FROM players ORDER BY turn_order LIMIT 1');

    if (playerResult.rows.length === 0) {
      console.log('No players found in the game.');
      process.exit(0);
    }

    const player = playerResult.rows[0];
    console.log(`Player: ${player.username} (ID: ${player.id})`);
    console.log(`Current jail cards: ${player.get_out_of_jail_cards}`);
    console.log(`In jail: ${player.is_in_jail}`);
    console.log(`Position: ${player.position}\n`);

    // Give player a jail card
    await pool.query(
      'UPDATE players SET get_out_of_jail_cards = get_out_of_jail_cards + 1 WHERE id = $1',
      [player.id]
    );
    console.log('✓ Gave player 1 Get Out of Jail Free card\n');

    // Send player to jail
    await pool.query(
      'UPDATE players SET position = 10, is_in_jail = true, jail_turns = 0 WHERE id = $1',
      [player.id]
    );
    console.log('✓ Sent player to jail (position 10)\n');

    // Verify
    const updatedPlayer = await pool.query('SELECT * FROM players WHERE id = $1', [player.id]);
    const updated = updatedPlayer.rows[0];

    console.log('Updated player state:');
    console.log(`  Jail cards: ${updated.get_out_of_jail_cards}`);
    console.log(`  In jail: ${updated.is_in_jail}`);
    console.log(`  Jail turns: ${updated.jail_turns}`);
    console.log(`  Position: ${updated.position}`);
    console.log('\n✅ Test setup complete!');
    console.log('\nNext steps:');
    console.log('1. The frontend should show a gold "🎴 Jail Card ×1" badge on the player');
    console.log('2. On the player\'s next turn, when they roll dice:');
    console.log('   - The jail card will be automatically used');
    console.log('   - Player will be freed from jail');
    console.log('   - Game log will show: "🎴 [Player] used a Get Out of Jail Free card and escaped!"');
    console.log('   - Player will move normally based on their roll');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testJailCard();
