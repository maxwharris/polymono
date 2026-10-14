# Midnight Deco: the shared UI foundation

Manhattan after dark: night lacquer and brass chrome around the bright board. Dark only. The spec is the
design doc (direction C) plus the judge's grafts and must-fix list; this folder is the part every screen shares.

- **See it:** `npm run dev`, open `/specimen` (dev only, not in the build). It renders everything below.
- **Tokens:** `src/index.css` (`:root`). **Classes:** `src/components/ui/ui.css`, all `ui-*`, loaded globally by `main.jsx`.
- **Layers:** `@layer base, components;` is declared first in `index.css`. Element defaults are in `base`, `ui-*` classes in
  `components`, and screen CSS (`game.css`, `*.module.css`) is unlayered, so it overrides both with no specificity fights.
- **Breakpoints** (literal values; custom properties do not work in media queries): phone up to 899px,
  two columns 900–1099px, desktop three columns from 1100px. Test 390×844, 375×667 and 1440×900.

## Rules every screen follows

- **No emoji in the UI.** Icons are `<Icon>`, people are `<Medallion>`. Emoji typed into chat stay.
- **A circle is a person, a bar or swatch is a place.** Medallions only for players; `ui-swatch` and bands only for groups.
- **Every amount** uses `ui-money` (or `.money`/`.num`): Jost 600, tabular lining figures, kerning off. Never Antonio,
  not even inside an Antonio headline (`Raise <span class="ui-money">$120</span> to pay youngeun`).
- **One filled brass button per view** (`ui-btn--primary`). Everything else is secondary, ghost, tint or danger.
- **Turn-panel headlines stay on one line** (`ui-headline`). At 375px the budget is **291px**, or **217px** with dice
  beside it. Measured at 21px: "jack is deciding on Wall Street" 239, "You landed on Tribeca" 172, "One World Trade
  Center" 182, "You landed on One World Trade Center" 297 (too long: put the place in the sub line), "youngeun is
  deciding on Grand Central Station" 366 (too long). The specimen shows both budgets. In the game,
  `FitHeadline` (`game/bits.jsx`) takes the options longest first and shows the first whose headline and sub line
  both fit, measured again on every resize, font load and text change, so the long form comes back when there is room.
- **Blocked actions stay visible and disabled**, with the server's reason in `ui-reason` underneath (4.5:1+).
- **Sentence case**, no all-caps eyebrows, no "A · B · C" strings, no "→" or "=" arithmetic in copy.
- **Touch targets 44px+**, visible brass focus ring (`:focus-visible` is global), inputs 17px (iOS zoom).
- **Reduced motion:** a global rule in `index.css` drops transitions and animations to ~0; `--dur-needle` and
  `--dur-money` are 0. Nothing may rely on an animation finishing.
- **Countdown urgency:** slate normally, `is-soon` (brass) under 3h, `is-urgent` (stop) under 30m. Never blink.
- **Colour never stands alone:** the dial sits beside "jack's turn", swatches beside names, ready with a check and the word.

## Components

