import { createSkullKingApp } from "../games/skull-king/index.js";
import { createFlip7App } from "../games/flip7/index.js";
import { createRookApp } from "../games/rook/index.js";

/** @typedef {{ id: string, name: string, description: string, icon: string, available: boolean, theme?: string, tagline?: string, stylesheet?: string }} GameDefinition */

/** @type {GameDefinition[]} */
export const GAMES = [
  {
    id: "skull-king",
    name: "Skull King",
    description: "Pirate trick-taking — track bids, tricks, and bonuses round by round",
    icon: "☠",
    theme: "skull-king",
    available: true,
  },
  {
    id: "flip7",
    name: "Flip 7",
    description: "Press-your-luck — score number cards, modifiers, and the Flip 7 bonus",
    icon: "7",
    theme: "flip7",
    tagline: "Race to 200 — don't bust!",
    stylesheet: "css/games/flip7.css",
    available: true,
  },
  {
    id: "rook",
    name: "Rook",
    description: "Tolman Rules — 57-card deck, kitty, bid/set, play to 500",
    icon: "🃏",
    theme: "rook",
    tagline: "Tolman Rules · 180 counters · first to 500",
    stylesheet: "css/games/rook.css",
    available: true,
  },
];

export const DEFAULT_GAME_ID = "skull-king";

export function getGameById(id) {
  return GAMES.find((game) => game.id === id) ?? null;
}

/** Register all game modules. Add new games here and in GAMES. */
export function createGameModules(shell) {
  return {
    "skull-king": createSkullKingApp(shell),
    flip7: createFlip7App(shell),
    rook: createRookApp(shell),
  };
}
