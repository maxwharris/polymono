/**
 * Main Game Controller - Orchestrates all game actions
 */

const { rollDice } = require('./mechanics/dice');
const { movePlayer } = require('./mechanics/movement');
const { purchaseProperty, calculateRent, payRent, canBuildOnProperty, purchaseHouses } = require('./mechanics/property');
const { sendToJail, tryGetOutOfJail, incrementJailTurns } = require('./mechanics/jail');
const { drawCard } = require('./mechanics/cards');
const turnManager = require('./mechanics/turnManager');
const {
  getGame,
  getAllPlayers,
  getPlayerByUserId,
  getPlayerById,
  getAllProperties,
  getPropertyByPosition,
  logGameAction
} = require('../db/queries');

class GameController {
  constructor(io) {
    this.io = io; // Socket.io instance
    this.currentDiceRoll = null;
    this.doublesCount = new Map(); // Track doubles per player

    // Set the io instance on turnManager
    turnManager.setIO(io);
  }

  async handleRollDice(userId) {
    const game = await getGame();
    const player = await getPlayerByUserId(userId);

    // Validate it's player's turn
    if (game.current_turn_user_id !== userId) {
      throw new Error('Not your turn');
    }

    // Roll dice
    const roll = rollDice();
    this.currentDiceRoll = roll;

    await logGameAction(player.id, 'roll_dice', roll);

    // Handle jail
    if (player.is_in_jail) {
      if (roll.isDoubles) {
        await tryGetOutOfJail(player, 'doubles');
        const moveResult = await movePlayer(player, roll.total);

        // Reset doubles count since player is out of jail
        this.doublesCount.set(userId, 0);

        return {
          roll,
          action: 'escaped_jail_with_doubles',
          moveResult,
          canRollAgain: false // Used up the doubles to escape
        };
      } else {
        const jailResult = await incrementJailTurns(player);

        return {
          roll,
          action: 'jail_turn_incremented',
          jailTurns: player.jail_turns + 1,
          jailResult,
          canRollAgain: false
        };
      }
    } else {
      // Normal move
      const currentDoubles = this.doublesCount.get(userId) || 0;

      if (roll.isDoubles) {
        const newDoubles = currentDoubles + 1;
        this.doublesCount.set(userId, newDoubles);

        if (newDoubles === 3) {
          // Three doubles in a row - go to jail!
          await sendToJail(player);
          this.doublesCount.set(userId, 0);

          return {
            roll,
            action: 'sent_to_jail',
            reason: 'three_doubles',
            canRollAgain: false
          };
        }
      } else {
        this.doublesCount.set(userId, 0);
      }

      // Move player
      const moveResult = await movePlayer(player, roll.total);

      // Refresh player data after move
      const updatedPlayer = await getPlayerByUserId(userId);

      // Check landing space
      const landingResult = await this.handleLanding(updatedPlayer, roll.total);

      return {
        roll,
        moveResult,
        landingResult,
        canRollAgain: roll.isDoubles
      };
    }
  }

  async handleLanding(player, diceTotal) {
    const property = await getPropertyByPosition(player.position);

    if (!property) {
      // Special space (GO, Jail, Free Parking, etc.)
      return await this.handleSpecialSpace(player, diceTotal);
    }

    if (property.owner_id === null) {
      // Unowned property - offer to buy
      return {
        action: 'offer_purchase',
        property
      };
    }

    if (property.owner_id === player.id) {
      // Own property - do nothing
      return {
        action: 'own_property',
        property
      };
    }

    // Pay rent to owner
    const owner = await getPlayerById(property.owner_id);
    const rent = await calculateRent(property, diceTotal);

    if (player.money < rent) {
      return {
        action: 'insufficient_funds',
        property,
        owner,
        rentOwed: rent,
        playerMoney: player.money
      };
    }

    await payRent(player, owner, rent);
    await logGameAction(player.id, 'pay_rent', {
      propertyId: property.id,
      amount: rent,
      ownerId: owner.id
    });

    return {
      action: 'paid_rent',
      property,
      owner,
      amount: rent
    };
  }

