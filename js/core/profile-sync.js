import { getCurrentUser, subscribeAuth } from "./auth.js";
import { getSupabaseClient } from "./supabase-client.js";
import {
  loadProfiles,
  migrateLegacyProfilesForUser,
  replaceProfiles,
  setAfterPersistCallback,
  setProfilesUserId,
} from "./profiles.js";
import { setActiveUserId } from "./user-storage.js";

/** @typedef {{ id: string, name: string, favorite: boolean }} PlayerProfile */

let cloudSyncEnabled = false;
let syncInProgress = false;

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

/**
 * @returns {Promise<PlayerProfile[]>}
 */
async function fetchCloudProfiles() {
  const user = getCurrentUser();
  if (!user) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("player_profiles")
    .select("id, name, favorite")
    .order("name");

  if (error) {
    console.error("Failed to load cloud profiles", error);
    throw new Error("Could not load your saved players from the cloud.");
  }

  return normalizeProfiles(data ?? []);
}

/**
 * @param {PlayerProfile[]} profiles
 */
async function pushProfilesToCloud(profiles) {
  const user = getCurrentUser();
  if (!user) return;

  const supabase = getSupabaseClient();
  const normalized = normalizeProfiles(profiles);

  const { data: existing, error: fetchError } = await supabase
    .from("player_profiles")
    .select("id");

  if (fetchError) {
    console.error("Failed to list cloud profiles for sync", fetchError);
    throw new Error("Could not sync saved players to the cloud.");
  }

  const localIds = new Set(normalized.map((p) => p.id));
  const toDelete = (existing ?? [])
    .map((row) => row.id)
    .filter((id) => !localIds.has(id));

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("player_profiles")
      .delete()
      .in("id", toDelete);
    if (deleteError) {
      console.error("Failed to delete removed cloud profiles", deleteError);
      throw new Error("Could not sync saved players to the cloud.");
    }
  }

  if (normalized.length === 0) return;

  const rows = normalized.map((p) => ({
    id: p.id,
    user_id: user.id,
    name: p.name,
    favorite: p.favorite,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase.from("player_profiles").upsert(rows, {
    onConflict: "id",
  });

  if (upsertError) {
    console.error("Failed to upsert cloud profiles", upsertError);
    throw new Error("Could not sync saved players to the cloud.");
  }
}

export async function syncProfilesToCloud(profiles) {
  if (!cloudSyncEnabled) return;
  await pushProfilesToCloud(profiles);
}

async function mergeOnSignIn() {
  const user = getCurrentUser();
  if (!user) return;

  syncInProgress = true;
  try {
    migrateLegacyProfilesForUser(user.id);

    const cloud = await fetchCloudProfiles();
    const local = loadProfiles();

    if (cloud.length > 0) {
      replaceProfiles(cloud);
      return;
    }

    if (local.length > 0) {
      await pushProfilesToCloud(local);
      return;
    }

    replaceProfiles([]);
  } finally {
    syncInProgress = false;
  }
}

function bindUserSession(user) {
  if (!user) {
    setActiveUserId(null);
    setProfilesUserId(null);
    cloudSyncEnabled = false;
    return;
  }

  setActiveUserId(user.id);
  setProfilesUserId(user.id);
  cloudSyncEnabled = true;
  mergeOnSignIn().catch((error) => {
    console.error("Profile sync on sign-in failed", error);
  });
}

export function initProfileSync() {
  setAfterPersistCallback((profiles) => {
    if (!cloudSyncEnabled || syncInProgress) return;
    if (!getCurrentUser()) return;
    syncProfilesToCloud(profiles).catch((error) => {
      console.error("Profile cloud sync failed", error);
    });
  });

  subscribeAuth(bindUserSession);
}
