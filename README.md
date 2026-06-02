# Game Scorer

A simple web app to track scores for family games. Pick a game on the home screen; each game has its own module, theme, and saved progress.

**Included games:** [Skull King](https://www.grandpabecksgames.com/pages/skull-king), [Flip 7](https://theop.games/pages/flip-7), Rook

## How to run

Because this app uses JavaScript modules, you need a local web server (opening `index.html` directly in a browser won't work).

**Option 1 — Python (built into Mac):**

```bash
cd game-scorer
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

**On your phone (same Wi‑Fi):** run the server with `python3 -m http.server 8080 --bind 0.0.0.0`, then open `http://<your-mac-ip>:8080` in mobile Safari/Chrome. The UI is optimized for iPhone-sized screens (~393px wide); use **Add to Home Screen** for quick access.

**Option 2 — VS Code / Cursor Live Server:**

Install the "Live Server" extension, right-click `index.html`, and choose "Open with Live Server".

## Git & GitHub Pages (live URL for phones)

This project is set up for **Git** and automatic deploy to **GitHub Pages** on push to `main`.

1. Follow **[docs/DEPLOY-GITHUB-PAGES.md](docs/DEPLOY-GITHUB-PAGES.md)** to create the repo, push, and enable Pages.
2. Your live app will be at `https://<your-github-username>.github.io/game-scorer/` (exact path depends on repo name).
3. Share that link with family; no Mac server required after deploy.

```bash
git add .
git commit -m "Your change description"
git push   # triggers deploy (~1–2 min)
```

## How to use

Pick a game on the home screen. Progress saves automatically in your browser (separate storage per game).

### Household players

On the home screen, add **Household players** (e.g. Mom, Dad, Tyson). Star **favorites** to show them on the home screen and in game setup; other saved players are in the **Other household players** menu. When you start a game, tap favorites or pick from that menu, or use **Add guest** for someone playing just that night.

### Skull King

1. Add player names (2–10 players), configure rounds, and click **Start Game**.
2. Set **Rounds**, **Start with**, and **Add each round** (default: 10 rounds, 1→10 cards). Edit any round individually in the schedule grid.
3. Each round, enter each player's **bid** and **tricks won** (capped to cards dealt that round).
4. Expand **Bonus cards** if anyone earned bonuses (only counts if they made their exact bid).
5. Click **Score Round** — the app calculates everything and moves to the next round.
6. When all rounds are done, see final standings.

### Flip 7

1. Choose **Flip 7** on the home screen (3+ players).
2. Set winning score (default 200) and Flip 7 bonus (default 15) if you like.
3. Each round, enter each player’s number-card total, modifiers (×2, +2…+10), Flip 7 bonus, or mark **Busted**.
4. Use **Game Settings** to change target/bonus/players; click a past round to **Edit this round**.
5. Game ends when someone reaches the winning score.

### Rook

Uses **Tolman Rules** (see [rookgame.com/official-rules](https://rookgame.com/official-rules/) for reference).

1. Choose **Rook** (exactly 4 players). Partners: 1st & 2nd vs. 3rd & 4th in the player list.
2. **Counters in tricks:** 1 = 15, 14 = 10, 10 = 10, 5 = 5, Rook = 20 (**180** per hand). **1 is high** in each suit; Rook is the **lowest** trump.
3. Each hand: set **high bid** (50–180, default 120), tap **Bid** next to the bidding team, enter each team’s **points in tricks** (Rook included if taken), and **kitty points** (tap **Kitty** next to the last-trick winner when the kitty has points). Trick points for both teams plus kitty must total **180** before you can score the hand.
4. **Sweep:** all 180 counters in tricks → **+20** bonus (200 total). **Bid/set:** make the bid or lose it; other team keeps their counters.
5. First team to **500** wins (default; adjustable in setup).

## Project structure

```
game-scorer/
├── index.html              # Shared layout + per-game HTML sections
├── css/
│   ├── base.css            # App shell + default (Skull King) theme
│   ├── mobile.css          # Phone layout & touch targets
│   └── games/
│       ├── flip7.css
│       └── rook.css
├── .github/workflows/
│   └── deploy-pages.yml    # GitHub Pages deploy on push to main
├── js/
│   ├── main.js             # Entry point
│   ├── core/
│   │   ├── shell.js        # Home, routing, dialogs
│   │   ├── catalog.js      # Game list + module registration
│   │   ├── profiles.js     # Saved household players (localStorage)
│   │   ├── profiles-page.js
│   │   ├── player-picker.js # Setup/settings player selection UI
│   │   └── ui-utils.js     # Shared form helpers
│   └── games/
│       ├── README.md       # How to add a new game
│       ├── skull-king/     # app.js, scoring.js, deck.js
│       ├── flip7/          # app.js, scoring.js
│       └── rook/           # Rook (Tolman Rules) — app.js, scoring.js
└── docs/
    ├── PROJECT-HANDOFF.md
    └── DEPLOY-GITHUB-PAGES.md
```

To add another game, see `js/games/README.md`.

## Skull King: round & deck limits

The app caps cards per round based on deck size and player count (same approach as the rulebook when the deck runs short):

| Deck | Cards | Notes |
|------|-------|-------|
| Base game | 70 | Loot, Kraken, and White Whale removed |
| + Expansion pack | 89 | Base deck plus expansion cards |

## Skull King: scoring rules (base game)

| Situation | Points |
|-----------|--------|
| Bid 1+ and made exact bid | +20 per trick |
| Bid 1+ and missed bid | −10 per trick off (no trick points) |
| Bid 0 and won 0 tricks | +10 × **cards dealt** that round |
| Bid 0 and won any tricks | −10 × **cards dealt** that round |

**Bonuses** (only when bid is exact): see in-app labels; expansion pack optional at setup.

## Ideas to extend

- Cloud sync / game history (profiles are stored locally today under `game-scorer-profiles`)
- New games under `js/games/<name>/`
- Skull King: Rascal mode, PDF export, per-card deck toggles