| Import | What |
|---|---|
| `Icon` from `components/ui/Icon` | `<Icon name size=24 strokeWidth=1.75 label? className?>`. 24px grid, currentColor. Decorative unless `label` is given (then `role="img"`). Unknown names render nothing. |
| `ICONS`, `ICON_NAMES`, `ICON_ALIASES` from `components/ui/icons` | Drawings: board, players, activity, chat, deed, menu, more, dice, roll, buy, pass, trade, note, house, hotel, bank, bars, card, crown, step, play, pin, star, sparkle, follow, fullscreen, eye, eye-off, clock, history, bell, sound, mute, warning, info, question, refresh, lock, user, user-plus, key, shield, settings, logout, edit, trash, send, close, check, plus, minus, chevron, chevron-up/left/right, arrow-left. Aliases name uses: money/cash/salary/rent/tax/fine → note, jail/rikers → bars, mine/properties → deed, mortgage → bank, build/sell → house, alert → bell, timer → clock, winner/host → crown, back → arrow-left, move → step, spectate/show → eye, hide → eye-off, bankrupt/dismiss → close, admin → shield, password → key, account → user, reconnect → refresh, ready → check, start → play, skip → pass, free-card/opportunity/community → card, here → pin, help → question. |
| `Medallion` (default) from `components/ui/Medallion` | A player's coin: `<Medallion player size=36 current? out? online? label? />`. Takes colour, token and bankrupt state from a game player, or `token` + `color`, or `icon="eye"` for a spectator. Sizes: 22 feed, 28–30 chips, 36 top bar/toasts, 40–44 rows/pickers, 48 desktop panel. `current` = outer brass ring; `online` true/false = presence dot (omit for none). aria-hidden unless `label`. |
| `TokenGlyph` from `components/ui/Medallion` | The bare token silhouette, `<TokenGlyph token size="1em" label? />`, one colour (currentColor). |
| `TurnDial` from `components/ui/TurnDial` | `<TurnDial players currentUserId myUserId size=76 />`: segments in seat order, needle on `game.current_turn_user_id`, brass tick on yours, `role="img"` named "jack's turn. You're up after raymond". Phone 76 lights only the current segment (`tint="current"`, default under 88px); 92 desktop and the 176 login emblem show every colour (`tint="all"`). Bankrupt = dashed segment. `sweep` animates the needle in once (login). With no `players` it is the six-colour emblem; pass `decorative` there. |
| `Wordmark` from `components/ui/Wordmark` | "Polymono" in Antonio, replacing the raster logo. `size` sm 22 / md 26 / lg 36 / xl 60; `sub` adds a line (brass under it, or slate beside a hairline with `inline`); `as="h1"` on the login. |
| `seatOrder`, `turnsUntilMine`, `upNextLine`, `turnName` from `components/ui/turnOrder` | Turn-order text: `upNextLine(players, current, me)` → "You're up next" / "You're up after raymond" / null; `turnName` → "Your turn" / "jack's turn". Bankrupt players are skipped. |
| `Specimen` | Dev-only page at `/specimen` (mounted in `App.jsx` behind `import.meta.env.DEV`). |

### lib changes

