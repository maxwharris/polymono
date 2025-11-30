/**
 * Trade mechanics for Monopoly
 */

const pool = require('../../db');
const { getPlayerById, getAllProperties, logGameAction } = require('../../db/queries');
const { getTradeById, updateTradeStatus } = require('../../db/tradeQueries');

/**
 * Execute a trade - transfer properties, money, and jail cards
 */
async function executeTrade(tradeId) {
  const trade = await getTradeById(tradeId);

  if (!trade) {
    throw new Error('Trade not found');
  }

  if (trade.status !== 'pending' && trade.status !== 'countered') {
    throw new Error('Trade is not in a valid state to execute');
  }

  const proposer = await getPlayerById(trade.proposer_id);
  const recipient = await getPlayerById(trade.recipient_id);

  if (!proposer || !recipient) {
    throw new Error('One or more players not found');
  }

  // PostgreSQL JSONB fields come as objects/arrays from node-postgres
  const offeredProperties = trade.offered_properties || [];
  const requestedProperties = trade.requested_properties || [];

  // Validate proposer has enough resources
  if (proposer.money < trade.offered_money) {
    throw new Error('Proposer does not have enough money');
  }

  if (proposer.get_out_of_jail_cards < trade.offered_jail_cards) {
    throw new Error('Proposer does not have enough jail cards');
  }

  // Validate recipient has enough resources
  if (recipient.money < trade.requested_money) {
    throw new Error('Recipient does not have enough money');
  }

  if (recipient.get_out_of_jail_cards < trade.requested_jail_cards) {
    throw new Error('Recipient does not have enough jail cards');
  }

  // Validate property ownership
  const allProperties = await getAllProperties();

  for (const propId of offeredProperties) {
    const property = allProperties.find(p => p.id === propId);
    if (!property || property.owner_id !== proposer.id) {
      throw new Error(`Proposer does not own property ID ${propId}`);
    }
    if (property.is_mortgaged) {
      throw new Error(`Cannot trade mortgaged property: ${property.name}`);
    }
    if (property.house_count > 0) {
      throw new Error(`Cannot trade property with houses/hotels: ${property.name}`);
    }
  }

  for (const propId of requestedProperties) {
    const property = allProperties.find(p => p.id === propId);
    if (!property || property.owner_id !== recipient.id) {
      throw new Error(`Recipient does not own property ID ${propId}`);
    }
    if (property.is_mortgaged) {
      throw new Error(`Cannot trade mortgaged property: ${property.name}`);
    }
    if (property.house_count > 0) {
      throw new Error(`Cannot trade property with houses/hotels: ${property.name}`);
    }
  }

  // Execute the trade using a transaction
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Transfer properties from proposer to recipient
    for (const propId of offeredProperties) {
      await client.query(
        'UPDATE properties SET owner_id = $1 WHERE id = $2',
        [recipient.id, propId]
      );
    }

    // Transfer properties from recipient to proposer
    for (const propId of requestedProperties) {
      await client.query(
        'UPDATE properties SET owner_id = $1 WHERE id = $2',
        [proposer.id, propId]
      );
    }

    // Transfer money
    await client.query(
      'UPDATE players SET money = money - $1 WHERE id = $2',
      [trade.offered_money, proposer.id]
    );
    await client.query(
      'UPDATE players SET money = money + $1 WHERE id = $2',
      [trade.offered_money, recipient.id]
    );
    await client.query(
      'UPDATE players SET money = money - $1 WHERE id = $2',
      [trade.requested_money, recipient.id]
    );
    await client.query(
      'UPDATE players SET money = money + $1 WHERE id = $2',
      [trade.requested_money, proposer.id]
    );

    // Transfer jail cards
    if (trade.offered_jail_cards > 0) {
      await client.query(
        'UPDATE players SET get_out_of_jail_cards = get_out_of_jail_cards - $1 WHERE id = $2',
        [trade.offered_jail_cards, proposer.id]
      );
      await client.query(
        'UPDATE players SET get_out_of_jail_cards = get_out_of_jail_cards + $1 WHERE id = $2',
        [trade.offered_jail_cards, recipient.id]
      );
    }

    if (trade.requested_jail_cards > 0) {
      await client.query(
        'UPDATE players SET get_out_of_jail_cards = get_out_of_jail_cards - $1 WHERE id = $2',
        [trade.requested_jail_cards, recipient.id]
      );
      await client.query(
        'UPDATE players SET get_out_of_jail_cards = get_out_of_jail_cards + $1 WHERE id = $2',
        [trade.requested_jail_cards, proposer.id]
      );
    }

    // Mark trade as accepted
    await client.query(
      'UPDATE trades SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['accepted', tradeId]
    );

    await client.query('COMMIT');

    // Get property names for logging
    const offeredPropertyNames = offeredProperties
      .map(id => allProperties.find(p => p.id === id)?.name)
      .filter(Boolean);
    const requestedPropertyNames = requestedProperties
      .map(id => allProperties.find(p => p.id === id)?.name)
      .filter(Boolean);

    // Build detailed trade description
    const proposerGave = [];
    if (offeredPropertyNames.length > 0) {
      proposerGave.push(offeredPropertyNames.join(', '));
    }
    if (trade.offered_money > 0) {
      proposerGave.push(`$${trade.offered_money}`);
    }
    if (trade.offered_jail_cards > 0) {
      proposerGave.push(`${trade.offered_jail_cards} Get Out of Jail card${trade.offered_jail_cards > 1 ? 's' : ''}`);
    }

    const recipientGave = [];
    if (requestedPropertyNames.length > 0) {
      recipientGave.push(requestedPropertyNames.join(', '));
    }
    if (trade.requested_money > 0) {
      recipientGave.push(`$${trade.requested_money}`);
    }
    if (trade.requested_jail_cards > 0) {
      recipientGave.push(`${trade.requested_jail_cards} Get Out of Jail card${trade.requested_jail_cards > 1 ? 's' : ''}`);
    }

    // Log the trade
    await logGameAction(proposer.id, 'trade_executed', {
      tradeId,
      proposer: proposer.username,
      recipient: recipient.username,
      proposerGave: proposerGave.join(', '),
      recipientGave: recipientGave.join(', ')
    });

    return {
      success: true,
      proposer,
      recipient,
      trade
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  executeTrade
};
