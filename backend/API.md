# Polymono API and realtime contract

The server is authoritative. Every mutating action runs one at a time inside a database transaction,
then the server broadcasts a full `game:state` snapshot and the `game:events` it produced. Clients render
from the latest snapshot (highest `game.version`) and use events only for the log, toasts and animation.

All `/api` routes except `/api/auth/login`, `/api/auth/spectate` and `/api/health` need
`Authorization: Bearer <jwt>`. Errors are `{ message }` with 400 (rule violation), 401 (bad/expired token),
403 (not allowed: spectator, not host, not admin), 404, 409 (wrong phase / not your turn) or 500.
Spectator tokens (`{ id: 0, isSpectator: true }`) can read everything and write nothing.

## Game state

`GET /api/game` and the `game:state` socket event return:

```js
{
  game: {
    id, status,                 // 'lobby' | 'in_progress' | 'completed'
    version,                    // increments on every change; ignore snapshots older than the one you have
    current_turn_user_id, turn_deadline, started_at, completed_at, winner_user_id,
    settings: { starting_money, go_salary, turn_hours },   // turn_hours 0 = no turn timer
    turn_state: {
      phase,                    // 'roll' | 'buy' | 'debt' | 'end'  (what the current player must do next)
      rolled,                   // has rolled at least once this turn
      doubles,                  // consecutive doubles this turn
      lastRoll,                 // { die1, die2, total, isDoubles } | null
      pendingPropertyId,        // phase 'buy': the unowned property they landed on
      debts,                    // phase 'debt': [{ creditorId (player id) | null (bank), amount, reason }]
      actions: {                // for the current player, computed by the server: render buttons from this
        roll, buy, decline, payFine, useCard, payDebts, bankrupt, endTurn,   // each { ok: true } | { ok: false, reason }
      },
    },
  },
  players: [{                   // ordered by turn_order
    id, user_id, username, token_type, player_color, turn_order,
    money, position, is_in_jail, jail_turns, get_out_of_jail_cards, is_bankrupt, ready_to_start,
  }],
  properties: [{                // the 28 purchasable spaces, ordered by position_on_board
    id, name, property_type,    // 'property' | 'railroad' | 'utility'
    color_group, position_on_board, purchase_price, rent_values, house_cost, mortgage_value,
    owner_id,                   // players.id | null
    is_mortgaged, house_count,  // 0-4 houses, 5 = hotel
    current_rent,               // what landing here costs right now (utilities: multiplier, e.g. 4 or 10)
    management,                 // owned properties only, from the owner's point of view; null when unowned:
                                // { build, sell, mortgage, unmortgage: null (allowed) | 'reason it is not', unmortgageCost }
  }],
  supply: { houses, hotels },   // buildings left in the bank (32 / 12 at start)
  serverTime,                   // ISO string, for turn countdowns
}
```

Phases, for the current player:

| phase | allowed |
|---|---|
| `roll` | roll; in jail and not yet rolled: also pay-fine, use-card |
| `buy` | buy (if money >= price) or decline |
| `debt` | raise money (sell houses, mortgage, trade), then pay-debts; or declare bankruptcy. While in debt a player can't trade away cash or jail cards, and properties only for at least their mortgage value |
| `end` | end-turn |
| `over` | (game completed) |

Building, selling, mortgaging and unmortgaging are allowed for any active player at any time while the
game is in progress. Trades too.

## Game actions (`POST /api/game/...`, body JSON)

| route | body | notes |
|---|---|---|
| `roll` | | phase `roll` |
| `buy` | | phase `buy` |
| `decline` | | phase `buy`; the property stays with the bank |
| `pay-fine` | | in jail, phase `roll`, not rolled yet; $50; then roll normally |
| `use-card` | | same, with a Get Out of Jail Free card |
| `pay-debts` | | phase `debt`, money >= total owed |
| `bankrupt` | | phase `debt`; assets go to the creditor (one player creditor) or the bank |
| `end-turn` | | phase `end` |
| `build` | `{ propertyId }` | one house (or the hotel) at a time, even-build rule, bank supply |
| `sell-building` | `{ propertyId }` | half the house cost back, even-sell rule |
| `mortgage` | `{ propertyId }` | no buildings anywhere in its color group |
| `unmortgage` | `{ propertyId }` | mortgage value + 10% |

Each returns `{ ok: true, state, events }` (the same snapshot and events that are broadcast); `roll` also returns
`{ roll }`.

Lobby: `POST /api/game/join`, `ready`, `leave`, `start` (host = lowest turn_order, everyone ready, 2-6
players), `remove-player { playerId }` (host). `POST /api/game/new` starts a fresh lobby after a game is
`completed`.

`GET /api/game/log?limit=100&before=<id>` returns persisted events, oldest first (same shape as below).

## Events

`game:events` carries `{ version, events: [event] }`. An event:

```js
{ id, type, player_id, user_id, username, data, text, timestamp }
```

`text` is a ready-to-show log line, or null for animation-only events (the teleport `move` into jail).
Types and their `data`:

- `turn` `{ deadline }`, `turn_skipped` `{ reason: 'timeout' }`
- `roll` `{ die1, die2, total, isDoubles }`
- `move` `{ from, to, steps, passedGo, kind }` with kind `'roll' | 'card' | 'back' | 'jail'`. Animate
  `'roll'`, `'card'` and `'back'` space by space (`steps` is negative for `'back'`); `'jail'` is a teleport.
- `salary` `{ amount }` (passed or landed on GO)
- `buy` `{ propertyId, price }`, `decline` `{ propertyId }`
- `rent` `{ propertyId, amount, ownerId, ownerUserId }`
- `tax` `{ amount, kind }` (jail fines are `jail_release` with `{ method: 'fine' | 'forced_fine', amount }`)
- `card` `{ deck: 'chance' | 'community', cardType, cardText }`
- `money` `{ amount, reason }` (card payouts and charges; negative = paid)
- `jail` `{ reason: 'go_to_jail' | 'three_doubles' | 'card' }`, `jail_release` `{ method: 'doubles' | 'fine' | 'card' | 'forced_fine' }`,
  `jail_stay` `{ attempt }`
- `build` / `sell_building` `{ propertyId, houseCount, amount }`, `mortgage` / `unmortgage` `{ propertyId, amount }`
- `debt` `{ amount, creditorIds, reason, totalOwed }`, `debts_paid` `{ amount, payments: [{ creditorId, creditorUserId, amount, reason }] }` (creditor null = bank)
- `bankrupt` `{ creditorId }`, `game_over` `{ winnerUserId }`
- `join`, `leave`, `ready` `{ ready }`, `start`, `removed`, `reset`
- `trade_offer` / `trade_accepted` (logged as the accepting player's action) / `trade_rejected` / `trade_countered`
  `{ tradeId, proposerId, recipientId, proposerUserId, recipientUserId }`
- `decline` with `{ timeout: true }` and `turn_skipped` when the turn timer runs out. A player in debt gets one
  more turn period, then is declared bankrupt.

## Trades (`/api/trade`)

- `GET /api/trade` → `{ active: [trade], history: [trade] }`: pending trades involving me, and my last 20
  closed ones. No side effects.
- `POST /api/trade` `{ recipientPlayerId, offeredProperties, offeredMoney, offeredJailCards, requestedProperties, requestedMoney, requestedJailCards }`
  Integers >= 0, unique property ids, both sides must own what they put in, no buildings anywhere in a
  traded property's color group, no mortgaged properties.
- `POST /api/trade/:id/accept` (recipient), `/reject` (recipient), `DELETE /api/trade/:id` (proposer).
- `POST /api/trade/:id/counter` (recipient), same body as create minus `recipientPlayerId`, written from
  the counterer's side (offered = what I give). Marks the original `countered` and creates a new pending
  trade from me to the original proposer with `countered_from` set.

A trade row: `{ id, status, proposer_id, recipient_id, proposer_user_id, recipient_user_id, proposer_username,
recipient_username, offered_properties, offered_money, offered_jail_cards, requested_properties,
requested_money, requested_jail_cards, countered_from, created_at, updated_at }`. Status is
`pending | accepted | rejected | cancelled | countered | expired`. Trades that become impossible (an
ownership change) are expired when anything changes hands.

## Auth and admin

- `POST /api/auth/login { username, password }` → `{ token, user: { id, username, tokenType, isAdmin } }`. Tokens last
  30 days. Usernames are case-insensitive. 10 failed attempts lock a username for 15 minutes (429).
- `POST /api/auth/spectate` → `{ token, user: { id: 0, username: 'Spectator', tokenType: 'spectator', isSpectator: true } }`
- `GET /api/auth/verify` → `{ valid, user }` (same user shape as login).
- `POST /api/auth/password { currentPassword, newPassword }` (6+ characters) → `{ message, token }`: a fresh token
  for this session; every older token (other devices) stops working. An admin password reset or deleting the
  user also revokes their tokens.
- Admin only (usernames in `ADMIN_USERS`; none configured = no admins): `GET /api/auth/users`, `POST /api/auth/register
  { username, password, tokenType }`, `DELETE /api/auth/users/:id`, `POST /api/admin/users/:id/password
  { newPassword }`, `POST /api/admin/reset-game`, `PATCH /api/admin/settings { turn_hours }`.
- Token types: `taxi`, `pigeon`, `rat`, `subway`, `bull`, `empire` (the 3D models in `frontend/public/tokens`).

## Socket.io

Connect with `io(url, { auth: { token } })`. The server rejects connections without a valid token
(`connect_error` with message `unauthorized`). On connect the server sends `game:state` and `presence`.

Server → client: `game:state`, `game:events`, `presence { online: [userId] }`, `chat:message`,
and `trade:changed { tradeId, status, proposerUserId, recipientUserId }`, sent only to the two players in
the trade (refetch `/api/trade`).
The client sends nothing; all actions go through HTTP.

`GET /api/health` → `{ ok, properties }` (500 if the database is unreachable or unseeded).