- `lib/colors.js`: new `PLAYER_COLORS` (red #FF6B5E, blue #5EA8FF, green #3DD68C, yellow #FFD447, purple #B78CFF,
  orange #FF9640, gray #9AA3B5), all 4.5:1+ as text on lacquer. `playerColor`, `readableInk` unchanged.
- `lib/board.js`: `PROPERTY_COLORS` brown → #9C5B2E and dark blue → #3A5BD9 (lifted to 3:1 on navy). The 3D bands
  (`board/Spaces.jsx`) read the same object, so the board and the UI agree. Stations stay #2B2B2B and rely on the
  swatch ring.
- `lib/tokens.js`: `TOKENS` now hold `{ label, glyph }` (no emoji); `TOKEN_TYPES`, `tokenKey`, `tokenLabel` kept;
  new `tokenGlyph(type)` (path data) and `TOKEN_GLYPH_VIEWBOX`. Label "Subway" is now "Subway car".
  The glyphs were traced from orthographic renders of the six GLB models (taxi, pigeon, rat, Empire State) or drawn
  over them (the subway car on its rail; the bull head-on, because its side view reads as a pig). The rat's pizza slice
  was dropped: at 22px it read as a stick. The old `tokenEmoji()` shim is gone: use `<Medallion>` or `<TokenGlyph>`.
- `lib/events.js`: `EVENT_ICONS` maps every event type to an `<Icon>` name; `eventText(event, { myUserId, players,
  properties })` is the feed sentence, with the viewer's own lines as "You bought Tribeca for $200" and "seabass paid
  you $25 rent for Tribeca" (unknown types keep the server's text).
- `App.jsx`: the splash shows `<Wordmark size="lg">` instead of `/polymono-logo.webp`.

No screen uses emoji or the raster logo any more; keep it that way.

## Tokens (`src/index.css`)

**Room and lacquer**
- `--room` #0A1120: app background, behind everything (also `html`, `body`).
- `--table` #0E1A33 / `--table-edge` #060B16: the board table, centre and edge.
- `--lacquer` #101A2D: top bar, tab bar, turn panel, side columns (theme-color matches).
- `--raised` #172338: sheets, toasts, dialogs, the current player's row, selected segments.
- `--raised-hover` #1D2B45: hover and pressed state of raised controls.
- `--well` #0C1526: inputs, segmented-control track, calm notes.
- `--seam` #24324D: decorative hairlines (never the only edge of a control).
- `--seam-strong` #5C6E94: control outlines, 3.4:1 on lacquer, 3.1:1 on raised.
- `--medal` #16213A: the medallion coin. `--dial-plate` #0D1729: the dial plate. `--scrim`: behind sheets and dialogs.

**Text:** `--marble` #F3EFE7 primary (15.2:1), `--limestone` #B9C1D1 secondary (9.6:1), `--slate` #8F9BB3 tertiary
(6.2:1 on lacquer, 5.6:1 on raised).

**Brass**
- `--brass-200` focus ring; `--brass-300` brass text (Your turn, active tab, set notes, links; 11.9:1);
  `--brass-400` brass fills (hub, cash icon, selected outline); `--brass-500` meter's dark end, dial rays;
  `--brass-600` brass rules (inlay, dial rim, plaque frame); `--brass-800` faint top-edge hairline.
- `--brass-wash` (14%) brass-tinted fills; `--brass-wash-faint` (7%) feed lines that involve you.
- `--brass-metal` / `--brass-metal-hover` / `--brass-metal-pressed`: the primary button; `--on-brass` #121A2C text on it (9.4:1).

**Paper:** `--paper` card stock, `--paper-2` owner strip, `--paper-line` frame and rules, `--paper-now` current-rent
wash, `--paper-leader` dotted leaders, `--ink` text on paper and brass (14.8:1), `--ink-2` secondary on paper (6.5:1),
`--brass-ink` brass on paper, `--stamp` the Mortgaged stamp (4.6:1), `--house-paper`/`--hotel-paper` drawn houses on
paper, `--house-night`/`--hotel-night` on lacquer, `--pip` dice pips.

**Signals:** `--go` ready/online, `--stop` bankruptcy/mortgaged/unread/errors, `--stop-ink` text on stop (7.1:1),
`--stop-line` stop outline, `--offline` the away dot, `--disabled-bg`/`--disabled-fg` blocked buttons (4.6:1).
There is no warning colour: attention is brass.

**Players:** `--p-red`, `--p-blue`, `--p-green`, `--p-yellow`, `--p-purple`, `--p-orange`, `--p-gray` (mirror
`PLAYER_COLORS`; in JS use `playerColor(player)`).

**Groups:** `--g-brown`, `--g-lightblue`, `--g-pink`, `--g-orange`, `--g-red`, `--g-yellow`, `--g-green`,
`--g-darkblue`, `--g-railroad`, `--g-utility` (mirror `PROPERTY_COLORS`), `--g-special` #1B2E5E deed band for
special spaces, `--swatch-ring` the inner ring every swatch carries.

**Type**
- `--font-display` Antonio (names, headlines; proportional figures, so never amounts). `--font-text` Jost (everything else).
- `--fs-display-xl` 60 login wordmark; `--fs-display-l` 36 (40 desktop) deed names, lobby, sheet titles;
  `--fs-display-m` 22 (28 desktop) turn headlines; `--fs-display-s` 21 (22) top bar turn, pane titles;
  `--fs-plaque` 30 lobby numerals; `--fs-body` 15; `--fs-label` 15; `--fs-meta` 13; `--fs-micro` 11 tab labels only;
  `--fs-input` 17; `--fs-money` 16, `--fs-money-l` 18 top-bar cash, `--fs-money-xl` 22.
- `--ls-display` Antonio tracking; `--lh-tight` 1.05, `--lh-snug` 1.2, `--lh-body` 1.4.

**Space, radius, elevation**
- `--space-1…12` = 4, 8, 12, 16, 20, 24, 32, 48. `--gutter` 16 phone, `--gutter-wide` 20 lobby/login, `--hit` 44.
- `--r-control` 12 inputs/buttons/tiles, `--r-tag` 5, `--r-toast` 16, `--r-dialog` 20, `--r-panel` 22 docked panels,
  `--r-sheet` 26 sheets, `--r-deed` 12 / `--r-deed-in` 7, `--r-plaque` 4, `--r-round` pills.
- `--shadow-docked` docked panel (brass hairline + upward shadow), `--shadow-lifted` / `--shadow-lifted-lg` toasts,
  menus, dialogs, `--shadow-sheet`, `--shadow-paper` / `--shadow-paper-sm` deeds, cards, dice. `--focus-ring`.

**Motion:** `--ease-out` sheets and toasts, `--ease-needle` the dial's overshoot, `--dur-quick` 160, `--dur-base` 220,
`--dur-sheet` 280, `--dur-money` 400, `--dur-needle` 700 (0 under reduced motion).

**Layout:** `--topbar-h` 56 (64 from 900px) and `--tabbar-h` 49, both without the safe area (add `--safe-top` /
`--safe-bottom`). The game shell, the toaster and the connection banner use them; don't repeat the numbers.
`--safe-top/-bottom/-left/-right`.

The old green-and-gold alias tokens (`--bg-*`, `--text-primary/-secondary/-muted`, `--gold*`, `--monopoly-*`,
`--danger*`, `--spacing-*`, `--radius-*`, `--shadow-sm…xl` and the rest) are gone: use the tokens above.

## Classes (`ui.css`)

**Type:** `ui-display-xl`, `ui-display-l`, `ui-display-m`, `ui-display-s` (Antonio scale; `em` inside is brass);
`ui-headline` the one-line turn headline (ellipsis is a last resort, not the plan); `ui-body`; `ui-label-text`;
`ui-meta`; `ui-micro`; `ui-money` (+ `--l`, `--xl`; `.is-in` brass flash, `.is-out` stop flash when cash changes; colour is
inherited); `ui-countdown` (+ `.is-soon`, `.is-urgent`) with an `<Icon name="clock">` inside.

**Icons:** `ui-icon` (set by `<Icon>`), `ui-glyph` (set by `<TokenGlyph>`).

**Buttons:** `ui-btn` (default = secondary: raised, seam-strong outline, 48px); `ui-btn--primary` flat brass, one per
view; `ui-btn--secondary`; `ui-btn--ghost` quiet 44px, slate icon (the "more" row, Close); `ui-btn--danger` stop outline;
`ui-btn--danger-solid` filled stop, only the destructive button of a confirm dialog; `ui-btn--tint` brass-tinted
(toast action); sizes `ui-btn--lg` 56, `ui-btn--sm` 44; `ui-btn--block` full width; `ui-btn--icon` 44px round (needs
`aria-label`); `ui-btn__stack` + `ui-btn__sub` two lines ("Buy for $200" / "Leaves you $1,160"; `ui-btn__sub ui-money`
on one element keeps tabular figures, "+$90"). `:disabled` or
`aria-disabled="true"` gives the blocked look; `ui-reason` is the reason line under it. `ui-spinner` inline spinner.
A button is a flex row with an 8px gap between children, so keep a label and its amount in one span
(`<span>Pay <span class="ui-money">$450</span></span>`) and let the gap separate only icons and badges.

**Surfaces**
- `ui-panel` docked lacquer panel with the brass inlay (phone turn panel); `ui-panel--float` lifted, 20 radius (desktop).
- `ui-pane-title` pane heading ("Players", "Your properties").
- `ui-sheet` bottom sheet on phone, centred 560px dialog from 900px; works on `<dialog>` (`showModal()`, `::backdrop`
  scrim, rise animation). Parts: `ui-sheet__grab`, `ui-sheet__head`, `ui-sheet__title` (Antonio 30), `ui-sheet__actions`.
- `ui-modal` centred dialog at every width (confirmations): `ui-modal__title`, `ui-modal__body`, `ui-modal__actions`.
- Initial focus in a dialog: `showModal()` focuses the first focusable control, and React's `autoFocus` loses to it.
  The game's `Modal` focuses `[data-autofocus]` after opening: put it on Cancel in a confirmation (never on the
  destructive button), and on OK, Close or the harmless primary elsewhere. `screens/ConfirmDialog` focuses Cancel itself.
