import { getSupabaseClient } from "./supabase-client.js";
import {
  isFamilyUsernameAvailable,
  normalizeFamilyUsername,
  registerFamilyUsername,
  resolveLoginEmail,
} from "./family-username.js";
import {
  isAccountTransitionInProgress,
  persistSession,
  restoreLastActiveSession,
  signOutAllAccounts,
  signOutCurrentAccount,
} from "./saved-accounts.js";
/** @typedef {import('@supabase/supabase-js').User} AuthUser */

const listeners = new Set();
const recoveryListeners = new Set();

/** @type {AuthUser | null} */
let currentUser = null;
let passwordRecoveryPending = false;

/** @type {Array<{ userId: string, resolve: (user: AuthUser) => void, reject: (error: Error) => void, timer: number }>} */
const pendingAuthWaits = [];

function notify() {
  listeners.forEach((cb) => cb(currentUser));

  if (!currentUser) return;

  for (let index = pendingAuthWaits.length - 1; index >= 0; index -= 1) {
    const wait = pendingAuthWaits[index];
    if (wait.userId !== currentUser.id) continue;
    clearTimeout(wait.timer);
    pendingAuthWaits.splice(index, 1);
    wait.resolve(currentUser);
  }
}

/**
 * @param {import('@supabase/supabase-js').Session | null} session
 */
export function setCurrentUserFromSession(session) {
  currentUser = session?.user ?? null;
  if (session && !passwordRecoveryPending) {
    persistSession(session);
  }
  notify();
}

/**
 * @param {string} userId
 * @param {number} [timeoutMs]
 * @returns {Promise<AuthUser>}
 */
export function waitForSignedInUser(userId, timeoutMs = 8000) {
  if (currentUser?.id === userId) {
    return Promise.resolve(currentUser);
  }

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      const index = pendingAuthWaits.findIndex((wait) => wait.resolve === resolve);
      if (index >= 0) pendingAuthWaits.splice(index, 1);
      reject(new Error("Account switch timed out. Try again."));
    }, timeoutMs);

    pendingAuthWaits.push({ userId, resolve, reject, timer });
  });
}

function notifyRecovery() {
  recoveryListeners.forEach((cb) => cb(passwordRecoveryPending));
}

export function isPasswordRecoveryPending() {
  return passwordRecoveryPending;
}

export function clearPasswordRecoveryPending() {
  passwordRecoveryPending = false;
  notifyRecovery();
}

/** @param {(pending: boolean) => void} listener */
export function subscribePasswordRecovery(listener) {
  recoveryListeners.add(listener);
  listener(passwordRecoveryPending);
  return () => recoveryListeners.delete(listener);
}

export function getAuthRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function detectRecoveryFromUrl() {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  return params.get("type") === "recovery";
}

function clearAuthHashFromUrl() {
  if (!window.location.hash) return;
  window.history.replaceState(
    window.history.state,
    document.title,
    `${window.location.pathname}${window.location.search}`
  );
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

/**
 * @param {string} identifier Email or family username
 */
export async function requestPasswordReset(identifier) {
  const trimmed = identifier.trim();
  if (!trimmed) {
    throw new Error("Enter your email or family username.");
  }

  const email = await resolveLoginEmail(trimmed);
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectUrl(),
  });
  if (error) throw error;
}

/** @param {string} password */
export async function updatePassword(password) {
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  clearPasswordRecoveryPending();
  clearAuthHashFromUrl();
}

/** Sign out to the login screen. Saved family logins stay on this device. */
export async function signOut() {
  await signOutCurrentAccount(currentUser?.id ?? null);
  currentUser = null;
  notify();
}

/** Sign out every family account saved on this device. */
export async function signOutEveryAccount() {
  await signOutAllAccounts();
  currentUser = null;
  notify();
}

export async function initAuth() {
  const supabase = getSupabaseClient();
  if (detectRecoveryFromUrl()) {
    passwordRecoveryPending = true;
    notifyRecovery();
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Failed to read auth session", error);
  }

  let session = data.session;
  if (!session && !passwordRecoveryPending) {
    session = await restoreLastActiveSession();
  } else if (session && !passwordRecoveryPending) {
    persistSession(session);
  }

  currentUser = session?.user ?? null;

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      passwordRecoveryPending = true;
      notifyRecovery();
    }

    if (!session && isAccountTransitionInProgress()) {
      return;
    }

    currentUser = session?.user ?? null;
    if (session && !passwordRecoveryPending) {
      persistSession(session);
    }
    notify();
  });

  return currentUser;
}
