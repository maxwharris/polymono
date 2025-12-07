import { create } from 'zustand';
import socketService from '../services/socket';

// Backend API URL - use environment variable or default to domain
const API_URL = import.meta.env.VITE_BACKEND_URL || '';

const useGameStore = create((set, get) => ({
  // Authentication
  user: null,
  token: null,
  isSpectator: false,

  // Game state
  game: null,
  players: [],
  properties: [],
  myPlayer: null,
  isMyTurn: false,
  currentDiceRoll: null,
  canRollAgain: true, // Track if player can roll again (resets on turn start)

  // UI state
  isConnected: false,
  chatMessages: [],
  gameLog: [],
  landedSpace: null, // Track the space a player just landed on
  purchasedProperty: null, // Track when a property is purchased
  drawnCard: null, // Track when an Opportunity/Community Fund card is drawn

  // Actions
  setUser: (user) => set({ user }),

  setSpectatorMode: (isSpectator) => set({ isSpectator }),

  setToken: (token) => {
    localStorage.setItem('token', token);
    set({ token });
  },

  logout: async () => {
    const { token, game } = get();

    // If in lobby, remove player from game first
    if (game?.status === 'lobby' && token) {
      try {
        await fetch(`${API_URL}/api/game/leave`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.error('Error leaving lobby during logout:', error);
        // Continue with logout even if leave fails
      }
    }

    socketService.disconnect();
    localStorage.removeItem('token');
    set({ user: null, token: null, isSpectator: false, isConnected: false, game: null, players: [], myPlayer: null });
  },

  // Connect to WebSocket and set up listeners
  connectSocket: () => {
    const { user, token, isConnected } = get();
    if (!user || !token) return;

    // Prevent duplicate connections
    if (isConnected || socketService.socket?.connected) {
      console.log('Socket already connected, skipping...');
      return;
    }

    const socket = socketService.connect(user, token);

    // Clean up any existing listeners before setting up new ones
    socket.off('game:state');
    socket.off('game:dice_rolled');
    socket.off('game:property_purchased');
    socket.off('game:houses_purchased');
    socket.off('game:turn_change');
    socket.off('game:jail_card_used');
    socket.off('trade:new_offer');
    socket.off('trade:accepted');
    socket.off('trade:rejected');
    socket.off('trade:countered');
    socket.off('trade:cancelled');
    socket.off('chat:message');
    socket.off('player:connected');
    socket.off('player:disconnected');
    socket.off('player:joined');
    socket.off('lobby:player_ready');
    socket.off('lobby:player_left');
    socket.off('lobby:player_removed');

    socket.on('game:state', (gameState) => {
      set({
        game: gameState.game,
        players: gameState.players,
        properties: gameState.properties,
        currentDiceRoll: gameState.currentDiceRoll,
        isConnected: true
      });

      // Update myPlayer and isMyTurn
      get().updateMyTurnStatus();
    });

    socket.on('game:dice_rolled', (result) => {
      set({
        currentDiceRoll: result.roll,
        // Set canRollAgain based on backend response (for the player who rolled)
        canRollAgain: result.user_id === get().user?.id ? result.canRollAgain : get().canRollAgain
      });

      const roller = get().players.find(p => p.user_id === result.user_id);
      const rollerName = roller?.username || 'Player';

      get().addToGameLog(`${rollerName} rolled ${result.roll.die1} and ${result.roll.die2} (Total: ${result.roll.total})`);

      // Log money changes from passing GO
      if (result.moveResult?.passedGo) {
        get().addToGameLog(`💰 ${rollerName} passed GO and collected $200`);
      }

      // Log landing results with money transactions
      if (result.landingResult) {
        const landing = result.landingResult;

        if (landing.action === 'paid_rent') {
          get().addToGameLog(`💸 ${rollerName} paid $${landing.amount} rent to ${landing.owner.username} for ${landing.property.name}`);
        } else if (landing.action === 'paid_tax') {
          const taxType = landing.type === 'income' ? 'Income Tax' : 'Luxury Tax';
          get().addToGameLog(`💸 ${rollerName} paid $${landing.amount} ${taxType}`);
        } else if (landing.action === 'drew_card') {
          const deckName = landing.deckType === 'chance' ? 'Opportunity' : 'Community Fund';
          get().addToGameLog(`🎴 ${landing.player.username} drew ${deckName}: "${landing.card.text}"`);

          // Log card effects
          if (landing.effects && landing.effects.length > 0) {
            landing.effects.forEach(effect => {
              if (effect.type === 'money_change') {
                const verb = effect.amount > 0 ? 'received' : 'paid';
                const emoji = effect.amount > 0 ? '💰' : '💸';
                get().addToGameLog(`${emoji} ${landing.player.username} ${verb} $${Math.abs(effect.amount)}`);
              } else if (effect.type === 'moved') {
                get().addToGameLog(`🚀 ${landing.player.username} moved to position ${effect.newPosition}`);
                if (effect.passedGo) {
                  get().addToGameLog(`💰 ${landing.player.username} passed GO and collected $200`);
                }
              } else if (effect.type === 'paid_all') {
                get().addToGameLog(`💸 ${landing.player.username} paid $${effect.totalAmount} to ${effect.count} player(s)`);
              } else if (effect.type === 'collected_from_all') {
                get().addToGameLog(`💰 ${landing.player.username} collected $${effect.totalAmount} from ${effect.count} player(s)`);
              } else if (effect.type === 'repairs') {
                get().addToGameLog(`🔨 ${landing.player.username} paid $${effect.totalCost} for repairs (${effect.houses} house(s), ${effect.hotels} hotel(s))`);
              } else if (effect.type === 'sent_to_jail') {
                get().addToGameLog(`🚓 ${landing.player.username} was sent to jail`);
              } else if (effect.type === 'received_jail_card') {
                get().addToGameLog(`🎴 ${landing.player.username} received a Get Out of Jail Free card!`);
              }
            });
          }

          // Clear first to ensure useEffect triggers
          set({ drawnCard: null });

          // Set drawn card to show popup (small delay to ensure state change is detected)
          setTimeout(() => {
            set({ drawnCard: landing });
          }, 10);
        } else if (landing.action === 'sent_to_jail') {
          get().addToGameLog(`🚓 ${rollerName} was sent to jail (${landing.reason.replace('_', ' ')})`);
        }
      }

      // Set landed space after refreshing game state - only for the player who rolled
      setTimeout(async () => {
        await get().refreshGameState();
        const { myPlayer, properties, user } = get();
        // Only show landing popup if the dice roller is the current user
        if (myPlayer && result.user_id === user.id) {
          // Find the property or special space at the player's position
          const property = properties.find(p => p.position_on_board === myPlayer.position);
          set({ landedSpace: { position: myPlayer.position, property } });
        }
      }, 100);
    });

    socket.on('game:property_purchased', (result) => {
      get().addToGameLog(`🏠 ${result.player.username} purchased ${result.property.name} for $${result.property.purchase_price}`);

      // Clear first to ensure useEffect triggers
      set({ purchasedProperty: null });

      // Set purchased property to show popup (small delay to ensure state change is detected)
      setTimeout(() => {
        set({ purchasedProperty: result });
        get().refreshGameState();
      }, 10);
    });

    socket.on('game:houses_purchased', (result) => {
      const houseText = result.newHouseCount === 5 ? '🏨 Hotel' :
                        result.housesAdded === 1 ? '🏠 House' :
                        `🏠 ${result.housesAdded} Houses`;
      get().addToGameLog(`🏗️ ${result.player.username} built ${houseText} on ${result.property.name} for $${result.cost}`);
      get().refreshGameState();
    });

    socket.on('game:turn_change', (result) => {
      if (result.gameOver) {
        get().addToGameLog(`Game Over! Winner: ${result.winner?.username || 'None'}`);
      } else {
        get().addToGameLog(`Turn changed to next player`);
      }
      // Reset canRollAgain for the new turn
      set({ canRollAgain: true });
      get().refreshGameState();
    });

    // Trade events
    socket.on('trade:new_offer', (data) => {
      get().addToGameLog(`🤝 ${data.proposer_username} sent a trade offer`);
    });

    socket.on('trade:accepted', (data) => {
      // Build detailed trade log message
      let message = `✅ Trade completed: ${data.proposer_username}`;
      if (data.proposerGave) {
        message += ` gave ${data.proposerGave}`;
      }
      message += ` ↔️ ${data.recipient_username}`;
      if (data.recipientGave) {
        message += ` gave ${data.recipientGave}`;
      }
      get().addToGameLog(message);
      get().refreshGameState();
    });

    socket.on('trade:rejected', (data) => {
      get().addToGameLog(`❌ ${data.recipient_username} rejected trade from ${data.proposer_username}`);
    });

    socket.on('trade:countered', (data) => {
      get().addToGameLog(`🔄 ${data.recipient_username} countered trade from ${data.proposer_username}`);
    });

    socket.on('trade:cancelled', (data) => {
      get().addToGameLog(`🚫 ${data.proposer_username} cancelled a trade offer`);
    });

    socket.on('chat:message', (message) => {
      set(state => ({
        chatMessages: [...state.chatMessages, message]
      }));
    });

    socket.on('player:connected', (player) => {
      // Don't log socket connection - wait for player:joined which is more meaningful
    });

    socket.on('player:disconnected', (player) => {
      get().addToGameLog(`${player.username} disconnected`);
    });

    socket.on('player:joined', (data) => {
      get().addToGameLog(`${data.player.username} joined the game`);
      get().refreshGameState();
    });

    socket.on('lobby:player_ready', (data) => {
      set({ players: data.players });
    });

    socket.on('lobby:player_left', (data) => {
      get().addToGameLog(`${data.username} left the lobby`);
      set({ players: data.players });
    });

    socket.on('lobby:player_removed', (data) => {
      get().addToGameLog(`${data.removed_player_username} was removed from the lobby`);
      set({ players: data.players });
    });

    socket.on('game:started', () => {
      get().addToGameLog('Game has started!');
      get().refreshGameState();
    });

    socket.on('game:jail_card_used', (data) => {
      get().addToGameLog(`🎴 ${data.username} used a Get Out of Jail Free card and was freed from jail!`);
      get().refreshGameState();
    });

    socket.on('game:reset', () => {
      console.log('Game has been reset - returning to login');
      get().addToGameLog('⚠️ Game has been reset by administrator');
      // Disconnect socket and logout
      socketService.disconnect();
      localStorage.removeItem('token');
      set({
        user: null,
        token: null,
        isSpectator: false,
        isConnected: false,
        game: null,
        players: [],
        myPlayer: null,
        properties: [],
        chatMessages: [],
        gameLog: []
      });
      // Redirect to login will happen automatically when user becomes null
    });
  },

  updateMyTurnStatus: () => {
    const { user, game, players, isSpectator } = get();
    if (!user || !game || !players.length) return;

    // Spectators don't have a player
    if (isSpectator) {
      set({ myPlayer: null, isMyTurn: false });
      return;
    }

    const myPlayer = players.find(p => p.user_id === user.id);
    const isMyTurn = game.current_turn_user_id === user.id;

    set({ myPlayer, isMyTurn });
  },

  refreshGameState: async () => {
    const { token } = get();
    try {
      const response = await fetch(`${API_URL}/api/game`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const gameState = await response.json();
      set({
        game: gameState.game,
        players: gameState.players,
        properties: gameState.properties,
        currentDiceRoll: gameState.currentDiceRoll
      });
      get().updateMyTurnStatus();
    } catch (error) {
      console.error('Failed to refresh game state:', error);
    }
  },

  addToGameLog: (message) => {
    set(state => ({
      gameLog: [...state.gameLog.slice(-50), {
        message,
        timestamp: new Date()
      }]
    }));
  },

  // Game actions (API calls)
  joinGame: async () => {
    const { token } = get();
    try {
      const response = await fetch(`${API_URL}/api/game/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      // Don't add log here - backend will emit player:joined event which logs it
      await get().refreshGameState();
      return data;
    } catch (error) {
      console.error('Join game error:', error);
      throw error;
    }
  },

  rollDice: async () => {
    const { token } = get();

    // Immediately set canRollAgain to false to prevent double-clicking
    set({ canRollAgain: false });

    try {
      const response = await fetch(`${API_URL}/api/game/roll`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // If request failed, reset canRollAgain
        set({ canRollAgain: true });
        throw new Error('Failed to roll dice');
      }

      return await response.json();
    } catch (error) {
      console.error('Roll dice error:', error);
      // Reset canRollAgain on error
      set({ canRollAgain: true });
      throw error;
    }
  },

  buyProperty: async (propertyId) => {
    const { token } = get();
    try {
      const response = await fetch(`${API_URL}/api/game/buy-property`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ propertyId })
      });
      return await response.json();
    } catch (error) {
      console.error('Buy property error:', error);
      throw error;
    }
  },

  buyHouses: async (propertyId, count) => {
    const { token } = get();
    try {
      const response = await fetch(`${API_URL}/api/game/buy-houses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ propertyId, count })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to buy houses');
      }
      return data;
    } catch (error) {
      console.error('Buy houses error:', error);
      throw error;
    }
  },

  endTurn: async () => {
    const { token } = get();
    try {
      const response = await fetch(`${API_URL}/api/game/end-turn`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return await response.json();
    } catch (error) {
      console.error('End turn error:', error);
      throw error;
    }
  },

  toggleReady: async () => {
    const { token } = get();
    try {
      const response = await fetch(`${API_URL}/api/game/ready`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to toggle ready');
      return await response.json();
    } catch (error) {
      console.error('Toggle ready error:', error);
      throw error;
    }
  },

  startGame: async () => {
    const { token } = get();
    try {
      const response = await fetch(`${API_URL}/api/game/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to start game');
      }
      return await response.json();
    } catch (error) {
      console.error('Start game error:', error);
      throw error;
    }
  },

  leaveLobby: async () => {
    const { token } = get();
    try {
      const response = await fetch(`${API_URL}/api/game/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to leave lobby');
      }
      // Clear game state and disconnect
      socketService.disconnect();
      set({
        game: null,
        players: [],
        myPlayer: null,
        isConnected: false
      });
      return await response.json();
    } catch (error) {
      console.error('Leave lobby error:', error);
      throw error;
    }
  },

  removePlayer: async (playerId) => {
    const { token } = get();
    try {
      const response = await fetch(`${API_URL}/api/game/remove-player`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerId })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to remove player');
      }
      return await response.json();
    } catch (error) {
      console.error('Remove player error:', error);
      throw error;
    }
  },

  sendChatMessage: async (message) => {
    const { token } = get();
    try {
      await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      });
    } catch (error) {
      console.error('Send message error:', error);
    }
  },

  fetchChatMessages: async () => {
    const { token } = get();
    try {
      const response = await fetch(`${API_URL}/api/chat/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const messages = await response.json();
      set({ chatMessages: messages });
    } catch (error) {
      console.error('Fetch chat messages error:', error);
    }
  },

  // Initialize from localStorage
  initialize: async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await fetch(`${API_URL}/api/auth/verify`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          set({ user: data.user, token });
          get().connectSocket();
          await get().fetchChatMessages();
        } else {
          localStorage.removeItem('token');
        }
      } catch {
        localStorage.removeItem('token');
      }
    }
  },
}));

export default useGameStore;