- `ui-scrim` a fixed scrim for non-dialog overlays.
- `ui-menu` lifted popover; `ui-menu__item` 48px icon rows (`--danger` for Log out); `ui-menu__sep`.
- `ui-toast` lifted card (grid: medallion | text | close); `--error` stop rule; `--plain` without a medallion; parts
  `ui-toast__title`, `__body`, `__time`, `__actions` (second row, for a `ui-btn--tint`), `__close` (a `ui-btn--icon ui-btn--ghost`).
- `ui-row` flush list row (12×16, seam underneath, grid: lead | text | trail); `.is-current` raised with a 3px bar in `--pc`.
- `ui-well` calm note (well background); `ui-well--brass` brass note ("4 new since you last looked").
- `ui-divider` hairline; `ui-divider--label` double hairline with a centred label ("Seen before").
- `ui-paper` paper stock with the paper shadow; `ui-paper__in` the framed inner panel (deeds, cards).

**Small parts:** `ui-badge` unread count (stop + stop-ink); `ui-badge--brass` count on brass (Received offers);
`ui-dot` 8px "needs you" dot; `ui-tag` brass outlined ("you", "Host"); `ui-tag--stop` (Mortgaged), `--go` (Ready),
`--quiet` (Not ready), `--ink` (the "Now" tag on paper); `ui-chip` player chip with a 28px medallion (not a 44px
target: wrap it in a button that is); `ui-swatch` group swatch (`--g`), `ui-swatch--lg`; `ui-meter` brass meter
(set `--value: 73%`); `ui-dice` + `ui-die` paper dice (`data-value` 1–6, nine empty `<i>` children).

