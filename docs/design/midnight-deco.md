# Polymono, Midnight Deco (direction c)

## Concept

Manhattan after dark. The app is a game table under a lamp in a 1930s lobby: night lacquer and brass all around, and the bright illustrated board as the one lit object in the room. The physical things in the game are paper, the way they are in a real box: title deeds, Opportunity and Community Fund cards, dice. Everything else is lacquer, so the board and the cards stay the brightest things on screen. The bold element is the **turn dial**, a brass semicircular floor indicator like the ones over Art Deco elevators, whose needle points at whoever is up. It sits in the top bar on every screen and is the logo on the login page. Everything else stays quiet, so checking your turn at 1am is a glance.

Why it fits this board: the art's own premium accents are navy and gold already. The Opportunity, Community Fund, Rikers, Lost and Found and New Year's Eve tiles are deep blue with gilt frames. Night lacquer and brass pick up those tiles instead of competing with the cream board and the candy-colored group bands.

## What changes from today, and why

| Today | Midnight Deco | Why |
|---|---|---|
| Dark green and gold | Night navy lacquer and brass | Green fought the board's own green group and the art's blue-and-gold tiles. Navy recedes, and brass reads as a material, not a flat yellow. |
| Inter plus Playfair Display | Antonio for names and headlines, Jost for text and amounts | Playfair is generic "luxury". Jost is a revival of Futura (1927), the era's own typeface, and it has real tabular figures. Antonio is tall and condensed like lobby directory lettering, so "One World Trade Center" and "jack is deciding on Wall Street" fit on a phone. |
| Emoji everywhere (tokens, tabs, buttons, feed) | A drawn 24px line-icon set, and six token glyphs in player-colored medallions | Emoji render differently on each OS, cannot take the player's color, and are what makes the current UI look like a prototype. |
| A turn "pill" | The turn dial | One memorable, functional object. It shows turn order and who is up at once. |
| Rounded dark cards with the same border everywhere | Flush lacquer bars, rows split by hairlines, and real paper for deeds | Removes the SaaS card kit. Depth now means something: paper objects cast shadows, chrome does not. |
| Logo image in a white box | A typographic wordmark | The white rectangle was the most "unfinished" thing on screen. The board's centre art still carries the puzzle-shield logo. |
| Brown table, cream slab | Night-navy table with a warm lamp pool, a lacquered slab edge and a brass inlay | Puts the board in the room the chrome describes. |
| The buy prompt was a sentence and a button | A mini title deed, three key rents, and the set you would complete | The decision you are actually making is visible at a glance. |

