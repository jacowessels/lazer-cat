# Lazer Cat 🔴🐈

A browser game: you control a laser pointer dot and must guide it from the start
circle to the checkered finish without a cat pouncing on it.

The cats behave a bit like real cats:

| What the dot does | What the cat does |
|---|---|
| Sits still | Watches it intently (pupils dilate as it gets interested) |
| Moves slowly / small moves | Crouches, tail twitches, stalks closer |
| Moves fast / jiggles | Excitement builds → butt-wiggle (**warning!**) → **POUNCE** |
| Far away and exciting | Runs after it, then pounces |
| Cat misses | It's confused for a moment (`?`) — your chance to move on |

A cat aims its pounce at where the dot is going, and can steer a little in mid-air.
Get out of the way while it's wiggling!

## Controls

- **Mouse (PC):** click the red dot to pick it up, then move the mouse.
- **Touch (tablet/phone):** touch anywhere and swipe. The dot moves *with* your
  finger, so your finger never covers it.
- `Esc` / `P` pauses, `R` restarts the level.

In portrait mode the board turns vertical (start at the bottom, finish at the top).

## Levels

1. Big Lazy Tom — one big, slow cat
2. Mittens — a normal house cat
3. Two's Company — two cats
4. The Kitten — tiny, fast, twitchy
5. Shadow — black cat with a long jump
6. The Family — three cats
7. Cat Café — four cats

Levels 1–3 show an excitement ring around each cat (green → yellow → red) plus
its pounce range, to help you learn how the cats think. Progress is saved in the browser.

## Running it

There is no build step and there are no dependencies. Any of these works:

- Open `index.html` directly in a browser.
- Run a local server: `python3 -m http.server`, then open http://localhost:8000
- **Free hosting with GitHub Pages:** in the repo, go to *Settings → Pages*, set
  *Source: Deploy from a branch*, then choose the branch and `/ (root)`. The game
  will be live at `https://<user>.github.io/lazer-cat/`.

## Tweaking

All tuning is at the top of `game.js`:

- `CAT_TYPES` — each cat's personality: excitability, jump range, warning
  (windup) time, mid-air steering, recovery time, and so on.
- `LEVELS` — which cats appear where, the finish position, and whether hints are shown.
