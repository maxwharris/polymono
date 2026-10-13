const properties = require('../data/properties');

// Inserts the 28 purchasable spaces (existing ones are kept). `db` is a pg Pool or Client.
async function seedProperties(db, log = console.log) {
  log('Seeding properties into database...\n');

  let count = 0;

  for (const prop of properties) {
    // Only seed properties that can be purchased (not special spaces)
    if (prop.type === 'property' || prop.type === 'railroad' || prop.type === 'utility') {
      try {
        await db.query(
          `INSERT INTO properties
          (name, property_type, color_group, position_on_board, purchase_price, rent_base, rent_values, house_cost, mortgage_value)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (game_id, position_on_board) DO NOTHING`,
          [
            prop.name,
            prop.type,
            prop.colorGroup || null,
            prop.position,
            prop.price,
            prop.rent[0],
            JSON.stringify(prop.rent),
            prop.houseCost || null,
            prop.mortgageValue
          ]
        );
        log(`✓ Added: ${prop.name} (position ${prop.position})`);
        count++;
      } catch (error) {
        console.error(`✗ Error adding ${prop.name}:`, error.message);
      }
    }
  }

  log(`\n✅ Seeded ${count} properties successfully!`);
  log('Properties breakdown:');
  log('  - 22 standard properties');
  log('  - 4 railroads');
  log('  - 2 utilities');
  log('  = 28 total purchasable properties\n');
  return count;
}

module.exports = seedProperties;

if (require.main === module) {
  seedProperties(require('../db')).then(() => process.exit(0), error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
