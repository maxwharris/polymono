/**
 * Client state for Polymono. The server is authoritative (backend/API.md): this store holds the latest
 * snapshot (highest game.version), the event log, presence, chat and trade counts, plus a little UI state.
 *
 * Components must subscribe with selectors (useGameStore(s => s.x) or useShallow) so chat and log updates
 * don't re-render the 3D board.
 */
import { create } from 'zustand';
import { api, onUnauthorized, setApiToken } from '../lib/api';
import { connectSocket, disconnectSocket, isSocketConnected, setSocketToken, wakeSocket } from '../services/socket';
import { readId, readItem, readJSON, removeItem, writeItem, writeJSON } from '../lib/storage';
import { presentEvent } from '../lib/presenter';
import { unseenEvents } from '../lib/events';
import { isSoundEnabled, playSound, setSoundEnabled, unlockAudio } from '../lib/sound';

const LOG_LIMIT = 200;
const LOG_PAGE = 500; // the server's maximum page, for paging back
const MAX_BACKFILL = 2000; // how far a load or resync pages back to close a gap in the log
const MAX_EVENTS = 5000;
const MAX_TOASTS = 5;
const AWAY_MS = 10 * 60 * 1000; // hidden this long counts as "away": show the digest on return
const DIGEST_MIN_EVENTS = 3;
const TOAST_TTL = { info: 4500, success: 4500, warn: 6500, error: 8000 };

const TOKEN_KEY = 'token';
const USER_KEY = 'polymono:user';
const lastSeenKey = userId => `polymono:lastSeen:${userId}`;
const chatReadKey = userId => `polymono:chatRead:${userId}`;

// Everything that belongs to one login. logout() resets to this.
const sessionDefaults = () => ({
  user: null,
  token: null,
  isSpectator: false,
  connected: false,

  game: null,
  players: [],
  properties: [],
  supply: null,
  serverOffsetMs: 0, // server clock minus ours, for turn countdowns

  events: [], // every known event, ascending by id, deduped
  eventsLoaded: false,
  hasOlderEvents: false,
  seenMarkerId: null, // events after this id are "new since your last visit"
  awayDigestSince: null, // set when there is enough news to show the "while you were away" digest

  presence: [], // online user ids
  chatMessages: [],
  chatReadId: 0,

  trades: { active: [], history: [] },
  tradeVersion: 0,
  incomingTradeCount: 0,
  tradeOpen: false,
  tradeOptions: null,

  animating: false, // the Board sets this while dice/token animations run
  selectedPosition: null, // the space shown in the property sheet
  sheet: null, // null (board) | 'players' | 'side' | 'mine': the panel open over the board on phones
  sideTab: 'activity', // 'activity' | 'chat'
  playerSheetId: null, // player whose holdings are shown
  cardModal: null, // { id, deck, text } for a card I drew
  resultsHidden: false, // the game-over screen was closed to look at the final board
  pendingAction: null // 'roll', 'build:12', ... while the request is in flight
});

// Module state that is not rendered.
let toastSeq = 0;
let tradeSeq = 0;
let initPromise = null;
let resyncPromise = null;
let connectedBefore = false;
let loadPending = false; // loadAll() is running
let hiddenAt = null;
let awaySince = null; // lastSeen when the player came back (or the first load failed): the digest starts there

// ---- helpers ------------------------------------------------------------------------------------------

function isVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/** Merge events by id, ascending. A 'reset' (new game) wipes the server log, so drop what came before it. */
function mergeEvents(existing, incoming) {
  if (!incoming?.length) return existing;
  const byId = new Map(existing.map(e => [e.id, e]));
  let changed = false;
  for (const e of incoming) {
    if (e && e.id != null && !byId.has(e.id)) {
      byId.set(e.id, e);
      changed = true;
    }
  }
  if (!changed) return existing;
  let merged = [...byId.values()].sort((a, b) => a.id - b.id);
  let reset = -1;
  for (let i = merged.length - 1; i >= 0; i--) {
    if (merged[i].type === 'reset') {
      reset = i;
      break;
    }
  }
  if (reset > 0) merged = merged.slice(reset);
  if (merged.length > MAX_EVENTS) merged = merged.slice(merged.length - MAX_EVENTS);
  return merged;
}

/**
 * The newest events, paging back (bounded) until they reach `untilId`, so nothing between that event and now
 * is missing. Resolves to { log, more }: `more` = the server has older events than the first one returned.
 */
