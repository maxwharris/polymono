// The one socket.io connection. The store owns it (see store/gameStore.js): it connects with the JWT,
// registers its handlers, and reconnects forever. The client never emits; all actions go over HTTP.
import { io } from 'socket.io-client';
import { API_URL } from '../lib/api';

let socket = null;

/** Opens a fresh connection with `handlers` ({ eventName: fn }), closing any previous one. */
export function connectSocket(token, handlers = {}) {
  disconnectSocket();
  const options = {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000
  };
  socket = API_URL ? io(API_URL, options) : io(options);
  for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler);
  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

// A phone that slept may hold a dead connection or have paused its retries: nudge it.
export function wakeSocket() {
  if (socket && !socket.connected) socket.connect();
}

// A new token for this session (password changed): later reconnects must not present the old one.
export function setSocketToken(token) {
  if (socket) socket.auth = { token };
}

export function isSocketConnected() {
  return !!socket?.connected;
}

// Backwards-compatible object for older components (prefer the store).
export default {
  connect: connectSocket,
  disconnect: disconnectSocket,
  on(event, handler) {
    socket?.on(event, handler);
  },
  off(event, handler) {
    socket?.off(event, handler);
  },
  emit(event, data) {
    socket?.emit(event, data);
  },
  get socket() {
    return socket;
  }
};
