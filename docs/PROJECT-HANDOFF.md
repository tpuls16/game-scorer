# Game Scorer — Project Handoff

Use this doc to continue work in a new chat without losing context.  
**Project path:** `/Users/tysonpulsipher/projects/apps/game-scorer`

---

## What this app is

A **vanilla HTML/CSS/JS** multi-game scorekeeper. No build step, no backend.

**Games:** **Skull King**, **Flip 7**, **Rook** (Tolman Rules).

Progress saves in **localStorage**:

| Key | Content |
|-----|---------|
| `skull-king-game` | Skull King in-progress / completed game |
| `game-scorer-flip7` | Flip 7 game |
| `game-scorer-rook` | Rook game |
| `game-scorer-profiles` | Household player profiles (shared across games) |

Run locally (required for JS modules):

```bash
cd ~/projects/apps/game-scorer
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).  
If port 8080 is in use: `lsof -i :8080` then `kill <PID>`, or use port 8081.

---

## File structure

```
game-scorer/
├── index.html
├── css/base.css              # Shell + Skull King (default) theme + shared UI
├── css/mobile.css            # Phone layout (~393px / iPhone 17 class), safe areas, touch targets
├── css/games/flip7.css
├── css/games/rook.css
├── js/main.js                # Entry → profiles, player-profile, profiles-page, shell
├── js/core/
│   ├── shell.js              # Home, routing, confirm dialog, game-over ← All games
│   ├── catalog.js            # GAMES list + createGameModules()
│   ├── profiles.js           # Household players CRUD + favorites (localStorage)
│   ├── profiles-page.js      # Home screen favorites list + other-players dropdown
│   ├── profile-chip.js       # Favorite chips + mountOtherProfilesDropdown()
│   ├── profile-favorite.js   # Star toggle button
│   ├── player-picker.js      # Game setup: favorites + dropdown + roster + guests
│   ├── player-profile-page.js # Per-player profile view (history stub)
│   └── ui-utils.js
├── js/games/
│   ├── README.md             # How to add a game
│   ├── skull-king/           # app.js, scoring.js, deck.js, index.js
│   ├── flip7/                # app.js, scoring.js, index.js
│   └── rook/                 # app.js, scoring.js, index.js
├── README.md
└── docs/PROJECT-HANDOFF.md
```

**Mental model:** `js/core/` = shared app; `js/games/<id>/` = one game each; register new games in `catalog.js`. See `js/games/README.md`.

---

## Household players (cross-cutting)

Saved under `game-scorer-profiles` as `{ version, profiles: [{ id, name, favorite }] }`.

### UX

| Surface | Favorites | Non-favorites |
|---------|-----------|---------------|
| **Home** (`profiles-view`) | Full list rows (star, rename, delete, profile) | **Other household players** `<select>` → manage one player below |
| **Game setup** (`createPlayerPicker`) | Tappable chips (★ name) + Profile button | Same dropdown → add to “Playing this game” roster |

- Star toggle **only on home** (removed from game setup chips).
- New players are non-favorite by default; adding a name on home opens them in the “other” detail panel.
- Sort: favorites first, then A–Z (`compareProfiles` in `profiles.js`).
- **No players pre-selected** when starting a new game (user taps chips / dropdown / guests).

### Key modules

| File | Role |
|------|------|
| `profiles.js` | `loadProfiles`, `loadProfilesSplit`, `addProfile`, `toggleProfileFavorite`, `subscribeProfiles` |
| `profile-chip.js` | `renderFavoriteProfileChips`, `mountOtherProfilesDropdown` |
| `player-picker.js` | Roster + guests; uses split UI above |

Player **profile** page (`player-profile-view`) is a stub (“game history coming soon”). Opened via **Profile** on chips / list rows; back returns to home or setup via `profileBackContext`.

---

## Rule sources (important)

| Source | Used for |
|--------|----------|
| **Simplified Rulebook** (`Skull_King_Simplified_Rulebook_US_WEB_…pdf`) | **“Base game”** — what the user means by base |
| **Expansion Rulebook** (`Skull_King_Expansion_Rulebook_Web.pdf`) | Expansion pack cards + scoring |
| [rookgame.com/official-rules](https://rookgame.com/official-rules/) | Reference for **Tolman Rules** (family plays Kentucky West(ish)–style Rook) |

When the user says **“base game”** for Skull King, they mean the Simplified Rulebook setup (Loot/Kraken/White Whale removed), **not** “everything in the box.”

---

## Deck composition (Skull King — as implemented)

### Base game — 70 cards

**In deck:**
- Suited 1–14 × 4 suits (56): Parrot/green, Pirate Map/purple, Treasure Chest/yellow, Jolly Roger/black (trump)
- 5 Pirates, 1 Tigress, 1 Skull King, 2 Mermaids, 5 Escapes (14)

**Removed before base play** (in box but not in base deck/scoring):
- Loot (2), Kraken (1), White Whale (1), Blank cards (4)

### Expansion — +19 cards → 89 total

- 7, 8, 0/14 × 4 suits (12), Wild 15 (1)
- Mary Thorne, First Mate Con, Spotted Stingray, Davy Jones' Locker, Walk the Plank, The Last Volley (6)
- Reference/blanks in pack are **not** counted in deck size

---

## Scoring rules — Skull King (implemented)

Bonuses/penalties only apply when the player **makes their exact bid**.

### Base bid scoring

| Situation | Points |
|-----------|--------|
| Bid 1+ exact | +20 per trick |
| Bid 1+ miss | −10 per trick off |
| Bid 0, 0 tricks | +10 × **cards dealt that round** |
| Bid 0, any tricks | −10 × **cards dealt that round** |

**Note:** Zero-bid scoring uses **cards dealt**, not round number. This was fixed to match the Simplified Rulebook.

### Base bonuses (`scoring.js` → `BASE_BONUS_FIELDS`)

| Event | Pts | Max input |
|-------|-----|-----------|
| 14 (Parrot / Pirate Map / Treasure Chest) | +10 | 3 |
| 14 trump (Jolly Roger) | +20 | 1 |
| Mermaid captured by Pirate | +20 | 2 |
| Pirate captured by Skull King | +30 | 5 |
| Skull King captured by Mermaid | +40 | 1 |

Tigress as Pirate uses normal Pirate→Skull King bonus. No separate Tigress field.

### Expansion bonuses (only if “Using expansion pack” checked)

| Event | Pts |
|-------|-----|
| Expansion 8 captured | +5 each |
| Expansion 7 captured | −5 each |
| First Mate Con → Skull King or Mermaid | +30 |
| Sea monsters via Davy Jones (Kraken, White Whale, Spotted Stingray) | +20 each |

**Not scored in app** (gameplay-only or no bonus per rules): Wild 15, expansion 0/14s, Mary Thorne (counts as normal Pirate), Walk the Plank, Last Volley, Spotted Stingray trick rules, base Loot/Kraken/White Whale.

### Round & player configuration

- **Default:** 10 rounds, 1 card → 10 cards (+1 each round), capped by deck
- **Max players:** 10
- **Deck caps:** `floor(deckSize / numPlayers)` — see `deck.js`
  - 8 players, base: max 8 cards/round (rounds 9–10 deal 8, per rulebook)
  - 10 players, base: max 7; expansion: max 9

Setup and **Game Settings** (mid-game) share the same round-schedule UI logic via `renderRoundSchedule()` with `setupScheduleEls` vs `settingsScheduleEls`.

---

## Features built

### Skull King

1. **Round history** — Click completed round pills (R1…) or scoreboard cells to view read-only bid/trick/bonus breakdown
2. **Expansion scoring** — Checkbox at new game + settings
3. **Configurable rounds/cards** — Total rounds, start cards, increment, per-round grid with auto-cap
4. **Base rulebook alignment** — 70-card base deck, zero-bid uses cards dealt, updated bonus labels/limits
5. **Exit confirmation** — Custom modal for New Game / Play Again (not browser `confirm`)
6. **In-match Game Settings** — Edit players, expansion, rounds, cards without starting over; recalculates stored scores; warns when removing players with data
7. **Household player picker** — Favorites + dropdown + guests (see above)

### Flip 7

1. **Card-picker round entry** — Per player: tap number cards **0–12**, modifiers **×2** and **+2/+4/+6/+8/+10**, or **Bust**
2. **Auto Flip 7 bonus** — Selecting **7** number cards applies the Flip 7 bonus (no manual checkbox)
3. **Configurable bust penalty** — Setup/settings: enter **points lost** (0–100, default 0); stored as negative round score
4. **Total score floor** — `getTotalScore()` uses `Math.max(0, sum)` so standings never go negative (round cells can still show negative round totals)
5. **Round history + edit** — View past rounds; **Edit this round** reopens the card picker
6. **In-match Game Settings** — Players, winning score, Flip 7 bonus, bust penalty; recalculates stored rounds
7. **Household player picker** — Same pattern as Skull King

**Not built:** Rulebook card images on buttons (attempted PDF crop; `assets/` removed — UI uses text buttons only).

### Rook (Tolman Rules)

**Rule label in app:** **Tolman Rules** (aligned with [Kentucky West(ish)](https://rookgame.com/official-rules/) on rookgame.com).  
**Players:** Exactly **4** — partners = 1st & 2nd listed vs. 3rd & 4th.

#### Rules summary (implemented in `rook/scoring.js`)

| Topic | Detail |
|-------|--------|
| Deck | 57 cards; **1 high** in each suit (above 14); **Rook** = lowest trump |
| Counters | 1=15, 14=10, 10=10, 5=5, Rook=20 → **180**/hand in play |
| Kitty | Last trick winner’s team gets kitty points (entered separately) |
| Sweep | All **180** in tricks → **+20** (200 total for that team) |
| Bid | **50–180**, step **5**, default **120** (stepper UI) |
| Bid/set | Make bid → both teams score hand totals; set → bidder **−bid**, other team keeps counters |
| Win | Default **500** (configurable 100–1000 in setup/settings) |

#### Hand scoring UI (`rook/app.js`)

- **Bid stepper** — not free-form number input
- **Per team:** **Bid** / **Kitty** toggle buttons next to team label; **points in tricks** (single number; Rook included in total if taken)
- **Kitty points** field; **Kitty** team required only when kitty points **> 0** (buttons always visible)
- **Validation:** Team trick points + kitty must equal **180** before **Score Hand** (live preview; submit disabled until valid)
- **Bidding team:** **Bid** button on one team row (no dropdown)

#### Other behavior

- Hand limit optional (`totalHands`, default 8); game also ends at target score
- **Game Settings** — players, winning score, hand count
- **End game** / hand limit → game over panel
- **← All games** on game over (returns home; does not clear saves — same as setup back)
- Legacy saves with per-card `teamCounts` migrate to `trickPoints` on load

---

## Game state shape (localStorage)

### Skull King (`skull-king-game`)

```javascript
{
  players: [{ name: string, rounds: [RoundResult, ...] }, ...],
  currentRound: number,
  completed: boolean,
  useExpansion: boolean,
  totalRounds: number,
  cardsPerRound: number[],   // cards dealt each round, length = totalRounds
}
```

Each `RoundResult` includes: `round`, `cardsDealt`, `bid`, `tricks`, `bonuses`, `baseScore`, `bonusScore`, `total`, `madeBid`.

Normalized in `skull-king/app.js` → `normalizeSavedGame()`.

### Flip 7 (`game-scorer-flip7`)

```javascript
{
  gameId: "flip7",
  players: [{ name: string, rounds: [Flip7RoundResult, ...] }, ...],
  currentRound: number,
  completed: boolean,
  targetScore: number,      // default 200, range 50–500
  flip7Bonus: number,      // default 15, range 0–50
  bustPoints: number,       // stored ≤ 0; 0 = official bust; e.g. -10 = lose 10 pts that round
}
```

Each `Flip7RoundResult` includes: `round`, `busted`, `numberCards` (number[]), `x2`, `plusModifiers` (number[]), `flip7`, computed fields (`numberSum`, `multiplied`, `total`, …).

Legacy saves (manual `numberSum`, `plusModifier`, `extraPlus`, manual `flip7` flag) are normalized in `scoring.js` → `normalizeRoundInput()`.

### Rook (`game-scorer-rook`)

```javascript
{
  gameId: "rook",
  players: [{ name: string }, ...],   // length 4
  teams: [[0, 1], [2, 3]],
  teamLabels: [string, string],       // "Alice & Bob", ...
  rounds: [RookHandResult, ...],
  currentHand: number,
  totalHands: number,
  targetScore: number,                // default 500
  completed: boolean,
}
```

Each `RookHandResult` includes: `hand`, `bid`, `biddingTeam` (0|1), `trickPoints` [n,n], `kittyTeam`, `kittyPoints`, `teamCardPoints`, `teamScores`, `madeBid`, `sweepTeam`.

### Household profiles (`game-scorer-profiles`)

```javascript
{ version: 1, profiles: [{ id: string, name: string, favorite: boolean }, ...] }
```

---

## UI views

| View | When |
|------|------|
| Home | `home-view` — game picker + **Household players** (favorites + other dropdown) |
| Setup | `setup-view` + game-specific setup panel (`skull-king-setup`, `flip7-setup`, `rook-setup`) |
| Active game | `game-view` + per-game panel |
| Game over | `game-over-view` + per-game over panel; **← All games** toolbar (`game-over-back-to-home-btn`) |
| Player profile | `player-profile-view` — stub history |
| Round detail | Skull King: `round-detail-view`; Flip 7: `flip7-round-detail-view` |
| Exit confirm | `confirm-dialog` — New Game / Play Again (clears via `exitToHome()` when confirmed) |
| Game settings | Per-game settings dialogs |

**Resume on load** (`shell.js` → `initFromSavedGame()`): skull-king → flip7 → rook (first match wins).

**Themes:** `document.body.dataset.theme` = `skull-king` | `flip7` | `rook` | `""` on home.

---

## Flip 7 (reference)

**Rule reference:** The Op / official Flip 7 (press-your-luck, 94-card deck). Number cards 0–12; modifiers ×2, +2, +4, +6, +8, +10 (one each); Flip 7 = 7 unique number cards → +15 bonus (configurable).

### Setup options (new game + Game Settings)

| Option | Default | Range | Notes |
|--------|---------|-------|-------|
| Winning score | 200 | 50–500 | Game ends when someone reaches this **after** a round |
| Flip 7 bonus | 15 | 0–50 | Added when 7 number cards selected |
| Bust penalty (points lost) | 0 | 0–100 | UI enters a **positive** number; app stores **negative** round total |
| Players | — | 3–18 | Official minimum 3 |

### Round scoring (`scoring.js` → `calculateFlip7RoundScore`)

1. If **busted** → round `total` = `bustPoints`
2. Else sum selected **number cards**
3. If **×2** selected → double number sum only
4. Add **+ modifier** values
5. If **7+ number cards** → add Flip 7 bonus

**Displayed total** (`getTotalScore`): sum of round totals, **floored at 0**.

---

## Cursor / chat tip

Chats are tied to the **workspace folder open in Cursor**, not the project files themselves. If history seems missing, open the same folder (`projects/apps/game-scorer`) or check **Previous Chats**. Transcripts may live under `~/.cursor/projects/` with encoded folder names.

---

## Likely next steps (discussed but not built)

### Cross-app

- **Player profile game history** — wire `player-profile-page.js` to past games / stats
- Export score sheet (PDF) for any game

### Skull King

- Per-card toggles for which expansion/advanced cards are in the deck
- Loot / Kraken / White Whale scoring (advanced rules)
- Rascal scoring mode
- Separate field for Mary Thorne if desired

### Flip 7

- Rulebook card art on picker buttons (needs licensed assets)
- Action cards (Freeze, Flip Three, Second Chance) if tracking in-app

### Rook

- Round/hand history drill-down (like Skull King round pills)
- Undo/edit past hand
- Optional: remember last bid / last kitty team per session

---

## Local dev notes

- Run `python3 -m http.server 8080` in the project root; keep the terminal open while testing.
- If port 8080 is stuck: `lsof -ti :8080 | xargs kill`, then restart.
- No `assets/` folder in repo — images are not used by the app.

## Git & GitHub Pages

- **Deploy guide:** [DEPLOY-GITHUB-PAGES.md](./DEPLOY-GITHUB-PAGES.md)
- **Workflow:** `.github/workflows/deploy-pages.yml` — deploys static site on push to `main`
- **Live URL pattern:** `https://<github-user>.github.io/<repo-name>/`
- **Version control:** standard `git add` / `commit` / `push`; no build step required