async function fetchLog(untilId) {
  const first = await api(`/game/log?limit=${LOG_LIMIT}`);
  let log = Array.isArray(first) ? first : [];
  let more = log.length >= LOG_LIMIT;
  while (more && untilId != null && log[0].id > untilId + 1 && log.length < MAX_BACKFILL) {
    const older = await api(`/game/log?limit=${LOG_PAGE}&before=${log[0].id}`);
    const page = Array.isArray(older) ? older : [];
    more = page.length >= LOG_PAGE;
    log = [...page, ...log];
  }
  return { log, more };
}

function appendChat(messages, message) {
  if (!message || messages.some(m => m.id === message.id)) return messages;
  return [...messages, message];
}

// Union by id, oldest first (a resync may overlap messages that arrived live).
function mergeChat(messages, fetched) {
  if (!Array.isArray(fetched) || !fetched.length) return messages;
  const byId = new Map(messages.map(m => [m.id, m]));
  for (const m of fetched) if (m && m.id != null) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function countIncoming(trades, userId) {
  return (trades.active || []).filter(t => t.status === 'pending' && t.recipient_user_id === userId).length;
}

function actionKey(route, body) {
  return body?.propertyId != null ? `${route}:${body.propertyId}` : route;
}

// ---- selectors ----------------------------------------------------------------------------------------

export function selectMyPlayer(state) {
  if (!state.user || state.isSpectator) return null;
  return state.players.find(p => p.user_id === state.user.id) ?? null;
}

export function selectCurrentPlayer(state) {
  const id = state.game?.current_turn_user_id;
  if (id == null) return null;
  return state.players.find(p => p.user_id === id) ?? null;
}

export function selectIsMyTurn(state) {
  return !!state.user && !state.isSpectator && state.game?.status === 'in_progress' &&
    state.game.current_turn_user_id === state.user.id;
}

export function selectTurnState(state) {
  return state.game?.turn_state ?? null;
}

// ---- store --------------------------------------------------------------------------------------------

const useGameStore = create((set, get) => {
  /** Apply a full snapshot unless it is older than the one we hold. */
  function applyState(state) {
    if (!state?.game) return;
    const held = get().game;
    if (held && Number(state.game.version) < Number(held.version)) return;

    const patch = {
      game: state.game,
      players: Array.isArray(state.players) ? state.players : [],
      properties: Array.isArray(state.properties) ? state.properties : [],
      supply: state.supply ?? null
    };
    const serverTime = Date.parse(state.serverTime);
    if (Number.isFinite(serverTime)) patch.serverOffsetMs = serverTime - Date.now();

    // Open "My properties" when I fall into debt, so I can raise the money.
    const { user, isSpectator } = get();
    const phase = state.game.turn_state?.phase;
    const myTurn = user && !isSpectator && state.game.status === 'in_progress' && state.game.current_turn_user_id === user.id;
    const wasInDebt = held?.current_turn_user_id === user?.id && held?.turn_state?.phase === 'debt';
    if (myTurn && phase === 'debt' && !wasInDebt) patch.sheet = 'mine';

    if (state.game.status !== 'in_progress' && held?.status === 'in_progress') {
      patch.cardModal = null;
      patch.sheet = null;
      patch.tradeOpen = false;
    }
    if (state.game.status !== held?.status) patch.resultsHidden = false;
    // A new lobby, a start or an admin reset: nothing from the previous game carries over. The server cancels
    // or deletes trades then without a trade:changed, so refetch them.
    const statusChanged = !!held && state.game.status !== held.status;
    if (statusChanged) {
      patch.selectedPosition = null;
      patch.playerSheetId = null;
      patch.awayDigestSince = null;
      patch.seenMarkerId = null;
    }
    set(patch);
    if (statusChanged) {
      set(s => ({ tradeVersion: s.tradeVersion + 1 }));
      get().refreshTrades({ quiet: true });
    }
  }

  // Remember the newest event as seen, while someone is looking. Not before the log has loaded: the load
  // reads the previous value to work out what is new.
  function persistSeen() {
    const { user, events, eventsLoaded } = get();
    if (!user || !eventsLoaded || !events.length || !isVisible()) return;
    const last = events[events.length - 1].id;
    if ((readId(lastSeenKey(user.id)) || 0) < last) writeItem(lastSeenKey(user.id), last);
  }

  function present(events) {
    const s = get();
    if (!s.user) return;
    const me = selectMyPlayer(s);
    const ctx = { userId: s.isSpectator ? 0 : s.user.id, myPlayerId: me?.id ?? null, players: s.players, properties: s.properties };
    const visible = isVisible();
    for (const event of events) {
      const out = presentEvent(event, ctx);
      if (!out) continue;
      if (out.card) set({ cardModal: out.card });
      if (out.sound) playSound(out.sound, { background: out.sound === 'turn' });
      if (out.toast && (visible || out.toast.ttl === null)) {
        const { tradeId, ...toast } = out.toast;
        if (tradeId) toast.action = { label: 'View', run: () => get().openTrade({ tradeId }) };
        s.toast(toast);
      }
    }
  }

  function receiveEvents(incoming, { live }) {
    const prev = get().events;
    const known = new Set(prev.map(e => e.id));
    const fresh = (incoming || []).filter(e => e && !known.has(e.id));
    if (!fresh.length) return;
    set({ events: mergeEvents(prev, fresh) });
    persistSeen();
    if (live) present(fresh);
  }

  /**
   * The response to my own action (POST /game/*, /trade/*): its state, and its events if it carries them. The
   * events normally come over the socket; if the socket is down they would be lost (and with them my card,
   * rent and jail notices), so fetch them. Ids dedupe, so nothing is presented twice.
   */
  function applyResult(res) {
    if (res?.state) applyState(res.state);
    if (Array.isArray(res?.events)) receiveEvents(res.events, { live: true });
    else if (res?.state && !isSocketConnected() && get().eventsLoaded) fetchMissedEvents();
  }

  async function fetchMissedEvents() {
    const { token } = get();
    try {
      const log = await api('/game/log?limit=50');
      if (get().token === token && Array.isArray(log)) receiveEvents(log, { live: true });
    } catch {
      // the reconnect's resync brings them into the log
    }
  }

  function openSocket(token) {
    connectedBefore = false;
    connectSocket(token, {
      connect: () => {
        set({ connected: true });
        // The first connect follows a full HTTP load; later ones may have missed events. If that first load
        // already finished without the log (the server was restarting), retry it now that the server is up.
        if (connectedBefore || (!loadPending && !get().eventsLoaded)) get().resync();
        connectedBefore = true;
      },
      disconnect: () => set({ connected: false }),
      connect_error: (err) => {
        set({ connected: false });
        if (err?.message === 'unauthorized') get().logout({ expired: true });
      },
      'game:state': applyState,
      'game:events': payload => receiveEvents(payload?.events, { live: true }),
      presence: payload => set({ presence: Array.isArray(payload?.online) ? payload.online : [] }),
      'chat:message': message => set(s => ({ chatMessages: appendChat(s.chatMessages, message) })),
      'trade:changed': () => {
        set(s => ({ tradeVersion: s.tradeVersion + 1 }));
        get().refreshTrades();
      }
    });
  }

  function reportFailures(results, title) {
    const failed = results.find(r => r.status === 'rejected' && r.reason?.status !== 401);
    if (failed) get().toast({ tone: 'error', title, body: failed.reason?.message });
  }

  /** Everything a fresh session needs, in parallel. Never throws. */
  async function loadAll() {
    const { user } = get();
    if (!user) return;
    // Read before anything can move it (persistSeen waits for the log): the digest covers what came after.
    const lastSeen = readId(lastSeenKey(user.id));
    loadPending = true;
    let results;
    try {
      results = await Promise.allSettled([
        api('/game'),
        fetchLog(lastSeen),
        api('/chat/messages?limit=100')
      ]);
    } finally {
      loadPending = false;
    }
    if (!get().token || get().user !== user) return; // logged out, or another session, meanwhile
    const [stateR, logR, chatR] = results;

    if (stateR.status === 'fulfilled') applyState(stateR.value);
    if (logR.status === 'fulfilled') {
      const { log, more } = logR.value;
      const events = mergeEvents(get().events, log);
      const unseen = unseenEvents(events, lastSeen, user.id);
      set({
        events,
        eventsLoaded: true,
        hasOlderEvents: more,
        seenMarkerId: lastSeen,
        awayDigestSince: unseen.length >= DIGEST_MIN_EVENTS ? lastSeen : null
      });
      persistSeen();
    } else {
      awaySince = lastSeen; // the resync that gets the log shows the digest
    }
    if (chatR.status === 'fulfilled' && Array.isArray(chatR.value)) {
      const messages = chatR.value;
      const stored = readId(chatReadKey(user.id));
      set(s => ({ chatMessages: mergeChat(s.chatMessages, messages), chatReadId: stored ?? messages[messages.length - 1]?.id ?? 0 }));
    }
    reportFailures(results, 'Could not load the game');
    get().refreshTrades();
    // The socket's first connect doesn't resync while this runs. If part of the load failed and the socket
    // is up anyway, the server is back: catch up now rather than at the next tab switch.
    if (results.some(r => r.status === 'rejected') && isSocketConnected()) get().resync();
  }

  async function startSession(token, user) {
    writeItem(TOKEN_KEY, token);
    writeJSON(USER_KEY, user);
    setApiToken(token);
    awaySince = null;
    set({ ...sessionDefaults(), user, token, isSpectator: !!user?.isSpectator, ready: true });
    openSocket(token);
    await loadAll();
  }

  /** The saved token → a session: verify it, or carry on with the cached user if the server is unreachable. */
  async function restoreSession() {
    const token = readItem(TOKEN_KEY);
    if (!token) {
      set({ ready: true });
      return;
    }
    try {
      const data = await api('/auth/verify', { token });
      await startSession(token, data.user);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        // api() already logged out on 401; make sure the stale token is gone either way
        removeItem(TOKEN_KEY);
        removeItem(USER_KEY);
        set({ ready: true });
        return;
      }
      // Server unreachable: carry on with the cached user; the socket keeps retrying and resyncs.
      const cached = readJSON(USER_KEY);
      if (cached) {
        await startSession(token, cached);
      } else {
        set({ ready: true });
        get().toast({ tone: 'error', title: 'Cannot reach the server', body: err.message });
      }
    }
  }

  /**
   * Shows "while you were away" from the lastSeen recorded when the player came back (awaySince), once a
   * resync has the log. A resync that was already running, or one that failed, doesn't lose it.
   */
  function showAwayDigest() {
    const { user, events } = get();
    if (awaySince == null || !user) return;
    const since = awaySince;
    awaySince = null;
    const patch = { seenMarkerId: since };
    if (unseenEvents(events, since, user.id).length >= DIGEST_MIN_EVENTS) patch.awayDigestSince = since;
    set(patch);
  }

  /** Refetch the state, the recent log (closing any gap) and the chat. Resolves true if the log loaded. */
  async function catchUp() {
    const { user, events: held } = get();
    const newestHeld = held.length ? held[held.length - 1].id : null;
    const reach = [newestHeld, awaySince].filter(id => id != null);
    const results = await Promise.allSettled([
      api('/game'),
      fetchLog(reach.length ? Math.min(...reach) : null),
      api('/chat/messages?limit=100') // messages sent while a phone slept
    ]);
    if (!get().token || get().user !== user) return false;
    const [stateR, logR, chatR] = results;
    if (chatR.status === 'fulfilled') set(s => ({ chatMessages: mergeChat(s.chatMessages, chatR.value) }));
    if (stateR.status === 'fulfilled') applyState(stateR.value);
    let loaded = false;
    if (logR.status === 'fulfilled') {
      const { log, more } = logR.value;
      const current = get().events;
      // Away so long that paging back didn't reach what we hold: drop the old events instead of leaving a
      // hidden hole in the feed ("load older" pages back from the new first event).
      const gap = more && newestHeld != null && log.length > 0 && log[0].id > newestHeld + 1;
      const events = gap ? mergeEvents(current.filter(e => e.id >= log[0].id), log) : mergeEvents(current, log);
      const patch = { events, eventsLoaded: true };
      if (gap || !get().eventsLoaded) patch.hasOlderEvents = more;
      set(patch);
      persistSeen();
      loaded = true;
    }
    reportFailures(results, 'Could not refresh the game');
    // trade:changed may have been missed while disconnected: an open trade window refetches too
    set(s => ({ tradeVersion: s.tradeVersion + 1 }));
    get().refreshTrades({ quiet: true });
    return loaded;
  }

  // Only a 401 for this session's own token ends it (not one for a token a password change just replaced).
  onUnauthorized((token) => {
    if (get().token && get().token === token) get().logout({ expired: true });
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!get().token) return;
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt != null && Date.now() - hiddenAt >= AWAY_MS;
      hiddenAt = null;
      wakeSocket();
      get().resync({ away });
    });
    window.addEventListener('online', () => {
      if (!get().token) return;
      wakeSocket();
      get().resync();
    });
    // Another tab logged out, logged in (maybe as someone else) or changed the password: follow it, so this
    // tab never shows one player while acting as another.
    window.addEventListener('storage', (event) => {
      if (event.key !== TOKEN_KEY && event.key !== null) return; // null: storage was cleared
      if (!get().ready) return; // still initializing: it reads storage itself
      const stored = readItem(TOKEN_KEY);
      const { token } = get();
      if (stored === token) return;
      if (!stored) {
        if (!token) return;
        get().logout();
        get().toast({ tone: 'info', title: 'You logged out in another tab' });
        return;
      }
      disconnectSocket();
      setApiToken(null);
      set({ ...sessionDefaults(), ready: false });
      restoreSession();
    });
  }

  return {
    ...sessionDefaults(),
    ready: false, // initialize() finished: false shows the splash instead of flashing the login form
    toasts: [],
    soundOn: isSoundEnabled(),

    // ---- session --------------------------------------------------------------------------------------

    initialize: () => {
      if (!initPromise) initPromise = restoreSession();
      return initPromise;
    },

    login: async (username, password) => {
      const data = await api('/auth/login', { method: 'POST', body: { username, password }, token: null });
      await startSession(data.token, data.user);
      return data.user;
    },

    spectate: async () => {
      const data = await api('/auth/spectate', { method: 'POST', token: null });
      await startSession(data.token, { ...data.user, isSpectator: true });
      return data.user;
    },

    // Also usable directly as an onClick handler (the event argument is ignored).
    logout: (options) => {
      const expired = !!options?.expired;
      disconnectSocket();
      setApiToken(null);
      connectedBefore = false;
      awaySince = null;
      removeItem(TOKEN_KEY);
      removeItem(USER_KEY);
      set({ ...sessionDefaults(), ready: true, toasts: [] });
      if (expired) get().toast({ tone: 'warn', title: 'Session expired', body: 'Log in again to keep playing.' });
    },

    changePassword: async (currentPassword, newPassword) => {
      const data = await api('/auth/password', { method: 'POST', body: { currentPassword, newPassword }, logoutOn401: false });
      // Every older token (other devices too) stops working; this session carries on with the fresh one.
      if (data?.token && get().token) {
        writeItem(TOKEN_KEY, data.token);
        setApiToken(data.token);
        setSocketToken(data.token);
        set({ token: data.token });
      }
      get().toast({ tone: 'success', title: 'Password changed', body: 'Other devices will need to log in again.' });
      return data;
    },

    // ---- game ---------------------------------------------------------------------------------------

    /** POST /api/game/<route>. Applies the returned state; on failure shows a toast and rethrows. */
    act: async (route, body) => {
      const key = actionKey(route, body);
      set({ pendingAction: key });
      try {
        const res = await api(`/game/${route}`, { method: 'POST', body });
        applyResult(res);
        return res;
      } catch (err) {
        if (err.status !== 401) get().toast({ tone: 'error', title: err.message || 'That did not work' });
        if (err.status === 409) get().resync(); // the game moved on without us
        throw err;
      } finally {
        if (get().pendingAction === key) set({ pendingAction: null });
      }
    },

    /** The result of a trade call made outside act() (the trade window): same handling as act(). */
    applyActionResult: (res) => applyResult(res),

    /**
     * Refetch the state and recent events (after a reconnect or when the app becomes visible). away: the
     * player was gone a while, so show what happened since (also when a resync was already running).
     */
    resync: ({ away = false } = {}) => {
      const { token, user } = get();
      if (!token) return Promise.resolve();
      if (away && awaySince == null) awaySince = readId(lastSeenKey(user?.id));
      if (!resyncPromise) {
        resyncPromise = catchUp().finally(() => {
          resyncPromise = null;
        });
      }
      return resyncPromise.then(loaded => {
        if (loaded) showAwayDigest();
      });
    },

    loadOlderEvents: async () => {
      const oldest = get().events[0]?.id;
      if (!oldest) return;
      try {
        const log = await api(`/game/log?limit=${LOG_LIMIT}&before=${oldest}`);
        const list = Array.isArray(log) ? log : [];
        set(s => ({ events: mergeEvents(s.events, list), hasOlderEvents: list.length >= LOG_LIMIT }));
      } catch (err) {
        if (err.status !== 401) get().toast({ tone: 'error', title: 'Could not load earlier events', body: err.message });
      }
    },

    /**
     * Every event older than the ones held (bounded), without storing them: the results screen needs the
     * whole game, and after a reload the store keeps only the recent part. Throws if a page fails.
     */
    fetchOlderLog: async () => {
      const { events, hasOlderEvents } = get();
      let older = [];
      let more = hasOlderEvents;
      for (let pages = 0; more && events.length && pages < 40; pages++) {
        const page = await api(`/game/log?limit=${LOG_PAGE}&before=${(older[0] ?? events[0]).id}`);
        const list = Array.isArray(page) ? page : [];
        more = list.length >= LOG_PAGE;
        older = [...list, ...older];
      }
      return older;
    },

    setAnimating: (animating) => set({ animating: !!animating }),

    // ---- toasts -------------------------------------------------------------------------------------

    /** { tone: 'info'|'success'|'error'|'warn', title, body?, icon?, action?: { label, run }, ttl? (ms, null = sticky) } */
    toast: ({ tone = 'info', title, body, icon, action, ttl } = {}) => {
      const id = ++toastSeq;
      const entry = { id, tone, title, body, icon, action, ttl: ttl === undefined ? (TOAST_TTL[tone] ?? 5000) : ttl };
      set(s => ({ toasts: [...s.toasts, entry].slice(-MAX_TOASTS) }));
      return id;
    },

    dismissToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

    // ---- chat ---------------------------------------------------------------------------------------

    /** Sends a chat message. Throws on failure (Chat shows the error inline). */
    sendChat: async (message) => {
      if (get().isSpectator) throw new Error('Spectators can read the chat but not post');
      const sent = await api('/chat/send', { method: 'POST', body: { message } });
      set(s => ({ chatMessages: appendChat(s.chatMessages, sent) }));
      return sent;
    },

    fetchChat: async () => {
      try {
        const messages = await api('/chat/messages?limit=100');
        if (Array.isArray(messages)) set({ chatMessages: messages });
        return messages;
      } catch (err) {
        if (err.status !== 401) get().toast({ tone: 'error', title: 'Could not load the chat', body: err.message });
        throw err;
      }
    },

    markChatRead: () => {
      const { chatMessages, chatReadId, user } = get();
      const last = chatMessages[chatMessages.length - 1]?.id || 0;
      if (last <= chatReadId) return;
      set({ chatReadId: last });
      if (user) writeItem(chatReadKey(user.id), last);
    },

    // ---- trades -------------------------------------------------------------------------------------

    // quiet: no error toast (resync already reports when the server is unreachable). Only the newest
    // request's answer counts: an older one arriving late would bring back a stale badge.
    refreshTrades: async ({ quiet = false } = {}) => {
      const { token, isSpectator, user } = get();
      if (!token || isSpectator || !user) return;
      const seq = ++tradeSeq;
      try {
        const trades = await api('/trade');
        if (get().token !== token || seq !== tradeSeq) return;
        const safe = { active: trades?.active || [], history: trades?.history || [] };
        set({ trades: safe, incomingTradeCount: countIncoming(safe, user.id) });
      } catch (err) {
        if (seq !== tradeSeq) return;
        if (err.status !== 401 && !quiet) get().toast({ tone: 'error', title: 'Could not load trades', body: err.message });
      }
    },

    // options: { tradeId } (open and highlight an offer), { counterTradeId }, or
    // { recipientPlayerId, requestedProperties: [propertyId] } to start one. Trade.jsx reads them.
    openTrade: (options = null) => set({ tradeOpen: true, tradeOptions: options || null, selectedPosition: null, playerSheetId: null }),
    closeTrade: () => set({ tradeOpen: false, tradeOptions: null }),

    // ---- UI -----------------------------------------------------------------------------------------

    openProperty: (position) => set({ selectedPosition: Number.isInteger(position) ? position : null }),
    closeProperty: () => set({ selectedPosition: null }),

    openSheet: (sheet) => set({ sheet: sheet || null }),
    closeSheet: () => set({ sheet: null }),
    setSideTab: (sideTab) => set({ sideTab }),

    openPlayer: (playerId) => set({ playerSheetId: playerId ?? null }),
    closePlayer: () => set({ playerSheetId: null }),

    dismissCard: () => set({ cardModal: null }),
    showResults: () => set({ resultsHidden: false }),
    hideResults: () => set({ resultsHidden: true }),
    dismissDigest: () => set({ awayDigestSince: null }),

    setSoundOn: (on) => {
      setSoundEnabled(on);
      set({ soundOn: !!on });
      if (on) {
        unlockAudio();
        playSound('gain');
      }
    }
  };
});

export default useGameStore;
