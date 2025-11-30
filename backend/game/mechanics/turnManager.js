/**
 * Turn management for Monopoly
 */

const { getAllPlayers, updateGame, getGame, logGameAction, getPlayerByUserId } = require('../../db/queries');
const { tryGetOutOfJail } = require('./jail');

class TurnManager {
  constructor() {
    this.turnTimeout = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.io = null; // Socket.io instance for broadcasting
  }

  setIO(io) {
    this.io = io;
  }

  async startTurn(userId) {
    const deadline = new Date(Date.now() + this.turnTimeout);

    await updateGame({
      currentTurnUserId: userId,
      turnDeadline: deadline
    });

    await logGameAction(null, 'turn_start', { userId, deadline });

    // Check if player is in jail and has a Get Out of Jail Free card
    const player = await getPlayerByUserId(userId);
    let usedJailCard = false;

    if (player && player.is_in_jail && player.get_out_of_jail_cards > 0) {
      try {
        const cardResult = await tryGetOutOfJail(player, 'card');
        await logGameAction(player.id, 'used_jail_card', { cardsRemaining: cardResult.cardsRemaining });
        usedJailCard = true;

        // Broadcast jail card usage to all clients
        if (this.io) {
          this.io.emit('game:jail_card_used', {
            user_id: userId,
            username: player.username,
            cardsRemaining: cardResult.cardsRemaining
          });
        }
      } catch (error) {
        console.error('Error using jail card on turn start:', error);
      }
    }

    return { userId, deadline, usedJailCard };
  }

  async endTurn() {
    const game = await getGame();
    const players = await getAllPlayers();

    // Filter out bankrupt players
    const activePlayers = players.filter(p => !p.is_bankrupt);

    if (activePlayers.length === 1) {
      // Game over! Only one player remaining
      await updateGame({
        status: 'completed',
        currentTurnUserId: null,
        completedAt: new Date()
      });

      return {
        gameOver: true,
        winner: activePlayers[0]
      };
    }

    if (activePlayers.length === 0) {
      // No active players (shouldn't happen, but handle gracefully)
      await updateGame({
        status: 'completed',
        currentTurnUserId: null
      });

      return {
        gameOver: true,
        winner: null
      };
    }

    // Find current player index
    const currentIndex = activePlayers.findIndex(
      p => p.user_id === game.current_turn_user_id
    );

    // Move to next player (circular)
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    const nextPlayer = activePlayers[nextIndex];

    await this.startTurn(nextPlayer.user_id);

    return {
      gameOver: false,
      nextPlayerId: nextPlayer.user_id,
      nextPlayer: nextPlayer
    };
  }

  async handleTimeout(userId) {
    // Auto-end turn when player times out
    await logGameAction(null, 'turn_timeout', { userId });
    return await this.endTurn();
  }

  async getCurrentTurn() {
    const game = await getGame();
    return {
      currentPlayerId: game.current_turn_user_id,
      deadline: game.turn_deadline
    };
  }
}

module.exports = new TurnManager();