  async handleSpecialSpace(player, diceTotal) {
    const position = player.position;

    const SPECIAL_SPACES = {
      0: 'GO',
      2: 'COMMUNITY_CHEST',
      7: 'CHANCE',
      10: 'JAIL_VISITING',
      17: 'COMMUNITY_CHEST',
      20: 'FREE_PARKING',
      22: 'CHANCE',
      30: 'GO_TO_JAIL',
      33: 'COMMUNITY_CHEST',
      36: 'CHANCE',
      4: 'INCOME_TAX',
      38: 'LUXURY_TAX'
    };

    const spaceType = SPECIAL_SPACES[position];

    switch (spaceType) {
      case 'GO_TO_JAIL':
        await sendToJail(player);
        return { action: 'sent_to_jail', reason: 'landed_on_go_to_jail' };

      case 'CHANCE':
      case 'COMMUNITY_CHEST':
        const deckType = spaceType === 'CHANCE' ? 'chance' : 'communitychest';
        const allPlayers = await getAllPlayers();
        const allProperties = await getAllProperties();
        const cardResult = await drawCard(player, deckType, allPlayers, allProperties);

        await logGameAction(player.id, 'drew_card', {
          deckType,
          card: cardResult.card.text
        });

        return {
          action: 'drew_card',
          deckType,
          card: {
            type: cardResult.card.type,
            text: cardResult.card.text
          },
          effects: cardResult.effects,
          player: {
            id: player.id,
            username: player.username
          }
        };

      case 'INCOME_TAX':
        await updatePlayer(player.id, { money: player.money - 200 });
        await logGameAction(player.id, 'paid_tax', { type: 'income', amount: 200 });
        return { action: 'paid_tax', type: 'income', amount: 200 };

      case 'LUXURY_TAX':
        await updatePlayer(player.id, { money: player.money - 100 });
        await logGameAction(player.id, 'paid_tax', { type: 'luxury', amount: 100 });
        return { action: 'paid_tax', type: 'luxury', amount: 100 };

      case 'FREE_PARKING':
        return { action: 'free_parking' };

      case 'JAIL_VISITING':
        return { action: 'just_visiting' };

      case 'GO':
        return { action: 'landed_on_go' };

      default:
        return { action: 'nothing' };
    }
  }

  async handleBuyProperty(userId, propertyId) {
    const player = await getPlayerByUserId(userId);
    const property = await getPropertyByPosition(player.position);

    if (!property || property.id !== propertyId) {
      throw new Error('Can only buy property you landed on');
    }

    const result = await purchaseProperty(player, property);
    await logGameAction(player.id, 'buy_property', { propertyId });

    return { success: true, property, player, ...result };
  }

  async handleBuyHouses(userId, propertyId, count) {
    const player = await getPlayerByUserId(userId);
    const allProperties = await getAllProperties();
    const property = allProperties.find(p => p.id === propertyId);

    if (!property) {
      throw new Error('Property not found');
    }

    // Check if player can build
    const buildCheck = await canBuildOnProperty(player, property);
    if (!buildCheck.canBuild) {
      throw new Error(buildCheck.reason);
    }

    const result = await purchaseHouses(player, property, count);
    await logGameAction(player.id, 'buy_houses', {
      propertyId,
      count,
      cost: result.cost
    });

    // Refresh property data
    const updatedProperties = await getAllProperties();
    const updatedProperty = updatedProperties.find(p => p.id === propertyId);

    return {
      success: true,
      property: updatedProperty,
      player: await getPlayerByUserId(userId),
      ...result
    };
  }

  async handleEndTurn(userId) {
    const game = await getGame();

    if (game.current_turn_user_id !== userId) {
      throw new Error('Not your turn');
    }

    // Reset dice roll and doubles count for this player
    this.currentDiceRoll = null;
    this.doublesCount.set(userId, 0);

    const result = await turnManager.endTurn();

    // Broadcast turn change to all clients
    if (this.io) {
      this.io.emit('game:turn_change', result);
    }

    return result;
  }

  async getFullGameState() {
    const game = await getGame();
    const players = await getAllPlayers();
    const properties = await getAllProperties();

    return {
      game,
      players,
      properties,
      currentDiceRoll: this.currentDiceRoll
    };
  }
}

module.exports = GameController;
