# Midnight Deco redesign

The visual redesign chosen on 2026-10-13: navy and brass taken from the board's own special tiles, Antonio for
display type, Jost for text, a brass Art Deco elevator dial as the turn indicator, drawn icons and token medallions
(no emoji anywhere). Three directions were built as mockups and judged; this one won, with grafts from the other two.

- `midnight-deco.md`: the design system (palette, type, components, every turn-panel phase, board staging).
- `verdict.md`: the judge's grafts (from the Transit and Lamplit directions) and the must-fix list. Both are part of
  the spec.
- `shots/`: the mockup frames (a: buy on phone, b: watching with a toast, c: property card, d: trade, e: login,
  f: lobby, g: desktop, h: turn-panel phases, system: the token sheet).

## Status

Shipped on 2026-10-14: the foundation (`frontend/src/components/ui/`, see its README), the game screen, Login, Lobby,
Admin, Chat, Trade and the 3D board staging, with the verdict's grafts and must-fix items, then a design-QA pass and
its fixes. Verified with real two-player games through the UI at 1440x900 and 390x844 (rolls, purchases, doubles,
card moves, trades with a counter-offer, building, mortgaging, debt and the bankruptcy confirm).

Known gaps: swipe-down to close sheets is not built (close, scrim tap and Esc work); the mockup's "last seen 3h ago"
presence text needs data the client doesn't have.

Working material outside the repo: `~/Desktop/dev-personal/polymono-work/` (the three directions' mockups and
shots, the judge results, review reports, the foundation report, browser playthrough scripts and the board harness).
The comparison page for the three directions: https://ebsposs-mac-mini.tail5e44e6.ts.net:8443/demo/ma2k1mrznlu62hey4bojy2/
(live until 2026-10-20).
