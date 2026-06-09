const STORAGE_KEY_PREFIX = "game-scorer-profiles";
const LEGACY_STORAGE_KEY = "game-scorer-profiles";
const LEGACY_OWNER_KEY = "game-scorer-profiles-owner";
const STORAGE_VERSION = 1;

/** @typedef {{ id: string, name: string, favorite: boolean }} PlayerProfile */

/** @type {string | null} */
let profilesUserId = null;

const listeners = new Set();

/** @type {((profiles: PlayerProfile[]) => void) | null} */
let afterPersistCallback = null;

function notify() {
  listeners.forEach((cb) => cb());
}

/** @param {(profiles: PlayerProfile[]) => void} callback */
export function setAfterPersistCallback(callback) {
  afterPersistCallback = callback;
}

/** @param {string | null} userId */
export function setProfilesUserId(userId) {
  profilesUserId = userId ?? null;
}

function getProfilesStorageKey() {
  if (!profilesUserId) return null;
  return `${STORAGE_KEY_PREFIX}-${profilesUserId}`;
}

/**
 * @param {PlayerProfile[]} profiles
 * @returns {PlayerProfile[]}
 */
function normalizeProfiles(profiles) {
  return profiles
    .filter((p) => p?.id && typeof p.name === "string")
    .map((p) => ({
      id: p.id,
      name: p.name,
      favorite: Boolean(p.favorite),
    }));
}

/** @param {PlayerProfile[]} profiles */
function writeLocalProfiles(profiles) {
  const key = getProfilesStorageKey();
  if (!key) return;

  try {
    localStorage.setItem(
      key,
      JSON.stringify({ version: STORAGE_VERSION, profiles })
    );
  } catch (error) {
    console.error("Failed to save your players", error);
    throw new Error(
      "Could not save to browser storage. Check that storage is enabled and you are not in private browsing with storage blocked."
    );
  }
  notify();
}

function createProfileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** One-time move from pre-scoped localStorage to per-user key. */
export function migrateLegacyProfilesForUser(userId) {
  const scopedKey = `${STORAGE_KEY_PREFIX}-${userId}`;
  if (localStorage.getItem(scopedKey)) return;

  const legacyOwner = localStorage.getItem(LEGACY_OWNER_KEY);
  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacyRaw) return;
  if (legacyOwner && legacyOwner !== userId) return;

  localStorage.setItem(scopedKey, legacyRaw);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  localStorage.removeItem(LEGACY_OWNER_KEY);
}

/** @returns {PlayerProfile[]} */
export function loadProfiles() {
  const key = getProfilesStorageKey();
  if (!key) return [];

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data?.profiles)) return [];
    return data.profiles
      .filter((p) => p?.id && typeof p.name === "string")
      .map((p) => ({
        id: p.id,
        name: p.name,
        favorite: Boolean(p.favorite),
      }));
  } catch {
    return [];
  }
}

/** @param {PlayerProfile} a @param {PlayerProfile} b */
export function compareProfileNames(a, b) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/** Favorites first, then alphabetical by name. @param {PlayerProfile} a @param {PlayerProfile} b */
export function compareProfiles(a, b) {
  if (a.favorite !== b.favorite) {
    return a.favorite ? -1 : 1;
  }
  return compareProfileNames(a, b);
}

/** @returns {PlayerProfile[]} */
export function loadProfilesSorted() {
  return loadProfiles().sort(compareProfiles);
}

/** @returns {{ favorites: PlayerProfile[], others: PlayerProfile[] }} */
export function loadProfilesSplit() {
  const sorted = loadProfilesSorted();
  return {
    favorites: sorted.filter((p) => p.favorite),
    others: sorted.filter((p) => !p.favorite),
  };
}

/** Replace local saved players without triggering cloud sync (e.g. after pull). */
export function replaceProfiles(profiles) {
  writeLocalProfiles(normalizeProfiles(profiles));
}

/** @param {PlayerProfile[]} profiles */
function persistProfiles(profiles) {
  writeLocalProfiles(profiles);
  afterPersistCallback?.(profiles);
}

/** @param {string} name */
export function addProfile(name) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const profiles = loadProfiles();
  const duplicate = profiles.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());
  if (duplicate) return null;

  const profile = {
    id: createProfileId(),
    name: trimmed.slice(0, 24),
    favorite: false,
  };
  persistProfiles([...profiles, profile]);
  return profile;
}

/** @param {string} id @param {string} name */
export function updateProfile(id, name) {
  const trimmed = name.trim();
  if (!trimmed) return false;

  const profiles = loadProfiles();
  const index = profiles.findIndex((p) => p.id === id);
  if (index < 0) return false;

  const duplicate = profiles.some(
    (p, i) => i !== index && p.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (duplicate) return false;

  profiles[index] = { ...profiles[index], name: trimmed.slice(0, 24) };
  persistProfiles([...profiles]);
  return true;
}

/** @param {string} id */
export function toggleProfileFavorite(id) {
  const profiles = loadProfiles();
  const index = profiles.findIndex((p) => p.id === id);
  if (index < 0) return null;

  const favorite = !profiles[index].favorite;
  profiles[index] = { ...profiles[index], favorite };
  persistProfiles([...profiles]);
  return favorite;
}

/** @param {string} id */
export function removeProfile(id) {
  const profiles = loadProfiles();
  const next = profiles.filter((p) => p.id !== id);
  if (next.length === profiles.length) return false;
  persistProfiles(next);
  return true;
}

/** @param {string} id */
export function getProfileById(id) {
  return loadProfiles().find((p) => p.id === id) ?? null;
}

/** @param {string} name */
export function findProfileByName(name) {
  const lower = name.trim().toLowerCase();
  if (!lower) return null;
  return loadProfiles().find((p) => p.name.toLowerCase() === lower) ?? null;
}

export function subscribeProfiles(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