**Controls:** `ui-tabs` underline tabs (Activity / Chat; active = `aria-selected="true"` or `.is-on`); `ui-seg`
segmented control, 44px segments (aria-selected / aria-pressed / `.is-on`; a `ui-badge` inside turns brass);
`ui-field` label + control stack; `ui-label`; `ui-hint`; `ui-error`; `ui-input` a field wrapper for a prefix
(`ui-input__pre`, "$") or a trailing text action (`ui-input__act`, "Show") around a bare `<input>`; `ui-switch` on a
`<button role="switch" aria-checked>` (on = go, 44px hit area). Bare `input`/`textarea`/`select` are already styled
by the base layer (52px well, seam-strong outline, brass focus).

**Medallion:** `ui-med` (+ `ui-med--sm` under 28px, `.is-current`, `.is-out`), `ui-med__glyph`, `ui-med__icon`,
`ui-med__dot` (+ `.is-on`), `ui-med-btn` a 44px round button around a medallion (top-bar account menu).

**Dial:** `ui-dial` (`--current`/`--all`), `ui-dial__plate`, `__rule`, `__rays`, `__seg` (`.is-on`, `.is-out`),
`__you`, `__needle`, `__hub`, `__pin`, `__base`.

**Wordmark:** `ui-wordmark` (`--sm`/`--md`/`--lg`/`--xl`, `--inline`), `ui-wordmark__name`, `ui-wordmark__sub`.

**Base layer utilities (index.css):** `.money`/`.num`/`.tabular` tabular amounts, `.sr-only`, and the old
`.card`, `.mt-*`, `.mb-*`, `.flex`, `.gap-*`, `.fade-in`, `.slide-in`, `.pulse` (the design says no pulsing: drop
`pulse` from the top bar when it is restyled).
