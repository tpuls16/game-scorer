import { getSupabaseClient } from "./supabase-client.js";

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
 */
export async function signUpWithPassword(email, password) {
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
  return data;
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
