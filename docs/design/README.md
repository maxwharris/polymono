# Midnight Deco redesign

The visual redesign chosen on 2026-10-13: navy and brass taken from the board's own special tiles, Antonio for
display type, Jost for text, a brass Art Deco elevator dial as the turn indicator, drawn icons and token medallions
(no emoji anywhere). Three directions were built as mockups and judged; this one won, with grafts from the other two.

- `midnight-deco.md`: the design system (palette, type, components, every turn-panel phase, board staging).
- `verdict.md`: the judge's grafts (from the Transit and Lamplit directions) and the must-fix list. Both are part of
  the spec.
- `shots/`: the mockup frames (a: buy on phone, b: watching with a toast, c: property card, d: trade, e: login,
  f: lobby, g: desktop, h: turn-panel phases, system: the token sheet).

## Status (branch `redesign`)

Done: the foundation (`frontend/src/components/ui/`, see its README): tokens in `index.css` with temporary aliases for
the old names, fonts, player and group colours, 58 drawn icons, `Medallion` with glyphs traced from the 3D token
models, `TurnDial`, `Wordmark`, `ui-*` classes, and a dev-only `/specimen` page. Lint and build are clean; the old
screens render on the new tokens.

Next, in this order:

1. Build the screens on the foundation, in three parallel parts with no shared files:
   - Game screen: `Game.jsx`, `components/game/*`, `lib/presenter.js`, `lib/events.js` (drawn icons per event),
     the store. Includes: every turn-panel phase with the verdict's headline and debt-copy fixes; "You're up after
     <name>"; the colour-group strip map with owners in the buy prompt; deed craft (index tab, tear-off owner stub,
     signature); buy stamp motion; joined set bars; card modal; past games on the results screen; a Turn alerts
     setting in the user menu (`/api/auth/alerts`, see backend/API.md); "don't spoil the roll" (hold the result,
     toasts and feed lines until the board's animation finishes); no End turn UI (turns end on their own).
   - Screens: Login, Lobby (past games from `/api/game/history`, host line), Admin, Chat, Trade (phone layout stacks
     give/get, paper offer slip, ±$50 stepper).
   - Board staging: navy table with a baked lamp texture, lacquer slab with a brass inlay ring, new lights, brass
     pucks and owner discs, lifted group colours.
   The workflow that does this is saved as `polymono-work/redesign-build-workflow.js` (its foundation phase is done;
   run the Build and Review phases).
2. Design QA against the mockups at 390x844, 375x667 and 1440x900, then fixes.
3. Remove the temporary token aliases once nothing uses them; remove `tokenEmoji`.
4. `npm test` in backend, the browser playthroughs, merge to main, `deployp`.

Working material outside the repo: `~/Desktop/dev-personal/polymono-work/` (the three directions' mockups and
shots, the judge results, review reports, the foundation report, browser playthrough scripts and the board harness).
The comparison page for the three directions: https://ebsposs-mac-mini.tail5e44e6.ts.net:8443/demo/ma2k1mrznlu62hey4bojy2/
(live until 2026-10-20).
