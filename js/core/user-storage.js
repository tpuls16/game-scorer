/** Base localStorage keys for in-progress games (scoped per account). */
export const GAME_STORAGE_BASE_KEYS = [
  "skull-king-game",
  "game-scorer-flip7",
  "game-scorer-rook",
];

export const HISTORY_STORAGE_BASE = "game-scorer-history";

const LEGACY_HOUSEHOLD_PLAYERS_PREFIX = "game-scorer-household-players";
const LEGACY_LAST_HOUSEHOLD_PREFIX = "game-scorer-last-household";

/** @type {string | null} */
let activeUserId = null;

export function setActiveUserId(userId) {
  activeUserId = userId ?? null;
}

export function getActiveUserId() {
  return activeUserId;
}

/**
 * Scope local data to the signed-in account.
 * @param {string} baseKey
 * @param {string | null} [userId]
 */
export function scopedStorageKey(baseKey, userId = activeUserId) {
  if (!userId) return baseKey;
  return `${baseKey}-${userId}`;
}

/**
 * One-time copy of household-scoped local data into account-scoped keys.
 * @param {string} userId
 */
export function migrateAccountScopedStorage(userId) {
  const lastHouseholdId = localStorage.getItem(`${LEGACY_LAST_HOUSEHOLD_PREFIX}-${userId}`);
  if (!lastHouseholdId) return;

  const bases = [...GAME_STORAGE_BASE_KEYS, HISTORY_STORAGE_BASE];
  for (const base of bases) {
    const fromKey = `${base}-${lastHouseholdId}`;
    const toKey = `${base}-${userId}`;
    if (localStorage.getItem(fromKey) && !localStorage.getItem(toKey)) {
      localStorage.setItem(toKey, localStorage.getItem(fromKey));
    }
  }

  const householdPlayersKey = `${LEGACY_HOUSEHOLD_PLAYERS_PREFIX}-${lastHouseholdId}`;
  const accountPlayersKey = `game-scorer-profiles-${userId}`;
  if (localStorage.getItem(householdPlayersKey) && !localStorage.getItem(accountPlayersKey)) {
    localStorage.setItem(accountPlayersKey, localStorage.getItem(householdPlayersKey));
  }
}
