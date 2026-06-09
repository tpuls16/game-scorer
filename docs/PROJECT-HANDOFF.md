# Game Scorer — Project Handoff

Use this doc to continue work in a new chat without losing context.  
**Project path:** `/Users/tysonpulsipher/projects/apps/game-scorer`

---

## Current status (June 2026)

| Area | State |
|------|--------|
| **App** | Vanilla HTML/CSS/JS on `main`; **login required** before game picker. One **family account** = one group (players, games, history). Data scoped **per auth account** (`localStorage` keys include `{userId}`) |
| **Live site** | **https://tpuls16.github.io/game-scorer/** via GitHub Pages (push to `main` deploys ~1–2 min). No service worker — browsers may cache old JS (see [Clearing live-site cache](#clearing-live-site-cache)) |
| **Supabase** | `game-scorer-db`: email + password auth + **family username** (sign in with username **or** email). **Saved players** → `player_profiles` (RLS per user). **Family usernames** → `account_usernames`. In-progress games + game history stay **local** per account |
| **Themes** | Separate **home** hub theme (`css/home.css`) and **Skull King** theme (`css/games/skull-king.css`); Flip 7 / Rook keep their game CSS |

**Removed (obsolete):** Households, join codes, household picker, switch household. Different friend/family groups use **separate accounts** (e.g. `PulsFam` vs another login), not households within one login.

---

## What this app is

A **vanilla HTML/CSS/JS** multi-game scorekeeper. No build step. **Supabase** provides auth + Postgres (no custom Node/Vercel server).

**Games:** **Skull King**, **Flip 7**, **Rook** (Tolman Rules).

**Boot order** (`js/main.js`): `initAuth` → `initProfileSync` → `initAuthPage` → `startApp`.

**Sign in:** family **username** (e.g. `PulsFam`) **or** email + password. Sign up requires email, password, and a unique family username (3–32 chars: letters, numbers, underscores).

Progress saves in **localStorage** (scoped per signed-in account via `user-storage.js`):

| Key pattern | Content |
|-------------|---------|
| `game-scorer-profiles-{userId}` | Saved players — local cache + cloud sync when signed in |
| `game-scorer-history-{userId}` | Completed game history (per account) |
| `skull-king-game-{userId}` | Skull King in-progress / completed game |
| `game-scorer-flip7-{userId}` | Flip 7 game |
| `game-scorer-rook-{userId}` | Rook game |

On sign-in, `migrateLegacyProfilesForUser` and `migrateAccountScopedStorage` import older keys once (including legacy `game-scorer-profiles` and former household-scoped keys).

**Run locally** (required for JS modules):

```bash
cd ~/projects/apps/game-scorer
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).  
If port 8080 is in use: `lsof -ti :8080 | xargs kill`, then restart.

**Run on phones (no Mac server):** use GitHub Pages — **https://tpuls16.github.io/game-scorer/** (see [Git & GitHub Pages](#git--github-pages) below).

---

## File structure

```
game-scorer/
├── index.html
├── css/base.css              # Shared shell UI (layout, buttons, forms)
├── css/home.css              # Home hub + auth + saved players theme
├── css/mobile.css            # Phone layout (~393px / iPhone 17 class), safe areas, touch targets
├── css/games/skull-king.css  # Skull King theme (loaded via catalog.js)
├── css/games/flip7.css
├── css/games/rook.css
├── js/main.js                # Entry → auth, sync, auth-page, shell
├── js/supabase-config.js     # SUPABASE_URL, SUPABASE_ANON_KEY, APP_URL
├── js/core/
│   ├── supabase-client.js    # createClient (CDN ESM)
│   ├── auth.js               # Sign up / sign in (username or email) / sign out
│   ├── family-username.js    # RPC helpers: resolve login, register username, availability
│   ├── account-username.js   # Load/display family username in header
│   ├── auth-page.js          # Sign-in gate UI + header (username, sign out)
│   ├── user-storage.js       # scopedStorageKey() — per-account localStorage keys
│   ├── profile-sync.js       # player_profiles ↔ scoped localStorage when signed in
│   ├── game-history.js       # Per-account completed game history (local)
│   ├── game-players.js       # Map roster refs ↔ game player shapes
│   ├── shell.js              # Views, routing, auth gate, game-over ← All games
│   ├── catalog.js            # GAMES list + createGameModules()
│   ├── profiles.js           # Saved players CRUD + favorites (scoped local + cloud hook)
│   ├── profiles-page.js      # Home favorites list + other-players dropdown
│   ├── profile-chip.js       # Favorite chips + mountOtherProfilesDropdown()
│   ├── profile-favorite.js   # Star toggle button
│   ├── player-picker.js      # Game setup: favorites + dropdown + roster + guests
│   ├── player-profile-page.js # Per-player profile + game history list
│   └── ui-utils.js
├── js/games/
│   ├── README.md             # How to add a game
│   ├── skull-king/           # app.js, scoring.js, deck.js, index.js
│   ├── flip7/                # app.js, scoring.js, index.js
│   └── rook/                 # app.js, scoring.js, index.js
├── supabase/migrations/      # player_profiles, account_usernames, RLS (household migrations superseded)
├── .gitignore
├── .github/workflows/deploy-pages.yml
├── README.md
└── docs/
    ├── PROJECT-HANDOFF.md
    └── DEPLOY-GITHUB-PAGES.md
