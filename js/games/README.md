# Game modules

Each subfolder is one scorekeeper. Shared app shell lives in `js/core/`.

## Layout (per game)

```
js/games/<game-id>/
  index.js      # exports create<Game>App(shell)
  app.js        # UI, state, localStorage
  scoring.js    # pure scoring (no DOM)
  deck.js       # optional game-specific helpers
```

## Add a new game

1. Copy `flip7/` as a template (or start minimal with `index.js` + `app.js` + `scoring.js`).
2. Register in `js/core/catalog.js`:
   - Add an entry to `GAMES` (id, name, description, icon, `theme`, optional `stylesheet`).
   - Add `createYourGameApp(shell)` to `createGameModules()`.
3. Add HTML in `index.html`:
   - Setup block: `#<game-id>-setup` inside `#setup-view`
   - Active play: `#<game-id>-game-panel` inside `#game-view`
   - Game over: `#<game-id>-game-over-panel` inside `#game-over-view`
   - Settings dialog if needed
4. Optional theme: `css/games/<game-id>.css` and link it in `index.html` (or set `stylesheet` in catalog for future dynamic loading).
5. Wire panel visibility in `js/core/shell.js` `showView()` (follow the `skull-king` / `flip7` pattern).