---

## Key functions to know

### Shell (`js/core/shell.js`)

| Function | Purpose |
|----------|---------|
| `showView(view, gameId)` | home / setup / game / over / player-profile |
| `showHomeView()` | Game picker; does **not** clear game storage |
| `showExitGameConfirm(fn)` | Confirm then run fn (often `exitToHome`) |
| `exitToHome()` | `clearGame()` on **all** modules, then home |
| `initFromSavedGame()` | Resume first saved game among SK / Flip7 / Rook |

### Household (`js/core/`)

| Function | Purpose |
|----------|---------|
| `loadProfilesSplit()` | `{ favorites, others }` |
| `renderFavoriteProfileChips()` | Setup/game chips for favorites only |
| `mountOtherProfilesDropdown()` | Shared `<select>` for non-favorites |
| `createPlayerPicker()` | Full setup roster UX |
| `sumHandCounters` / `handScoringIsReady` | Rook 180-point validation (`rook/scoring.js`) |

### Skull King (`js/games/skull-king/app.js`)

| Function | Purpose |
|----------|---------|
| `startGame()` | Create game from setup |
| `scoreCurrentRound()` | Submit round form |
| `undoLastRound()` | Remove last round data |
| `openGameSettings()` / `saveGameSettings()` | Mid-game edits |
| `recalculateStoredRoundScores()` | Re-run scoring after settings change |
| `renderRoundSchedule()` | Setup/settings round grid |