```

**Mental model:** `js/core/` = shared app; `js/games/<id>/` = one game each; register new games in `catalog.js`. See `js/games/README.md`.

---

## Saved players (cross-cutting)

Home screen **Saved players** card (`profiles-view`). Names belong to the **signed-in account** — e.g. Mom, Dad, Tyson on the `PulsFam` login. **Guests** are name-only for a single game (not saved to the roster).

Stored under `game-scorer-profiles-{userId}` as `{ version, profiles: [{ id, name, favorite }] }` (cloud mirror in `player_profiles`).

### Account model

| Concept | How it works |
|---------|----------------|
| **Family account** | One login (email + password + family username) shared by everyone scoring on that device |
| **Family username** | Short name like `PulsFam` — used to sign in instead of email |
| **Saved players** | Roster for that account only |
| **Another group** | Create a **separate account** (e.g. for friends) — not a “household” under the same login |

**Auth RPCs:** `resolve_login_email`, `register_account_username`, `is_username_available`.

### UX

| Surface | Favorites | Non-favorites |
|---------|-----------|---------------|
| **Home** (`profiles-view`) | Full list rows (star, rename, delete, profile) | **Other saved players** `<select>` → manage one player below |
| **Game setup** (`createPlayerPicker`) | Tappable chips (★ name) + Profile button | Same dropdown → add to “Playing this game” roster |

- Star toggle **only on home** (removed from game setup chips).
- New players are non-favorite by default; adding a name on home opens them in the “other” detail panel.
- Sort: favorites first, then A–Z (`compareProfiles` in `profiles.js`).
- **No players pre-selected** when starting a new game (user taps chips / dropdown / guests).

### Key modules

| File | Role |
|------|------|
| `profiles.js` | `setProfilesUserId`, `loadProfiles`, `loadProfilesSplit`, `addProfile`, `toggleProfileFavorite`, `subscribeProfiles` |
| `profile-sync.js` | `syncAccountPlayers` — cloud pull/push on sign-in; `setAfterPersistCallback` pushes edits |
| `game-history.js` | `tryRecordGameHistory`, `getHistoryForProfile` — local per account |
| `profile-chip.js` | `renderFavoriteProfileChips`, `mountOtherProfilesDropdown` |
| `player-picker.js` | Roster + guests; uses split UI above |

Player **profile** page (`player-profile-view`) lists **game history** for saved players (clickable from home/setup). Guests appear as plain text in history. Opened via **Profile** on chips / list rows; back returns to home or setup via `profileBackContext`.

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
7. **Saved players picker** — Favorites + dropdown + guests (see above)
8. **Game history** — Completed games recorded per account; visible on player profile page

### Flip 7

1. **Card-picker round entry** — Per player: tap number cards **0–12**, modifiers **×2** and **+2/+4/+6/+8/+10**, or **Bust**
2. **Auto Flip 7 bonus** — Selecting **7** number cards applies the Flip 7 bonus (no manual checkbox)
3. **Configurable bust penalty** — Setup/settings: enter **points lost** (0–100, default 0); stored as negative round score
4. **Total score floor** — `getTotalScore()` uses `Math.max(0, sum)` so standings never go negative (round cells can still show negative round totals)
5. **Round history + edit** — View past rounds; **Edit this round** reopens the card picker
6. **In-match Game Settings** — Players, winning score, Flip 7 bonus, bust penalty; recalculates stored rounds
7. **Saved players picker** — Same pattern as Skull King
8. **Game history** — Recorded on game over via `tryRecordGameHistory`

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

Keys are scoped per auth user: `skull-king-game-{userId}`, `game-scorer-flip7-{userId}`, `game-scorer-rook-{userId}` (see `user-storage.js`).

### Skull King

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

### Flip 7

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

### Rook

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

### Game history (local shape, `game-scorer-history-{userId}`)

```javascript
[
  {
    id: string,
    gameId: string,
    gameName: string,
    completedAt: string,  // ISO
    players: [{ name, profileId?, guest?, score?, place?, detail? }, ...],
    standings?: [{ label, score, place }, ...],
    meta?: object,
  },
  ...
]
```

Recorded when a game completes (`tryRecordGameHistory` in each game's `renderGameOver`). Max 200 entries per account.

### Saved players (local shape, `game-scorer-profiles-{userId}`)

```javascript
{ version: 1, profiles: [{ id: string, name: string, favorite: boolean }, ...] }
```

---

## UI views

| View | When |
|------|------|
| Auth | `auth-view` — sign in / create account (**required** before home) |
| Home | `home-view` — game picker + **Saved players** |
| Setup | `setup-view` + game-specific setup panel (`skull-king-setup`, `flip7-setup`, `rook-setup`) |
| Active game | `game-view` + per-game panel |
| Game over | `game-over-view` + per-game over panel; **← All games** toolbar (`game-over-back-to-home-btn`) |
| Player profile | `player-profile-view` — game history for saved players |
| Round detail | Skull King: `round-detail-view`; Flip 7: `flip7-round-detail-view` |
| Exit confirm | `confirm-dialog` — New Game / Play Again (clears via `exitToHome()` when confirmed) |
| Game settings | Per-game settings dialogs |

**Resume on load** (`shell.js` → `initFromSavedGame()`): skull-king → flip7 → rook (first match wins). Only when **signed in**; otherwise `startApp` shows `auth-view`.

**Themes:** `document.body.dataset.theme` = `home` (home + profiles), `skull-king` | `flip7` | `rook` in setup/game/over. Home uses `css/home.css`; Skull King uses `css/games/skull-king.css` (see `catalog.js` → `stylesheet`). `shell.js` sets `theme = "home"` on home and player-profile views.

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

- **Deploy cache-busting** — optional `?v=` on script tags so phones pick up new JS without manual cache clear.
- **Cloud game history** — sync completed games to Supabase (currently local only).
- **Live scores** — show in-progress games for the signed-in account (was planned for households).
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

| Item | Value |
|------|--------|
| **Repo** | [github.com/tpuls16/game-scorer](https://github.com/tpuls16/game-scorer) |
| **Branch** | `main` |
| **Deploy guide** | [DEPLOY-GITHUB-PAGES.md](./DEPLOY-GITHUB-PAGES.md) |
| **Workflow file** | `.github/workflows/deploy-pages.yml` (workflow name: **Deploy to GitHub Pages**) |
| **Live URL** | **https://tpuls16.github.io/game-scorer/** |

### Auto-deploy workflow (where it lives)

File: **`.github/workflows/deploy-pages.yml`**

| Trigger | When |
|---------|------|
| `push` to `main` | Every `git push` updates the live site (~1–2 min) |
| `workflow_dispatch` | Manual run from GitHub → **Actions** → **Deploy to GitHub Pages** → **Run workflow** |

**Steps:** checkout repo → upload entire project root as static artifact → `actions/deploy-pages` publishes to GitHub Pages. **No build step** (plain HTML/CSS/JS).

**One-time repo setting:** **Settings → Pages → Build and deployment → Source: GitHub Actions**.

**After deploy on phone:** Safari may cache the old site; close the tab, hard refresh, or use a private window once if the UI looks stale.

### If Actions shows a failed run titled “Initial creation of Game Scorer”

That title is your **first commit message**, not a different broken workflow. The real workflow is **Deploy to GitHub Pages**.

**Typical failure (tpuls16 repo, run #1):** Checkout and Upload succeed; **Deploy to GitHub Pages** fails because **GitHub Pages was not turned on yet** in repo Settings.

**Fix (do in order):**

1. Open **https://github.com/tpuls16/game-scorer/settings/pages**
2. Under **Build and deployment** → **Source**, choose **GitHub Actions** (not “Deploy from a branch” yet).
3. Go to **Actions** → click the failed run → **Re-run all jobs** (top right).

When it passes (green check), return to **Settings → Pages** and copy the public URL.

**If it still fails:** open the failed **Deploy to GitHub Pages** step log. Also check **Settings → Actions → General → Workflow permissions** → **Read and write permissions** → Save.

**Easier fallback (no Actions):** **Settings → Pages** → Source **Deploy from a branch** → Branch `main` → folder `/ (root)` → Save. Site can work without the workflow; you can ignore or delete `.github/workflows/deploy-pages.yml` later if you prefer.

### Clearing live-site cache

After deploy, phones/browsers may show an old UI (no service worker in this repo).

| Where | What to do |
|-------|------------|
| **Desktop** | Hard refresh: `Cmd + Shift + R`, or DevTools → Application → Clear site data |
| **iPhone Safari** | Close tab; or **Settings → Apps → Safari → Advanced → Website Data** → delete `tpuls16.github.io` |
| **Add to Home Screen** | Remove old icon and add again after a big deploy |
| **Quick test** | Private/incognito window — if correct there, normal profile is cached |

Optional future improvement: cache-busting query param on `main.js` in `index.html` on each deploy.

### Data on the live site

GitHub hosts the **app files**. Each **auth account** has its own cloud rows (`player_profiles.user_id`, `account_usernames.user_id`) and its own **localStorage keys** on a device (`…-{userId}`). In-progress games and game history stay on the device per account until cloud sync is built.

### Data isolation (important)

| Layer | Rule |
|-------|------|
| **Supabase Table Editor** | Shows **all rows** (admin/service view). RLS still applies in the **app** — this is not cross-account leakage. Filter by `user_id` or `email` when inspecting. |
| **`player_profiles`** | RLS: `auth.uid() = user_id` — each login only reads/writes its own saved players. |
| **`account_usernames`** | One family username per account; `resolve_login_email` is callable before sign-in. |
| **Browser `localStorage`** | Keys include the signed-in user id so two accounts on the same phone do not share cached players, games, or history. |

**Test account:** `PulsFam` / `tysonp@pulsifire.com` — primary family login for development.

### Supabase project (`game-scorer-db`)

| Item | Value |
|------|--------|
| **Dashboard name** | `game-scorer-db` |
| **Project ref** | `grmiptwfwsjhpooaluft` |
| **Region** | us-west-2 |
| **API URL** | `https://grmiptwfwsjhpooaluft.supabase.co` |
| **Tables** | `player_profiles`, `account_usernames` (RLS). **Dropped:** `households`, `household_members`, `household_players` |
| **Auth** | Email + password; sign in with **family username or email**; **login required** in app |
| **RPCs** | `resolve_login_email`, `register_account_username`, `is_username_available` |

