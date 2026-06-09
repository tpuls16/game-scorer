import { getSupabaseClient } from "./supabase-client.js";
import {
  isFamilyUsernameAvailable,
  normalizeFamilyUsername,
  registerFamilyUsername,
  resolveLoginEmail,
} from "./family-username.js";
/** @typedef {import('@supabase/supabase-js').User} AuthUser */

const listeners = new Set();

/** @type {AuthUser | null} */
let currentUser = null;

function notify() {
  listeners.forEach((cb) => cb(currentUser));
}

export function getCurrentUser() {
  return currentUser;
}

export function isSignedIn() {
  return currentUser !== null;
}

export function subscribeAuth(listener) {
  listeners.add(listener);
  listener(currentUser);
  return () => listeners.delete(listener);
}

/**
 * @param {string} email
 * @param {string} password
 * @param {string} familyUsername
 */
export async function signUpWithPassword(email, password, familyUsername) {
  const normalized = normalizeFamilyUsername(familyUsername);
  if (!normalized) {
    throw new Error("Choose a family username (3–32 letters, numbers, or underscores).");
  }

  const available = await isFamilyUsernameAvailable(normalized);
  if (!available) {
    throw new Error("That family username is already taken.");
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  if (data.user && !data.session) {
    throw new Error(
      "Account created. Check your email to confirm your address, then sign in."
    );
  }

  await registerFamilyUsername(normalized);
  return data;
}

/**
 * @param {string} identifier Email or family username
 * @param {string} password
 */
export async function signInWithIdentifier(identifier, password) {
  const trimmed = identifier.trim();
  if (!trimmed) {
    throw new Error("Enter your email or family username.");
  }

  const email = await resolveLoginEmail(trimmed);
  return signInWithPassword(email, password);
}

/**
 * @param {string} email
 * @param {string} password
 */
export async function signInWithPassword(email, password) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function initAuth() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Failed to read auth session", error);
  }
  currentUser = data.session?.user ?? null;

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    notify();
  });

  return currentUser;
}
