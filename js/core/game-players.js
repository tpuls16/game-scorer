import { addProfile, findProfileByName } from "./profiles.js";

/**
 * @typedef {{ name: string, profileId?: string, guest?: boolean }} GamePlayerRef
 */

/**
 * Saves guest names to the account roster and returns refs linked to profiles.
 * @param {GamePlayerRef[]} refs
 * @returns {GamePlayerRef[]}
 */
export function promoteGuestsToSavedProfiles(refs) {
  return refs.map((ref) => {
    if (!ref.guest) return ref;

    const name = ref.name.trim();
    if (!name) return ref;

    const existing = findProfileByName(name);
    if (existing) {
      return { name: existing.name, profileId: existing.id };
    }

    const created = addProfile(name);
    if (created) {
      return { name: created.name, profileId: created.id };
    }

    const fallback = findProfileByName(name);
    if (fallback) {
      return { name: fallback.name, profileId: fallback.id };
    }

    return ref;
  });
}

/** @param {GamePlayerRef[]} refs */
export function mapSkullKingPlayers(refs) {
  return refs.map((ref) => ({
    name: ref.name,
    ...(ref.profileId ? { profileId: ref.profileId } : {}),
    ...(ref.guest ? { guest: true } : {}),
    rounds: [],
  }));
}

/** @param {GamePlayerRef[]} refs */
export function mapFlip7Players(refs) {
  return mapSkullKingPlayers(refs);
}

/** @param {GamePlayerRef[]} refs */
export function mapRookPlayers(refs) {
  return refs.map((ref) => ({
    name: ref.name,
    ...(ref.profileId ? { profileId: ref.profileId } : {}),
    ...(ref.guest ? { guest: true } : {}),
  }));
}

/**
 * @param {GamePlayerRef[]} refs
 * @param {Array<{ name: string, profileId?: string, guest?: boolean, rounds?: unknown[] }>} existingPlayers
 */
export function mapSkullKingPlayersFromSettings(refs, existingPlayers) {
  return refs.map((ref, index) => ({
    name: ref.name,
    ...(ref.profileId ? { profileId: ref.profileId } : {}),
    ...(ref.guest ? { guest: true } : {}),
    rounds: existingPlayers[index]?.rounds ?? [],
  }));
}

/** @param {GamePlayerRef[]} refs @param {Array<{ rounds?: unknown[] }>} existingPlayers */
export function mapFlip7PlayersFromSettings(refs, existingPlayers) {
  return mapSkullKingPlayersFromSettings(refs, existingPlayers);
}

/** @param {Array<{ name: string, profileId?: string, guest?: boolean }>} players @returns {GamePlayerRef[]} */
export function rosterRefsFromGamePlayers(players) {
  return players.map((player) => ({
    name: player.name,
    ...(player.profileId ? { profileId: player.profileId } : {}),
    ...(player.guest ? { guest: true } : {}),
  }));
}
