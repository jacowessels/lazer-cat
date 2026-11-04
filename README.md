# Lazer Cat 🔴🐈

A browser game: you control a laser pointer dot and must guide it from the start
circle to the checkered finish — and hold it there for a moment — without a cat pouncing on it.
The hold ring (green) only fills while no cat nearby is chasing or about to pounce (orange).

The cats behave a bit like real cats:

| What the dot does | What the cat does |
|---|---|
| Sits still far away | Watches it intently (pupils dilate as it gets interested) |
| Moves slowly / small moves | Crouches, tail twitches, stalks closer |
| Moves fast / jiggles | Excitement builds → butt-wiggle (**warning!**) → **POUNCE** |
| Races past | Snap-pounce with hardly any warning, or a quick chase |
| Zips right under its nose | Paw swipe — caught! |
| Sits still *next to* a stalking cat | It loses patience and pounces anyway |
| Starts moving suddenly after resting | Instant spike of excitement |
| Cat misses | It's confused for a moment (`?`) — your chance to move on (but it may strike again quickly) |

Cats aim where the dot is *going*, steer in mid-air, and the clever ones cut you off on the
way to the finish and won't waste a jump that can't reach. Sleeping cats (`z`) wake up if you
come too close or move too fast near them. The way through: move slowly, keep your distance,
dodge when a cat wiggles — and once it's airborne, cut sideways.

## Controls

- **Mouse (PC):** click the red dot to pick it up, then move the mouse — the dot sits exactly under it.
- **Touch (tablet/phone):** touch anywhere and swipe. The dot moves *with* your
  finger, so your finger never covers it. Fast swipes throw it further, like mouse acceleration.
- `Esc` / `P` pauses, `R` restarts the level.

In portrait mode the board turns vertical (start at the bottom, finish at the top).

## Levels

1. Big Lazy Tom · 2. Mittens · 3. Two's Company · 4. The Kitten · 5. Shadow ·
6. Sleepy Head · 7. The Professor · 8. The Family · 9. Ninja · 10. Nap Time ·
11. Guard Duty · 12. The Wall · 13. Cat Café · 14. Night Shift · 15. Double Trouble ·
16. Crazy Cat House

Cats: Big Tom (big, slow), Mittens (house cat), Pip (twitchy kitten), Shadow (long jumper),
Biscuit (huge calico), Professor Miso (clever Siamese), Ninja (tuxedo ambusher).

Levels 1–3 show an excitement ring around each cat (green → yellow → red) plus
its pounce range. Progress is saved in the browser.

## Running it

There is no build step and there are no dependencies. Any of these works:

- Open `index.html` directly in a browser.
- Run a local server: `python3 -m http.server`, then open http://localhost:8000
- **Free hosting with GitHub Pages:** in the repo, go to *Settings → Pages*, set
  *Source: Deploy from a branch*, then choose the branch and `/ (root)`. The game
  will be live at `https://<user>.github.io/lazer-cat/`.

## Tweaking

All tuning is at the top of `game.js`:

- `TOUCH_ACCEL`, `TOUCH_GAIN_MAX` — touch "sensitivity": the dot follows your mouse exactly,
  and on touch screens fast swipes throw it further (pointer acceleration), slow ones stay precise.
- `FINISH_HOLD` — how long the dot must rest on the flag to finish.
- `CAT_TYPES` — each cat's personality: excitability, jump range, warning
  (windup) time, mid-air steering, recovery time, and so on.
- `LEVELS` — which cats appear where (and whether asleep), the finish position,
  hints, and `boost` (how excitable the cats are on that level).
- `tools/balance.js` — plays every level with bots and prints win rates, to check
  difficulty after tuning (needs Playwright).