### Flip 7 (`js/games/flip7/app.js` + `scoring.js`)

| Function | Purpose |
|----------|---------|
| `buildPlayerRoundFields()` | Card-picker UI per player |
| `readPlayerRoundFromCard()` / `readCardPickerState()` | Form → round data |
| `calculateFlip7RoundScore()` | Official scoring order + bust |
| `getTotalScore()` | Player total (min 0) |
| `normalizeRoundInput()` | Legacy + new round field shapes |
| `openRoundDetail()` / `saveEditedRound()` | View/edit past rounds |

### Rook (`js/games/rook/app.js` + `scoring.js`)

| Function | Purpose |
|----------|---------|
| `calculateHandScore()` | Bid/set, kitty, sweep, team totals |
| `countersTotalIsValid()` / `describeCountersTotal()` | 180-point gate |
| `scoreCurrentHand()` | Submit hand; push to `rounds` |
| `setBidValue()` | Bid stepper 50–180 |
| `selectExclusiveTeamButton()` | Bid / Kitty team toggles |
| `normalizeSavedRound()` | Migrate `teamCounts` → `trickPoints` |
| `buildTeamLabels()` | Partner display names |

Register games in `catalog.js` → `createGameModules(shell)`.

---

## User context

- Recent software engineering graduate, learning by building
- Knows Python, HTML, CSS; newer to JavaScript
- Prefers step-by-step explanations when walking through code
- Project folder: `~/projects/apps/game-scorer` (renamed from `skull-king-scorer`)
- Family Rook uses **Tolman Rules** (Kentucky-style per rookgame.com)

---

*Last updated: June 2026*