**Test account** (local + live sign-in):

| Field | Value |
|-------|--------|
| **Family username** | `PulsFam` |
| **Email** | `tysonp@pulsifire.com` |
| **Password** | `Tester1` |

Sign in with **either** the family username or the email, plus the password.

**Dashboard settings to verify:**

1. **Authentication → URL configuration** — Site URL `https://tpuls16.github.io/game-scorer/`; redirect URLs include `https://tpuls16.github.io/game-scorer/**` and `http://localhost:8080/**`.
2. **Authentication → Providers → Email** — enabled.
3. For frictionless family signup, consider **disable “Confirm email”** (otherwise new accounts must confirm before sign-in works).

### History note

June 2026 evolution on project `game-scorer-db`:

1. Phase 1 — auth + `player_profiles`
2. Households + join codes (later **removed**)
3. Household-scoped players + picker (later **removed**)
4. **Current:** one account = one group; family username login; `player_profiles` + local game history

**Active migrations (final state):** `20260609190000_create_player_profiles.sql`, `20260609270000_account_usernames.sql`, `20260609280000_remove_household_join_codes.sql`, `20260609290000_remove_households.sql`. Older household migration files remain in the repo for history but are superseded by the remove migrations applied on live Supabase.

### Version control (daily)

```bash
cd ~/projects/apps/game-scorer
git add .
git commit -m "What you changed"
git push
```