No features were added. Two layout changes reuse existing data: desktop shows your holdings under the players (the "My properties" drawer's content, read-only, with "Manage" opening the drawer), and the watcher panel adds one reassurance line ("Nothing needs you right now").

## Light or dark

**Dark only, tuned to stay legible in daylight.**
- The board is the light object. Dark chrome makes it the brightest thing on screen, which is where your eye should go. On a light UI the cream slab blends into the page and stops looking like an object.
- People check turns in bed. A white screen at 1am is a flashbang. Also set `<meta name="theme-color" content="#101A2D">` so the iOS status bar matches.
- Daylight is handled with contrast, not with a second theme: primary text is 15:1, secondary 9.6:1 and tertiary 6.2:1 on lacquer, so nothing relies on dim grey. Brass text is 11.9:1.
- One theme halves design and QA work for a six-person hobby app. If a light theme is ever wanted, every value below is a token, so it is a token swap, not a redesign.

## Palette

### Room and lacquer
| Token | Hex | Use |
|---|---|---|
| `--room` | `#0A1120` | App background, behind everything |
| `--table` | `#0E1A33` | Board table, centre (falls off to `--table-edge` `#060B16`) |
| `--lacquer` | `#101A2D` | Top bar, tab bar, turn panel, side columns |
| `--raised` | `#172338` | Sheets, toasts, the current player's row, selected segments |
| `--well` | `#0C1526` | Inputs, segmented control track, unselected trade tiles |
| `--seam` | `#24324D` | Hairlines (decorative only, never the only boundary of a control) |
| `--seam-strong` | `#5A6C92` | Control outlines (3:1 on lacquer) |

### Text
| Token | Hex | Contrast on lacquer |
|---|---|---|
| `--marble` | `#F3EFE7` | 15.2:1, primary |
| `--limestone` | `#B9C1D1` | 9.6:1, secondary |
| `--slate` | `#8F9BB3` | 6.2:1 (5.6:1 on raised), tertiary: times, hints, inactive tabs |

### Brass
| Token | Hex | Use |
|---|---|---|
| `--brass-200` | `#F3E3BD` | Focus ring |
| `--brass-300` | `#EBD3A0` | Brass text: "Your turn", the active tab, set notes, links (11.9:1) |
| `--brass-400` | `#D7B46A` | Brass fills: the dial hub, the cash icon, the selected-tile outline |
| `--brass-500` | `#B8914A` | The meter gradient's dark end and the dial rays |
| `--brass-600` | `#8C6C34` | Brass rules: the panel inlay, the dial plate, the plaque frame |
| `--brass-800` | `#3E3220` | Faint brass hairline on sheet and panel top edges |
| Button | `#E8CA86` to `#CFA758` | The primary button's metal: a two-stop vertical gradient, the only gradient on a control. Text `#121A2C` (9:1). |

### Paper (title deeds, cards, dice)
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F5ECDA` | Deed and card stock, dice faces |
| `--paper-2` | `#ECE0C7` | The deed's owner strip |
| `--paper-line` | `#D3C3A2` | The deed's frame and rules |
| `--ink` | `#1B1A17` | Text on paper (14.8:1) |
| `--ink-2` | `#5B5346` | Secondary text on paper (6.5:1) |
| `--brass-ink` | `#6E521F` | Brass accent on paper (not yet used) |

### Signals
| Token | Hex | Use |
|---|---|---|
| `--go` | `#52C98C` | Ready, online, houses on night |
| `--stop` | `#FF7A6B` | Bankruptcy, mortgaged tags, unread badges (badge text `#2A0E0A`) |

There is no separate warning color: "attention" is brass. Rikers and debt use brass or an icon plus words, never a color alone.

### Player colors (replace `PLAYER_COLORS` in `lib/colors.js`)
All pass 4.5:1 as text on lacquer, so a player's name can be set in their color when needed.
| Key | Hex | Contrast on lacquer |
|---|---|---|
| red | `#FF6B5E` | 6.2:1 |
| blue | `#5EA8FF` | 7.1:1 |
| green | `#3DD68C` | 9.3:1 |
| yellow | `#FFD447` | 12.2:1 |
| purple | `#B78CFF` | 6.8:1 |
| orange | `#FF9640` | 8.0:1 |
| gray (fallback) | `#9AA3B5` | |

### Group colors (unchanged: they must match the bands painted on the board)
brown `#8B4513`, light blue `#87CEEB`, pink `#E0399A`, orange `#F7941D`, red `#E0312B`, yellow `#F5D90A`, green `#1FA45A`, dark blue `#2B4BCB`, stations `#2B2B2B`, utilities `#B8C4CC`.
- Several of them fail 3:1 on night (brown 2.4, dark blue 2.5, stations 1.2). Every swatch on night therefore gets an inner 1px `rgba(255,255,255,.28)` ring, and a swatch always sits beside the group or property name.
- On a deed band, only the large property name goes on the color (it is 38px, so the 3:1 large-text threshold applies). It uses `readableInk()`, which already exists. Small text never sits on a band.

## Type

Two families from Google Fonts: `Antonio:wght@500;600;700` and `Jost:wght@400;500;600;700`.

| Role | Family | Size/line (phone) | Desktop | Where |
|---|---|---|---|---|
| Display XL | Antonio 600, +0.02em | 60/60 | 60 | The login wordmark |
| Display L | Antonio 600, +0.015em | 36–40/40 | 40 | Deed names, lobby title, the sheet title "Trade", the game-over winner |
| Display M | Antonio 600 | 25/26 | 28–30 | Turn panel headlines ("You landed on Tribeca") |
| Display S | Antonio 600 | 20–22/22 | 22–26 | The top bar's "Your turn", pane titles ("Players", "You give") |
| Plaque numerals | Antonio 600 | 30 | 30 | Lobby settings (24h, $1,500, 2–6). Antonio's figures are proportional, so use them only for single, static values. |
| Body | Jost 400 | 15–16/1.4 | 15 | Feed lines, summaries, hints |
| UI label | Jost 500/600 | 15–16 | 15 | Buttons (600), names (600), row labels (500) |
| Meta | Jost 500 | 13/1.2 | 13 | Countdowns, "worth $2,410", captions |
| Micro | Jost 500 | 11 | 11 | Tab bar labels only |
| Money | Jost 600, `font-variant-numeric: tabular-nums lining-nums` | 15–22 | 16–20 | **Every** amount, including the top-bar cash |

Rules:
- Sentence case everywhere. There are no all-caps eyebrows. Section labels are just headings ("Players", "Your properties", "Trade with").
- Inputs use 17px so iOS does not zoom.
- Player names stay lowercase as typed (max, jack); they are handles, not proper nouns.
- No "A · B · C" strings. Facts become rows or sentences ("Rolled 4 and 3. Your move.").

## Space, radius, elevation

- **Spacing:** 4px base. Steps are 4, 8, 12, 16, 20, 24, 32, 48. Phone gutters are 16px (20 on lobby and login). Rows have 12px vertical padding.
- **Radius:** controls 12 (inputs, buttons, trade tiles), toasts 16, docked panels 22 on the top corners, sheets 26 on the top corners, deeds 12 outside and 7 inside, medallions round, the lobby plaque 4 (square-cornered, like a building directory). Nothing else is rounded. Lists are flush rows split by hairlines.
- **Elevation, four levels and nothing else:**
  1. *Room*: `--room` and the table. No shadow.
  2. *Lacquer*: bars and side columns. Flush, separated by a `--seam` hairline, no shadow. The docked turn panel adds a brass inlay line along its top edge (`--brass-600`, fading out at both ends) and a soft upward shadow onto the table.
  3. *Lifted*: sheets, toasts, dialogs, the desktop turn panel. `--raised`, with an inset seam, a 1px top highlight in `--brass-800` or `--brass-600`, and `0 18–24px 40–60px rgba(0,0,0,.55–.6)`.
  4. *Paper*: deeds, cards and dice cast their own warm, deeper shadow (`0 28px 50px -14px rgba(0,0,0,.7)`). The buy prompt's mini deed is tilted −2°, as if it had just been dealt.
- **Deco ornament budget:** double rules (an outer brass line with an inner hairline) appear only on the dial plate, deed bands, the lobby plaque and the game-over crown. Diamond terminals appear only on the plaque. Nowhere else.

## Iconography

- **UI icons:** one drawn set on a 24px grid with a 1.75px stroke, round caps and joins, `currentColor`, square-leaning geometry. The set: board, players, activity (a ledger with square bullets), chat (a square speech bubble), deed (my properties), dice, trade (two opposing arrows), clock, bars (Rikers), note (cash), house, bank (mortgage), card (Opportunity and Community Fund), crown (host and winner), follow (crosshair), eye (spectate), bell, close, check, chevron, plus, minus, logout, info, sparkle. Ship it as one `<Icon name>` component with inline SVG paths (they are all in the mockup's `parts.cjs`).
- **Event icons** (`lib/events.js`): roll→dice, move→step arrow, salary and money→note, buy→house, rent and fine→note, tax→note, card→card, jail, jail_stay and jail_release→bars, build and sell_building→house, mortgage and unmortgage→bank, trade_*→trade, bankrupt→close, game_over→crown, join, ready and start→players, turn_skipped→clock.
- **Token glyphs:** six one-color silhouettes on a 32px grid (taxi, pigeon, rat, subway car front, charging bull, Empire State). Cut-outs (windows, eyes) are painted in the medallion's background, so each glyph stays a single fill. They replace `tokenEmoji()` everywhere in the chrome. The 3D models stay on the board.
- **Medallion:** a `#16213A` coin with a 2px ring and glyph in the player's color, and a 1.5px room-colored gap inside the ring. Sizes are 22 (feed), 28 to 30 (chips), 36 (top bar, toasts), 40 to 44 (panel, rows, partner picker) and 48 (desktop panel). The current player adds an outer brass ring. A bankrupt player's medallion turns slate. The online dot is 11px, `--go`, with a 2px room-colored border.
- **Houses:** drawn house shapes (four, then a wider hotel), not squares. Filled `#1E8A4F` (hotel `#C42F2A`) on paper, or `--go` and `#FF6B5E` on night. Empty ones are outlined.
- No emoji anywhere in the UI. Emoji typed into chat stay.

## Motion

| Moment | Motion | Duration and easing |
|---|---|---|
| The turn passes | The dial needle sweeps to the next segment with a small mechanical overshoot. The new segment's glow fades in. | 700ms, `cubic-bezier(.2,.9,.3,1.25)` |
| It becomes your turn | As above, plus "Your turn" fades from marble to brass. The tab bar's Board dot appears. No pulsing. | 300ms fade |
| Sheets | Rise from the bottom while the scrim fades in | 280ms, `cubic-bezier(.2,.8,.2,1)`. Close: 200ms. |
| Toasts | Drop 12px and fade in, auto-dismiss after 6s (except offers and errors) | 220ms in, 160ms out |
| Cash changes | Digits roll to the new value. Tabular figures keep the width fixed. A brief brass flash for money in, a stop-red flash for money out. | 400ms |
| Buy prompt | The mini deed slides up 8px and settles at −2° | 240ms |
| Board | Unchanged (director, camera rig, dice) | |

`prefers-reduced-motion: reduce` turns every transform off. The needle jumps, sheets and toasts fade in 120ms, digits swap without rolling, and the board camera cuts instead of flying (the existing director should honor the same media query).

## Components

### Top bar (phone 56px, desktop 64px)
- **Phone:** dial (76×42) | "Your turn" or "jack's turn" (Antonio 21, brass when it is yours, marble otherwise) above "21h 40m left" (Jost 13, with a clock icon) | cash (note icon in brass, Jost 600 18, tabular) | your medallion (36, a 44px button) that opens the account menu. The status-bar area shares the lacquer color.
- **Desktop:** the wordmark "Polymono" (Antonio 26) and a hairline, then "Manhattan edition, day 9" on the left. The dial (92) and turn text are centred. Cash, then the medallion, name and chevron are on the right.
- **The turn dial:** a semicircular plate (`#0D1729`) with a brass rim, a double rule and a baseline. Inside is a faint 11-ray sunburst (Chrysler crown) at 38% brass. Six arc segments run in turn order, each in its player's color: 30% opacity at rest, 100% with a soft glow for the current player, and dashed and empty for a bankrupt player. A tapered brass needle pivots on a brass hub. Fewer than six players means fewer, wider segments. Accessible name: "jack's turn". The text beside it carries the meaning, so the dial is reinforcement, not the only signal.
- The account menu is a lifted popover with icon rows: Sound on/off (bell), Change password, Admin, Log out.

### Turn action panel
Docked above the tab bar on phone, with 22px top corners overlapping the table by 20px and a brass inlay on its top edge. On desktop it floats 20px above the table's bottom edge (620px wide, 20px radius, lifted). Its anatomy: a head row (medallion 40, an Antonio 25 headline, a sub line in Jost 14 with a clock, and dice at the right when there is a fresh roll), an optional body, the actions, then a "more" row of two quiet buttons (My properties, Trade with an offer count badge) under a hairline.

A blocked action stays visible and disabled (muted fill `#141F33`, `#7D879C` text), with the server's reason in Jost 13 slate underneath. That pattern exists today and is kept.

| Phase | Headline | Body | Actions |
|---|---|---|---|
| Roll | "Your turn" | none | **Roll** (brass, 56px, dice icon) |
| Doubles | "Doubles! Roll again" | none | **Roll again** |
| Buy or pass | "You landed on **Tribeca**" (name in brass). Sub: "Rolled 4 and 3. Your move." | The mini deed (paper, band in the group color, name, price), then three facts (Rent, With the full set, With a hotel) and a set line in brass: "Completes your orange set", or "You'd own 2 of 3 pink", with small group squares where the one you'd add is a brass outline. | **Buy for $200** with a sub line "Leaves you $1,160" (brass, 2/3 width), and **Pass** (lacquer, 1/3) |
| In Rikers | "You're in Rikers". Sub: "Attempt 2 of 3. Doubles get you out." | none | **Roll for doubles** (brass, full width), then **Pay $50** and **Use a free card** side by side (lacquer). A missing card shows "You don't have a free card." |
| Debt | "Raise **$120** to pay up" | Each debt as a row ("Rent on Gramercy Park to youngeun", $450), a brass meter of cash toward the total, "$330 of $450 in cash" | **Pay $450** (disabled with "You're $120 short. Sell houses or mortgage first."), then **Sell or mortgage** (brass, the way forward) and **Declare bankruptcy** (stop-red outline, opens a confirmation) |
| End | "Landed on Lost and Found". Sub: "Rolled 6 and 1. Nothing to pay." | none | **End turn** |
| Waiting for others | "jack is deciding on Wall Street" (watcherLine, unchanged). Sub: "14h 22m left to choose". | A calm well: "Nothing needs you right now. We'll ping you when it's your turn." | Only the more row. The panel is short on purpose, so the board gets the room. |
| Spectating or bankrupt | As waiting | The well says "You're watching as a spectator." or "You're out of this game. You can still watch and chat." | none |
| Game over | "youngeun won the game" | none | **Results** (opens the game-over sheet) |

### Player rows
On desktop, the left column of 320px. On phone, the Players tab sheet. Rows have no cards, just 12×16 padding and a seam underneath. The layout: medallion 42 with the online dot | the name (Jost 600 16), a "you" tag (a brass-outlined 12px tag), a status line (brass "Up now, 21h 40m left" for the current player; "In Rikers, try 2 of 3" with the bars icon; "Holds a free card" with the card icon) and the set strip | cash (Jost 600 16, tabular) above "worth $2,410" (13, slate). The current player's row is `--raised` with a 3px bar in their color. The **set strip** is ten 11×6 cells in group order: an empty cell is seam-colored, a partly owned set fills from the left in the group color, and a full set gets a 1px brass outline. The whole row is a button that opens the player sheet.

### Activity feed rows
- Tabs "Activity" and "Chat" (unread badge) with a 2px brass underline on the active one.
- A brass well at the top: "4 new since you last looked".
- **Turn group head:** a 22px medallion, then "jack's turn" or "Your turn" (Jost 600 14), with the relative time on the right (13, slate).
- **Line:** an 18px icon in slate, then the text (Jost 14, limestone). Names stay plain, amounts are Jost 600 marble tabular. Lines that involve you get a 2px brass rule and a faint brass wash, and their icon turns brass. New lines get marble text and a 6px brass dot in the gutter (and "new" for screen readers). A group with no lines says "Nothing yet." in slate.
- "Seen before" is a double-hairline divider with the label centred.
- Copy: "jason rolled 6 and 5 and landed on Chelsea", "seabass paid you $25 rent". No "→" and no "=" arithmetic.

### Property card (title deed)
- **Full (property sheet):** paper card, 7px padding, a framed inner panel.
  - The band is the group color with an inset 1px white rule 4px in (the double frame), carrying the name in Antonio 38 in `readableInk`.
  - The set line goes under the band ("Pink set, youngeun owns all 3", with three squares).
  - The rent ladder lists Rent, With the full set, 1 to 4 houses and Hotel, each with a dotted leader to a right-aligned tabular amount. The current tier gets a `#E9D9B4` wash, a 4px ink bar on the left, an ink "Now" tag and `aria-current`.
  - Then a 2×2 facts grid: Price, Houses ($100 each), Mortgage value, Unmortgage.
  - The owner strip (paper-2) has the owner's medallion, their name with drawn houses underneath, and "Rent now **$150**" on the right. Unowned: "For sale by the bank". Mortgaged: a stamped "Mortgaged" diagonal in stop-red ink at 80%, with the ladder dimmed.
  - Stations and utilities use the same deed with their own ladder rows.
- **Below the deed in the sheet:** "Here now" with chips, then the actions: "Ask youngeun for it" (lacquer; brass when it is the main thing to do) and "Close" (quiet). The sheet sizes to its content with a grabber. There is no × because Close, the scrim tap and swipe-down all close it.
- **Compact (buy prompt):** described above.
- **Row (drawer, holdings):** a swatch, the name, drawn houses and the rent now on the right. Mortgaged rows show a stop-red outlined "Mortgaged" tag.
- **Special spaces** (Opportunity, Rikers and the rest): the same paper card. The band is navy `#1B2E5E` with a brass double rule, matching the tiles in the art, then the name and the `describeSpace()` sentence.

### Toasts
A lifted `--raised` card (16 radius) under the top bar on phone (10px gutters) and top-right on desktop (360 wide). It holds the actor's medallion (36), a title (Jost 600 15) and a body (14, limestone). An action ("Review the offer") sits on a second row as a brass-tinted 44px button, and the 44px × dismiss is at the top right. Error toasts use a stop-red rule instead of the brass top highlight. At most three are shown, and the popover top-layer behavior is kept.

### Bottom tab bar (phone)
Five tabs: Board, Players, Activity, Chat, Mine. Each is a 24px line icon over an 11px label. Inactive tabs are slate; the active one is brass-300 with a 22×2px lit brass bar on the top edge. Unread chat shows a stop-red badge, and "needs you" (your turn while you are on another tab, or debt on Mine) shows an 8px brass dot. The bar is 49px plus the safe area, on lacquer with a top seam.

### Modals and sheets
- **Phone:** bottom sheets with 26px corners, a 40×5 grabber, `--raised` and a scrim of `rgba(4,7,13,.62)`. Titles are Antonio 30. Actions sit at the bottom, primary first in reading order. Full-height tasks (Trade) go full screen with their own status-bar color.
- **Desktop:** centred dialogs (560px, 20 radius), or a right-side drawer for My properties (420px).
- **Confirm dialogs** (bankruptcy, removing a player): the title states the consequence ("Declare bankruptcy?"), the body uses plain sentences, the destructive button is stop-red filled (only here), and Cancel is lacquer.

### Trade dialog
Full screen on phone, a 720px dialog on desktop.
- **Header:** "Trade" (Antonio 30) and a 44px close.
- **Segmented control:** Received (brass count badge), Sent, New offer, History. 44px segments in a well, with the active segment raised.
- **Trade with:** a row of partner medallions (44) with names. The selected partner gets a brass outer ring and a brass name.
- **Two columns, "You give" and "You get":** the two sides of a table. Each property is a 44px+ tile with a swatch, the name, and the price underneath. A selected tile has a brass outline, a brass tint and a brass check badge. Under each column are Cash (an input, "Up to $1,360") and the free-card stepper when relevant.
- **Sticky footer (lacquer):** the deal as one plain sentence, "You give **Penn Station**, **Con Edison** and **$250**. You get **Theater District** and **Bryant Park**, which *completes your red set*." The set note is brass and only appears when it is true. Then **Send offer to seabass** (brass).
- **Counter mode:** a brass well at the top: "Countering youngeun's offer. Their terms are filled in. Change anything, then send it back." with "Start over" as a quiet button.
- **Received offers:** offer cards on `--raised` that show the same sentence from your side, with Accept (brass), Counter (lacquer) and Decline (quiet).

### Lobby
On room, with no card around it.
- **Header:** the wordmark (Antonio 22) and "Log out" (quiet, with an icon).
- **Title:** "Game lobby" (Antonio 36) above a status line ("4 of 6 players are ready").
- **Settings plaque:** a square-cornered lacquer plate with a brass double frame and diamond terminals, laid out as three cells ("24h per turn", "$1,500 to start", "2–6 players") with brass Antonio numerals.
- **Players:** "Players" with "6 of 6". Each row has a medallion 42 with the online dot, the name with "you" and a "Host" crown, the token and presence ("Bull, last seen 3h ago"), and the ready state on the right (a green check and "Ready", or slate "Not ready"). The host also gets a quiet Remove button on swipe or long press, which opens a confirmation.
- **Sticky footer:** an "I'm ready" switch row, then **Start the game** (brass; disabled until everyone is ready, with "Waiting for seabass and jason to be ready." underneath) and "Leave lobby" (quiet). A non-host sees "Waiting for max to start the game."

### Login
- **Header block:** the dial as the emblem (176px), its needle sweeping once on load. Then the wordmark "Polymono" (Antonio 60) and "Manhattan edition" (Jost 500 16, brass).
- **Form:** the fields sit directly on the room, with no card: "Username" and "Password" with "Show" in brass inside the field. The focus state is a brass inner line plus a 2px `--brass-200` outline at a 2px offset (shown on Username).
- **Actions:** **Log in** (brass, 56px), an "or" divider, "Watch as a spectator" (lacquer, eye icon), and the note "Spectators can see the board and read the chat. Accounts are set up by the game admin."
- **Skyline:** a low night skyline along the bottom edge at 75% opacity. It has stepped masses, the Empire State and Chrysler spires with the crown's arches picked out in brass, and sparse lit windows. It sits below the form so nothing is read over it.

### Game over
A sheet over the final board.
- **Header:** a brass crown in a double-ruled circle, "youngeun wins Manhattan" (Antonio 32), and "Day 23, after 141 turns".
- **Standings:** brass Antonio rank numerals, medallions, names, and "worth $6,840" or "Bankrupt on day 21" (slate, with a slate medallion).
- **Stats:** the existing stats (the biggest bill, and so on) as feed-style lines with icons.
- **Actions:** "See the final board" (lacquer) and "Back to the lobby" (brass).

### Smaller pieces
- **Away digest ("While you were away"):** a sheet. The rows "You have $1,360", "You collected $214 in rent" and "You paid $150 in rent" use note icons with money amounts in marble, then "Involving you" uses feed lines.
- **Connection banner:** a slim stop-red-ruled lacquer strip under the top bar ("Reconnecting…" with a spinner, then "Back online" in go, auto-hiding).
- **Chat:** messages from others go on `--raised` bubbles with square-ish 12px corners and a medallion. Your own are brass-tinted, `rgba(215,180,106,.14)`, with marble text. The input is a 52px well with a brass Send text button.
- **Admin:** the same tokens and components with no special treatment: tables are rows with hairlines.

## Board staging (react-three-fiber)

| Thing | Today | Proposed |
|---|---|---|
| Scene background (`BACKGROUND`, `.root` background) | `#14201a` | `#0A1120` (room) |
| Table plane | `#2b1d14` brown | Lacquer navy `#0F1B35`, roughness 0.45, so the key light leaves a soft sheen. Optionally a 1024px CanvasTexture with a radial falloff (`#142445` to `#070C18`) and a 4%-opacity brass fan inlay radiating from the centre (what the mockup shows in CSS). |
| Slab | One cream box `#efe6d2` | Sides become lacquer `#18233D` (a material array per face; the top stays cream under the tiles). Add a thin brass inlay ring around the top edge (`#C9A35A`, metalness 0.8, roughness 0.35, 0.06 tall). This is the "frame" that ties the board to the chrome. |
| Hemisphere light | `#fff6e8` / ground `#33443a` | Sky `#FFF3DF`, ground `#1A2236` (cool, not green) |
| Key light | White, 2.3 | Warm `#FFF1DC`, 2.3, same position. Shadows stay. |
| Lamp pool | none | A SpotLight overhead (`#FFE2B0`, angle 0.55, penumbra 0.9, low intensity) so the table glows warm under the board and falls off to night at the edges. With `frameloop="demand"` the cost only lands on redraw. |
| Rim light | none | A cool `#7FA6FF` directional from behind and above at 0.35, so the metallic tokens get a night edge. |
| Owner strips | Player color on the tile's outer edge | Keep them, in the new player colors. Add a 1-unit darker underside (the same hue at 70% lightness) so yellow and orange owners still read against yellow and orange bands. |
| Mortgaged tiles | Tinted `#8f8f8f` | Tint `#9AA3B5` (cool, matches the slate) plus a translucent diagonal hatch decal |
| Tokens | Player-colored metal (metalness 0.55) | Keep them. Add a thin brass base puck under each model (brass top, player-colored rim) so pieces read as pieces on busy art. TurnRing stays in the player's color with a brass outer hairline. The landing glow becomes brass `#EBD3A0`. |
| Token name labels (DOM) | Bordered pills | A lacquer pill (`rgba(16,26,45,.85)` with blur), a 3px left bar in the player color, and Jost 600 12 |
| Overlay controls | Bottom right (cover GO and the tokens on phone) | **Top right**: a 40px lacquer-glass full-screen circle and the "Follow" pill with a brass lamp dot when on ("Following jack" while it tracks someone). The hit areas extend to 44px. |
| Phone camera framing | | Fit the board to the width with about 10px margins and leave a 48px band at the top for the controls. When the turn panel is tall (buy, debt), frame on the current player's side instead of the whole board. |

## Implementation map

- `src/index.css`: replace the green and gold tokens with the tokens above, and add the Google Fonts link in `index.html` (`display=swap`). Add a global `.num` / `.money` rule with `tabular-nums`. Set `theme-color` to `#101A2D`.
- `components/game/ui.css` and `game.css`: buttons (brass, lacquer, quiet, stop), the medallion, the tab bar, toasts, sheets, the panel, feed rows and player rows. Deeds get their own `deed.css`.
- `lib/colors.js`: the new `PLAYER_COLORS`. `lib/tokens.js`: add glyph paths and a `<TokenGlyph>` and `<Medallion>`, and stop exporting emoji to the UI. `lib/events.js`: icon names instead of emoji.
- New: `components/game/TurnDial.jsx` (an SVG with props `players`, `currentIndex` and `size`, animating the needle angle with a CSS transform on a `<g>`, which reduced motion disables), and `components/ui/Icon.jsx`.
- `Board.jsx`, `board/Spaces.jsx` and `board/Tokens.jsx`: the staging changes in the table above.
- Screens (`screens/*.module.css`, `trade/Trade.module.css`): same tokens. Remove the logo `<img>` in the white box.
- The mockup's `work/parts.cjs` holds the exact icon and glyph paths and the dial geometry, ready to port.

## Accessibility floor
- Touch targets are 44px or more: buttons 48 to 56, tabs 49, segments 44, tiles 44+, the toast action and dismiss 44, and the board controls 40 visible with 44 hit areas.
- Contrast: all text 4.5:1 or better (the lowest is slate on raised at 5.6:1). Control outlines are 3:1 (`--seam-strong`). Group swatches always carry a light ring and a text label.
- Focus is a visible 2px `--brass-200` outline at a 2–3px offset on every interactive element. Inputs add a brass inner line.
- Color never stands alone: the dial is paired with "jack's turn", set cells with aria labels, ready with a check and the word, mortgaged with the word.
- Reduced motion is honored as listed under Motion.
- Layout works at 390×844 portrait and 1440×900. Between those, the phone layout runs up to 900px wide, and from 1100px the three columns appear. Between 900 and 1100, two columns: the players collapse into the top bar's dial, which becomes a button for the Players sheet.

## Self-critique: where this could fail

1. **Dark on dark can feel heavy or samey after weeks.** Navy, lacquer and raised are close in value. On a cheap or dim phone screen, panel edges could vanish, and the app could read as "a dark theme" rather than "lacquer". This relies on the brass inlays, hairlines and paper deeds doing their job. If testing shows mush, raise `--raised` to about `#1B2942` and give the lacquer a little more blue.
2. **The dial is small on phone.** At 76px, six 30% segments are muddy (dim red next to dim orange). The needle and the text do the work there, and the dial is decoration at that size. If the friends don't notice it, it isn't earning its place. A fallback is to drop the inactive segments to plain seam color and keep only the current one lit.
3. **Brass can tip into casino.** One more gradient, glow or ornament and it becomes a slot machine. The rule is enforced in the doc (one gradient on the primary button, ornaments in four places only), but it needs discipline in implementation.
4. **Cartoon art vs. Deco chrome.** The board art is loud, friendly and illustrated, and the chrome is restrained and adult. The navy-and-gilt special tiles bridge them, but some people may feel the frame is more serious than the game. The warm lamp pool and the tilted mini deed are there to keep it playful.
5. **The token glyphs are hand-drawn approximations.** The bull is the weakest (it can read as a rhino at 22px). Before shipping, redraw it, ideally traced from silhouettes of the actual 3D models, so the medallion and the piece on the board match.
6. **Antonio's figures are proportional.** That is why every amount is in Jost. Someone will be tempted to set the top-bar cash in Antonio "to match". Don't, or it will jitter as it changes.
7. **Dark only** will annoy anyone who wants a light mode in bright sun. The contrast targets are set for that, but it is a bet.
8. **The board screenshots in the mockup are recolored stills.** The slab edge, brass inlay, lamp pool and token pucks are specified but not rendered. The real 3D scene needs its own pass to check that the warm pool doesn't wash out the cream tiles. The current code moved to NeutralToneMapping for exactly that reason.
