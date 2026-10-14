# Polymono: the post-redesign batch (2026-10-14)

Decisions for the features built after the Midnight Deco redesign. backend/API.md is the contract once they ship.

## Gameplay

**Sealed-bid auctions, alongside play.** Declining a property (or the turn timer declining it) puts it up for
auction and the game carries on: the next turn starts at once.
- Every active player may bid, the decliner included. One hidden bid each, revisable until close, in whole
  dollars from $10 up to the bidder's cash at the time; a bid of 0 means "pass".
- It closes 12 hours after it opens, or as soon as every active player has bid or passed.
- The highest bid wins; a tie goes to the earliest bid. If the winner can no longer pay at close, the next bid
  wins. Nobody bidding leaves it with the bank. At close every bid is revealed in the feed.
- While on the block the property can't be bought or charged for: landing on it does nothing.
- Several auctions can run at once. A bankrupt player's bids are dropped.

**Game length.** The host sets these in the lobby before starting (admins can too):
- Ends on a date: when the time comes the game ends and the highest net worth wins (the result is saved like
  any other game). The top bar shows when and your place.
- Starting deeds: deal 0, 2 or 3 random properties to each player at the start, who pays the list price
  (Monopoly's own time-limit rules).
- Speed die (below), off by default.

**Standing orders and vacation.** Per player, from the user menu:
- Roll automatically when my turn starts.
- Buy automatically when the price is at most $X and leaves me at least $Y; otherwise pass (which starts an
  auction). Without a rule the turn stops for me to decide.
- In Rikers: use a card, pay $50, or roll for doubles.
- Vacation until a date: everything above happens automatically, debts are raised by selling buildings and then
  mortgaging the cheapest properties outside complete sets, and trades wait for my return.
- Automated turns run about a minute after the turn starts, so others can follow, and are marked as automatic in
  the feed.

**Speed die** (Monopoly's official rules), once a player has passed GO for the first time:
- A third die with 1, 2, 3, Mr. Monopoly (twice) and a bus.
- A number adds to the move. Triples (all three the same number) let you move to any space you choose.
- Mr. Monopoly: move by the two dice and resolve the space, then advance to the next unowned property (buy it or
  it goes to auction); if everything is owned, to the next property where you would owe rent.
- Bus: choose to move by either die or by their sum.
- Doubles and three-doubles jail work as usual and ignore the speed die; it isn't used from Rikers.
- Automated and timed-out turns take the sum for the bus and for triples.

**Build a full round.** One tap builds one house on every property of a set (evenly, as a single action), with
the total cost shown first.

## Social

- **Reactions** on feed lines: a small set of drawn reactions (no emoji), one tap to add or remove yours, counts
  and who reacted visible to everyone, kept with the game's log.
- **Last seen**: "online", or "seen 3h ago" next to players in the lobby and the game.
- **Leaderboard**: all-time and this year, from saved results: games, wins, average place, best net worth.

## Experience

- Sheets close with a downward swipe on phones (as well as close, tapping outside and Esc).
- Trades show what they do to colour sets ("completes jack's orange set", "breaks up your pinks").
- "Replay what you missed": the board replays the moves since you last looked, quickly, from the away summary.

## Notifications

- Web push as well as ntfy: the site becomes an installable app (manifest, a push-only service worker), and a
  player can turn on notifications for that device in Turn alerts. iPhones need the site added to the Home
  Screen first. The same events as the ntfy alerts, only while the player is offline.

## Operations

- CI on GitHub Actions: backend tests, frontend lint and build, on every push.
- Offsite backups: the nightly and pre-deploy dumps are also copied to S3 (personal account, encrypted, 90 days).
- A watchdog on the box alerts an ops ntfy topic when the backend restarts repeatedly or the health check fails,
  and when a backup fails.
