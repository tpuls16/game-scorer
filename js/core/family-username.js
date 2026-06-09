import { getSupabaseClient } from "./supabase-client.js";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,32}$/;

/**
 * @param {string} raw
 * @returns {string | null}
 */
export function normalizeFamilyUsername(raw) {
  const trimmed = raw.trim();
  if (!USERNAME_PATTERN.test(trimmed)) return null;
  return trimmed;
}

/**
 * @param {string} username
 * @returns {Promise<boolean>}
 */
export async function isFamilyUsernameAvailable(username) {
  const normalized = normalizeFamilyUsername(username);
  if (!normalized) return false;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("is_username_available", {
    p_username: normalized,
  });

  if (error) {
    console.error("Failed to check username availability", error);
    throw new Error("Could not check username availability. Try again.");
  }

  return Boolean(data);
}

/**
 * @param {string} username
 */
export async function registerFamilyUsername(username) {
  const normalized = normalizeFamilyUsername(username);
  if (!normalized) {
    throw new Error("Username must be 3–32 letters, numbers, or underscores.");
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("register_account_username", {
    p_username: normalized,
  });

  if (error) {
    throw new Error(error.message || "Could not save your family username.");
  }

  return normalized;
}

/**
 * @param {string} identifier
 * @returns {Promise<string>}
 */
export async function resolveLoginEmail(identifier) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("resolve_login_email", {
    p_identifier: identifier.trim(),
  });

  if (error) {
    console.error("Failed to resolve login identifier", error);
    throw new Error("Could not look up that account. Try again.");
  }

  if (!data || typeof data !== "string") {
    throw new Error("No account found for that email or username.");
  }

  return data;
}
