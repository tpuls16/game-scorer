/** Base localStorage keys for in-progress games (scoped per auth user). */
export const GAME_STORAGE_BASE_KEYS = [
  "skull-king-game",
  "game-scorer-flip7",
  "game-scorer-rook",
];

/** @type {string | null} */
let activeUserId = null;

export function setActiveUserId(userId) {
  activeUserId = userId ?? null;
}

export function getActiveUserId() {
  return activeUserId;
}

/**
 * @param {string} baseKey
 * @param {string} [userId]
 */
export function scopedStorageKey(baseKey, userId = activeUserId) {
  if (!userId) return baseKey;
  return `${baseKey}-${userId}`;
}
