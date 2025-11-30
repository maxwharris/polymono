const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { getPlayerByUserId, getAllProperties } = require('../db/queries');
const {
  createTrade,
  getPlayerTrades,
  getTradeById,
  updateTradeStatus,
  counterTrade,
  deleteTrade
} = require('../db/tradeQueries');
const { executeTrade } = require('../game/mechanics/trade');

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// All routes require authentication
router.use(authenticateToken);

// GET /api/trade - Get all trades for current player
router.get('/', async (req, res) => {
  try {
    const player = await getPlayerByUserId(req.user.id);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    const trades = await getPlayerTrades(player.id);

    // Enrich trades with property details and validate they're still possible
    const allProperties = await getAllProperties();
    const enrichedTrades = [];

    for (const trade of trades) {
      // Parse JSONB fields - they come as objects/arrays from PostgreSQL
      const offeredPropIds = trade.offered_properties || [];
      const requestedPropIds = trade.requested_properties || [];

      // Check if trade is still valid
      let isValid = true;

      // Verify proposer still owns offered properties
      for (const propId of offeredPropIds) {
        const property = allProperties.find(p => p.id === propId);
        if (!property || property.owner_id !== trade.proposer_id) {
          isValid = false;
          break;
        }
      }

      // Verify recipient still owns requested properties
      if (isValid) {
        for (const propId of requestedPropIds) {
          const property = allProperties.find(p => p.id === propId);
          if (!property || property.owner_id !== trade.recipient_id) {
            isValid = false;
            break;
          }
        }
      }

      // If invalid, expire the trade and skip it
      if (!isValid) {
        await updateTradeStatus(trade.id, 'expired');
        continue;
      }

      const offeredProps = offeredPropIds
        .map(id => allProperties.find(p => p.id === id))
        .filter(Boolean);
      const requestedProps = requestedPropIds
        .map(id => allProperties.find(p => p.id === id))
        .filter(Boolean);

      enrichedTrades.push({
        ...trade,
        offered_properties_details: offeredProps,
        requested_properties_details: requestedProps
      });
    }

    res.json(enrichedTrades);
  } catch (error) {
    console.error('Get trades error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/trade - Create a new trade offer
router.post('/', async (req, res) => {
  try {
    const player = await getPlayerByUserId(req.user.id);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    const {
      recipientPlayerId,
      offeredProperties = [],
      offeredMoney = 0,
      offeredJailCards = 0,
      requestedProperties = [],
      requestedMoney = 0,
      requestedJailCards = 0
    } = req.body;

    if (!recipientPlayerId) {
      return res.status(400).json({ message: 'Recipient player ID required' });
    }

    if (recipientPlayerId === player.id) {
      return res.status(400).json({ message: 'Cannot trade with yourself' });
    }

    // Validate proposer has the resources
    if (offeredMoney > player.money) {
      return res.status(400).json({ message: 'Insufficient funds' });
    }

    if (offeredJailCards > player.get_out_of_jail_cards) {
      return res.status(400).json({ message: 'Insufficient jail cards' });
    }

    // Validate property ownership
    const allProperties = await getAllProperties();
    for (const propId of offeredProperties) {
      const property = allProperties.find(p => p.id === propId);
      if (!property || property.owner_id !== player.id) {
        return res.status(400).json({ message: `You do not own property ID ${propId}` });
      }
      if (property.is_mortgaged) {
        return res.status(400).json({ message: `Cannot trade mortgaged property: ${property.name}` });
      }
      if (property.house_count > 0) {
        return res.status(400).json({ message: `Cannot trade property with buildings: ${property.name}` });
      }
    }

    const trade = await createTrade({
      proposerId: player.id,
      recipientId: recipientPlayerId,
      offeredProperties,
      offeredMoney,
      offeredJailCards,
      requestedProperties,
      requestedMoney,
      requestedJailCards
    });

    // Broadcast to all clients
    if (req.app.io) {
      req.app.io.emit('trade:new_offer', {
        trade,
        proposer_username: req.user.username
      });
    }

    res.json(trade);
  } catch (error) {
    console.error('Create trade error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/trade/:id/accept - Accept a trade
router.post('/:id/accept', async (req, res) => {
  try {
    const player = await getPlayerByUserId(req.user.id);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    const trade = await getTradeById(req.params.id);
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    // Only the recipient can accept
    if (trade.recipient_id !== player.id) {
      return res.status(403).json({ message: 'Only the recipient can accept this trade' });
    }

    if (trade.status !== 'pending' && trade.status !== 'countered') {
      return res.status(400).json({ message: 'Trade is not in a valid state' });
    }

    // Validate trade is still possible before executing
    const allProperties = await getAllProperties();
    const offeredPropIds = trade.offered_properties || [];
    const requestedPropIds = trade.requested_properties || [];

    // Check if proposer still owns offered properties
    for (const propId of offeredPropIds) {
      const property = allProperties.find(p => p.id === propId);
      if (!property || property.owner_id !== trade.proposer_id) {
        await updateTradeStatus(req.params.id, 'expired');
        return res.status(400).json({ message: 'Trade is no longer valid - proposer does not own all offered properties' });
      }
    }

    // Check if recipient still owns requested properties
    for (const propId of requestedPropIds) {
      const property = allProperties.find(p => p.id === propId);
      if (!property || property.owner_id !== trade.recipient_id) {
        await updateTradeStatus(req.params.id, 'expired');
        return res.status(400).json({ message: 'Trade is no longer valid - you do not own all requested properties' });
      }
    }

    // Execute the trade
    const result = await executeTrade(req.params.id);

    // Get property details for the broadcast (reuse allProperties from above)
    const tradeOfferedPropIds = result.trade.offered_properties || [];
    const tradeRequestedPropIds = result.trade.requested_properties || [];

    const offeredPropertyNames = tradeOfferedPropIds
      .map(id => allProperties.find(p => p.id === id)?.name)
      .filter(Boolean);
    const requestedPropertyNames = tradeRequestedPropIds
      .map(id => allProperties.find(p => p.id === id)?.name)
      .filter(Boolean);

    // Build detailed trade description
    const proposerGave = [];
    if (offeredPropertyNames.length > 0) {
      proposerGave.push(offeredPropertyNames.join(', '));
    }
    if (result.trade.offered_money > 0) {
      proposerGave.push(`$${result.trade.offered_money}`);
    }
    if (result.trade.offered_jail_cards > 0) {
      proposerGave.push(`${result.trade.offered_jail_cards} Get Out of Jail card${result.trade.offered_jail_cards > 1 ? 's' : ''}`);
    }

    const recipientGave = [];
    if (requestedPropertyNames.length > 0) {
      recipientGave.push(requestedPropertyNames.join(', '));
    }
    if (result.trade.requested_money > 0) {
      recipientGave.push(`$${result.trade.requested_money}`);
    }
    if (result.trade.requested_jail_cards > 0) {
      recipientGave.push(`${result.trade.requested_jail_cards} Get Out of Jail card${result.trade.requested_jail_cards > 1 ? 's' : ''}`);
    }

    // Broadcast to all clients
    if (req.app.io) {
      req.app.io.emit('trade:accepted', {
        trade: result.trade,
        proposer_username: trade.proposer_username,
        recipient_username: trade.recipient_username,
        proposerGave: proposerGave.join(', '),
        recipientGave: recipientGave.join(', ')
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Accept trade error:', error);
    res.status(400).json({ message: error.message });
  }
});

// POST /api/trade/:id/reject - Reject a trade
router.post('/:id/reject', async (req, res) => {
  try {
    const player = await getPlayerByUserId(req.user.id);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    const trade = await getTradeById(req.params.id);
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    // Only the recipient can reject
    if (trade.recipient_id !== player.id) {
      return res.status(403).json({ message: 'Only the recipient can reject this trade' });
    }

    const updatedTrade = await updateTradeStatus(req.params.id, 'rejected');

    // Broadcast to all clients
    if (req.app.io) {
      req.app.io.emit('trade:rejected', {
        trade: updatedTrade,
        proposer_username: trade.proposer_username,
        recipient_username: trade.recipient_username
      });
    }

    res.json(updatedTrade);
  } catch (error) {
    console.error('Reject trade error:', error);
    res.status(500).json({ message: error.message });
  }
});

// POST /api/trade/:id/counter - Counter a trade with new terms
router.post('/:id/counter', async (req, res) => {
  try {
    const player = await getPlayerByUserId(req.user.id);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    const trade = await getTradeById(req.params.id);
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    // Only the recipient can counter
    if (trade.recipient_id !== player.id) {
      return res.status(403).json({ message: 'Only the recipient can counter this trade' });
    }

    const {
      offeredProperties = [],
      offeredMoney = 0,
      offeredJailCards = 0,
      requestedProperties = [],
      requestedMoney = 0,
      requestedJailCards = 0
    } = req.body;

    const updatedTrade = await counterTrade(req.params.id, {
      offeredProperties,
      offeredMoney,
      offeredJailCards,
      requestedProperties,
      requestedMoney,
      requestedJailCards
    });

    // Broadcast to all clients
    if (req.app.io) {
      req.app.io.emit('trade:countered', {
        trade: updatedTrade,
        proposer_username: trade.proposer_username,
        recipient_username: trade.recipient_username
      });
    }

    res.json(updatedTrade);
  } catch (error) {
    console.error('Counter trade error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/trade/:id - Cancel a trade
router.delete('/:id', async (req, res) => {
  try {
    const player = await getPlayerByUserId(req.user.id);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    const trade = await getTradeById(req.params.id);
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    // Only the proposer can cancel
    if (trade.proposer_id !== player.id) {
      return res.status(403).json({ message: 'Only the proposer can cancel this trade' });
    }

    await deleteTrade(req.params.id);

    // Broadcast to all clients
    if (req.app.io) {
      req.app.io.emit('trade:cancelled', {
        tradeId: req.params.id,
        proposer_username: trade.proposer_username
      });
    }

    res.json({ message: 'Trade cancelled successfully' });
  } catch (error) {
    console.error('Cancel trade error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