---

## Key functions to know

### Shell (`js/core/shell.js`)

| Function | Purpose |
|----------|---------|
| `showView(view, gameId)` | auth / home / setup / game / over / player-profile (redirects to auth if not signed in) |
| `showAuthView()` / `showHomeView()` | Auth gate vs game picker home |
| `showExitGameConfirm(fn)` | Confirm then run fn (often `exitToHome`) |
| `exitToHome()` | `clearGame()` on **all** modules, then home |
| `startApp()` | Wire events; `initFromSavedGame()` if signed in, else auth |
| `initFromSavedGame()` | Resume first saved game among SK / Flip7 / Rook (scoped local keys) |

### Saved players & auth (`js/core/`)

| Function | Purpose |
|----------|---------|
| `setProfilesUserId` / `scopedStorageKey` | Per-account localStorage namespace |
| `loadProfilesSplit()` | `{ favorites, others }` |
| `renderFavoriteProfileChips()` | Setup/game chips for favorites only |
| `mountOtherProfilesDropdown()` | Shared `<select>` for non-favorites |
| `createPlayerPicker()` | Full setup roster UX |
| `signInWithIdentifier()` | Sign in with family username or email |
| `syncAccountPlayers()` | Pull/push `player_profiles` on sign-in |
| `tryRecordGameHistory()` / `getHistoryForProfile()` | Per-account game history |

### Rook helpers (`js/games/rook/scoring.js`)

| Function | Purpose |
|----------|---------|
| `sumHandCounters` / `handScoringIsReady` | Rook 180-point validation |

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
- GitHub auth on Mac: HTTPS + Keychain (`credential.helper = osxkeychain`); no `gh` CLI required
- Test sign-in on the **live GitHub Pages URL**, not only `localhost`

---

*Last updated: June 2026 (family username login, account-scoped players/games/history, households and join codes removed)*
