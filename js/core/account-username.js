import { getCurrentUser, subscribeAuth } from "./auth.js";
import { getSupabaseClient } from "./supabase-client.js";
import { normalizeFamilyUsername } from "./family-username.js";

export { normalizeFamilyUsername } from "./family-username.js";

/** @type {string | null} */
let accountUsername = null;

const listeners = new Set();

function notify() {
  listeners.forEach((cb) => cb(accountUsername));
}

/** @returns {string | null} */
export function getAccountUsername() {
  return accountUsername;
}

export function clearAccountUsername() {
  accountUsername = null;
  notify();
}

export async function loadAccountUsername() {
  const user = getCurrentUser();
  if (!user) {
    clearAccountUsername();
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("account_usernames")
    .select("username")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load account username", error);
    accountUsername = null;
    notify();
    return null;
  }

  accountUsername = data?.username ?? null;
  notify();
  return accountUsername;
}

/** @param {(username: string | null) => void} listener */
export function subscribeAccountUsername(listener) {
  listeners.add(listener);
  listener(accountUsername);
  return () => listeners.delete(listener);
}

subscribeAuth((user) => {
  if (!user) {
    clearAccountUsername();
    return;
  }
  loadAccountUsername().catch((error) => {
    console.error("Account username load failed", error);
  });
});
