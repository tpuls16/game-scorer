import { getGameById } from "./catalog.js";
import { scopedStorageKey } from "./user-storage.js";

/** @type {Record<string, string>} */
const GAME_STORAGE_BASE = {
  "skull-king": "skull-king-game",
  flip7: "game-scorer-flip7",
  rook: "game-scorer-rook",
};

/** @param {string} gameId */
export function readSavedGameState(gameId) {
  const baseKey = GAME_STORAGE_BASE[gameId];
  if (!baseKey) return null;

  const key = scopedStorageKey(baseKey);
  if (!key) return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** @returns {string | null} */
export function getInProgressGameId() {
  for (const gameId of Object.keys(GAME_STORAGE_BASE)) {
    const state = readSavedGameState(gameId);
    if (state && !state.completed) return gameId;
  }
  return null;
}

/**
 * @param {string} gameId
 * @param {Record<string, unknown>} state
 */
export function formatActiveGameSummary(gameId, state) {
  const def = getGameById(gameId);
  if (!def) return "Game in progress";

  if (gameId === "skull-king") {
    const round = state.currentRound ?? 1;
    const total = state.totalRounds ?? round;
    return `${def.icon} ${def.name} — Round ${round} of ${total}`;
  }

  if (gameId === "flip7") {
    const round = state.currentRound ?? 1;
    return `${def.icon} ${def.name} — Round ${round}`;
  }

  if (gameId === "rook") {
    const handsPlayed = Array.isArray(state.rounds) ? state.rounds.length : 0;
    const hand = handsPlayed + 1;
    const totalHands = state.totalHands ?? hand;
    return `${def.icon} ${def.name} — Hand ${Math.min(hand, totalHands)}`;
  }

  return `${def.icon} ${def.name}`;
}

/** @returns {{ gameId: string, summary: string } | null} */
export function getInProgressGameInfo() {
  const gameId = getInProgressGameId();
  if (!gameId) return null;

  const state = readSavedGameState(gameId);
  if (!state) return null;

  return {
    gameId,
    summary: formatActiveGameSummary(gameId, state),
  };
}
