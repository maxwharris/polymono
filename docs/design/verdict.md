# Judge verdict: build C (Midnight Deco)

## Recommendation
Build C, Midnight Deco. It best meets the brief: it is significantly more polished and professional, it is distinctly Manhattan, and it sits in harmony with the cartoon board instead of fighting it.

Navy and brass are taken directly from the board's own navy-and-gilt special tiles. As a result the 3D board reads as the lit object in a room (desktop g.png is the most finished frame of all three). The turn dial gives the app a recognisable signature that is also functional.

C is also the most complete specification. Every turn-panel phase is drawn, blocked actions keep their reason, copy rules are set, the event-to-icon map is written, the icon and glyph paths are ready in design/c/work/parts.cjs, and the contrast floor is documented. That makes it the most direct to carry into the existing React and plain-CSS code:
- index.css tokens
- game.css and ui.css
- Trade.module.css
- lib/colors.js PLAYER_COLORS
- tokenEmoji (18 uses) replaced by Medallion
- new TurnDial.jsx and Icon.jsx
- the Board.jsx, Spaces.jsx and Tokens.jsx staging

A is the safer and cheaper build and has better turn-order information, but it risks the 'generic dark app' look and is cold against the warm art. B has the best single object (the deed) but costs the most to build, and it has real phone problems: the deed clips the board, Bodoni hairlines on dark, and a glaring login card.

So: build C's system, and graft A's turn-order information and B's deed craft into it.

## Grafts from A and B (do these)
From A (Transit Authority):

1. **Distance to you.** Put "You're up after raymond" or "You're up next" in C's waiting panel sub-line. It replaces or sits beside "Nothing needs you right now." Also give the dial a small brass "you" tick on your own segment, so the dial shows your place in the order.
2. **Owners in the buy prompt.** Draw the colour group as a strip map, with the owners' medallions on the stops and a "you are here" stop for this property. This replaces C's three 10px squares. Keep C's brass sentence: "Completes your orange set".
3. **"A circle is a person, a bar is a place."** Make this an explicit rule. Medallions are only for players; swatches, bands and bars are only for groups. On the 3D board, consider owner discs instead of strips so a red owner never merges with a red band. At minimum keep C's darker underside.
4. **Timer urgency without a new accent.** The countdown is slate normally, brass under 3h, and stop-red under 30m. It never blinks.
5. **Lifted group colours.** Use A's brown `#9C5B2E` and dark blue `#3A5BD9` in `PROPERTY_COLORS` and in the 3D bands, so swatches pass 3:1 on navy and the UI and the board agree.
6. **Clear debt copy.** "Raise $45 to pay jack", which names the creditor, instead of C's "Raise $120 to pay up".
7. **Small phones in the buy phase.** Drop the quiet "My properties / Trade" row on phone during buy, as A does. Both stay in the tab bar.
8. **Finished sets in the player-row set strip.** A finished set's cells join into one bar, in addition to C's brass outline, so a monopoly can be seen at a glance.

From B (Lamplit Deluxe):

1. **Deed craft, on C's paper deed.**
   - An index tab in the group colour, sticking out of the left edge at the current-rent row.
   - The owner strip as a perforated tear-off stub with half-circle notches. This is cheap CSS: radial-gradient masks.
   - An italic owner signature (Jost italic).
2. **Buy motion.** The mini deed deals up when the buy phase opens. On Buy, your medallion stamps the deed, the deed slides toward the Mine tab, and the tab bumps once. Plus a single floating +$/−$ delta on cash. This is the warmth the Deco chrome needs for six friends.
3. **Trade summary slip.** On received offers, a small paper "offer slip" with mini-deed chips, sitting above C's plain-sentence summary. Keep C's sentence as the accessible text.
4. **Cash in trades.** A ±$50 stepper next to the cash input in the trade builder; it is easier on a phone.
5. **Viewer-specific lobby line.** For example: "You're the host. Start the game once everyone at the table is ready."
6. **Baked lighting on the board.** Bake the lamp pool into a radial-gradient CanvasTexture on the table plane, instead of adding a real-time SpotLight. A proposed this too. It suits `frameloop="demand"` on phones and avoids washing out the cream tiles. Add B's thin player-coloured base disc under each token; it can merge with C's brass puck.

## Must fix before/while implementing
Fix these before implementation:

1. **One-line headlines.** Turn-panel headlines must fit on one line at 375 to 390px.
   - "jack is deciding on Wall Street" (b.png) and "Landed on Lost and Found" (h4) already wrap.
   - Drop Display M to about 22px with `text-wrap: balance`, or move the place name to the sub-line.
   - Test the longest names: One World Trade Center, Grand Central Station, Meatpacking District.
2. **All money in Jost.** C breaks this rule itself: "$120" in the debt headline is Antonio. Restructure the headline or set the amount in Jost 600 with `tabular-nums`. Audit the plaque numerals too ($1,500 there is static, so it is acceptable, but nowhere else).
3. **Phone dial legibility.** At 76px the dim segments go to mush (red next to orange).
   - Use C's own fallback: inactive segments in seam colour and only the current segment lit.
   - Add the brass "you" tick.
   - Give the dial `role="img"` with an accessible name that includes whose turn it is and when you are up.
   - The text beside it always carries the meaning.
4. **Token glyphs.** Redraw all six from silhouettes of the actual 3D models before shipping. The bull reads as a boar or rhino at 22 to 30px. Check every glyph at 22px in the feed.
5. **Primary button.** Flatten the brass gradient to a near-solid metal with a subtle top highlight. Allow one filled brass button per view, so it does not read as today's gold pill recoloured.
6. **Trade builder on phone.**
   - The two 174px columns wrap station names and use 10px swatches.
   - Below about 420px, stack "You give" over "You get", or use full-width tiles.
   - Keep every tile at least 44px and the swatches at least 12px with C's ring.
7. **Group colours on navy.** Brown `#8B4513`, dark blue `#2B4BCB` and stations fail 3:1. Adopt the lifted values (from A) in both `lib/board.js` `PROPERTY_COLORS` and the 3D bands, and keep the inner ring.
8. **Board staging first.** Prototype it in the real react-three-fiber scene before restyling the chrome:
   - navy table with a baked lamp texture,
   - lacquer slab sides with the brass inlay ring,
   - hemisphere, key and rim light changes,
   - brass pucks.

   Screenshot it on an iPhone and check that the cream tiles are not washed out under NeutralToneMapping and that redraw cost has not regressed. The mockup board is only a recoloured still.
9. **Small-phone layout.** Specify the 375×667 case for the buy and debt phases, where the dial bar, tall panel and tab bar leave very little board. Collapse the quiet row, and let the camera frame the current player's side as the design.md proposes.
10. **Debt copy and order.** Name the creditor ("Raise $120 to pay youngeun"). Keep Pay visible and disabled with the reason at 4.5:1. Keep "Sell or mortgage" as the way forward. Declare bankruptcy opens the existing confirm dialog.
11. **Desktop bank footer.** "The bank has 26 houses and 10 hotels left" must be derived client-side from the existing 32-house supply (Spaces.jsx `HOUSE_LIMIT`, API.md) and current buildings. It must not become a new server feature; if it can't be derived cleanly, drop it. The brief allows no new features.
12. **Dark-only details.**
    - Set `<meta name="theme-color" content="#101A2D">` and the safe-area colours.
    - Make sure disabled buttons (`#7D879C` on `#141F33`) always have their reason underneath at 4.5:1 or better.
    - Re-verify `--slate` on `--raised` (5.6:1) wherever the timestamps sit on toasts and sheets.
