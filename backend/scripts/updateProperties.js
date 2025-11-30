const pool = require('../db');
const properties = require('../data/properties');

async function updateProperties() {
  console.log('Updating properties in database with new rent values...\n');

  // Test connection first
  try {
    const testResult = await pool.query('SELECT NOW()');
    console.log('✓ Database connection successful:', testResult.rows[0].now);
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }

  let count = 0;

  for (const prop of properties) {
    // Only update properties that can be purchased (not special spaces)
    if (prop.type === 'property' || prop.type === 'railroad' || prop.type === 'utility') {
      try {
        const result = await pool.query(
          `UPDATE properties
          SET rent_base = $1,
              rent_values = $2,
              house_cost = $3,
              mortgage_value = $4
          WHERE position_on_board = $5 AND game_id = 1`,
          [
            prop.rent[0],
            JSON.stringify(prop.rent),
            prop.houseCost || null,
            prop.mortgageValue,
            prop.position
          ]
        );

        if (result.rowCount > 0) {
          console.log(`✓ Updated: ${prop.name} (position ${prop.position}) - rent array: ${JSON.stringify(prop.rent)}`);
          count++;
        } else {
          console.log(`⚠ Not found: ${prop.name} (position ${prop.position})`);
        }
      } catch (error) {
        console.error(`✗ Error updating ${prop.name}:`, error.message);
      }
    }
  }

  console.log(`\n✅ Updated ${count} properties successfully!`);
  console.log('\nVerifying Mediterranean Avenue rent values...');

  const verification = await pool.query(
    `SELECT name, rent_base, rent_values FROM properties WHERE name = 'Mediterranean Avenue' AND game_id = 1`
  );

  if (verification.rows.length > 0) {
    const prop = verification.rows[0];
    console.log(`  Name: ${prop.name}`);
    console.log(`  rent_base: ${prop.rent_base}`);
    console.log(`  rent_values: ${JSON.stringify(prop.rent_values)}`);
    console.log(`  Expected rent_values: [2, 4, 10, 30, 90, 160, 250]`);

    if (prop.rent_values[0] === 4 && prop.rent_values[1] === 10) {
      console.log('\n✅ Rent values updated correctly! With-set (rent_values[0]) = 4, 1 House (rent_values[1]) = 10');
    } else {
      console.log('\n⚠ Rent values may not be correct. Please check.');
    }
  }

  process.exit(0);
}

updateProperties().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
