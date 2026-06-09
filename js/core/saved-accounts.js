import { getSupabaseClient } from "./supabase-client.js";

const STORAGE_KEY = "game-scorer-saved-accounts";
const LAST_ACTIVE_KEY = "game-scorer-last-active-account";

/**
 * @typedef {{
 *   userId: string,
 *   loginId?: string,
 *   password?: string,
 *   refreshToken?: string,
 *   accessToken?: string,
 *   expiresAt?: number,
 *   username?: string | null,
 *   email?: string | null,
 *   lastUsedAt?: number,
 * }} SavedAccount
 */

const listeners = new Set();

let addingAnotherAccount = false;
let accountTransitionDepth = 0;

function notify() {
  listeners.forEach((cb) => cb(getSavedAccounts()));
}

/** @param {unknown} entry @returns {SavedAccount | null} */
function normalizeAccount(entry) {
  if (!entry || typeof entry !== "object" || !entry.userId) return null;

  const loginId =
    typeof entry.loginId === "string" && entry.loginId.trim()
      ? entry.loginId.trim()
      : typeof entry.username === "string" && entry.username.trim()
        ? entry.username.trim()
        : typeof entry.email === "string" && entry.email.trim()
          ? entry.email.trim()
          : "";

  const hasLogin = Boolean(loginId);
  const hasTokens =
    typeof entry.refreshToken === "string" &&
    typeof entry.accessToken === "string";

  if (!hasLogin && !hasTokens) return null;

  return {
    userId: entry.userId,
    loginId,
    password: typeof entry.password === "string" ? entry.password : "",
    refreshToken: hasTokens ? entry.refreshToken : undefined,
    accessToken: hasTokens ? entry.accessToken : undefined,
    expiresAt: entry.expiresAt,
    username: entry.username ?? null,
    email: entry.email ?? null,
    lastUsedAt: entry.lastUsedAt ?? 0,
  };
}

/** @returns {SavedAccount[]} */
export function getSavedAccounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map(normalizeAccount).filter(Boolean);
  } catch {
    return [];
  }
}

/** @param {SavedAccount} account @returns {string} */
export function getAccountLoginId(account) {
  return account.loginId || account.username || account.email || "";
}

/** @param {SavedAccount} account @returns {string} */
export function getAccountDisplayName(account) {
  return account.username || account.loginId || account.email || "Family account";
}

/** @param {SavedAccount[]} accounts */
function writeSavedAccounts(accounts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  notify();
}

/**
 * @param {{
 *   userId: string,
 *   loginId?: string,
 *   password?: string,
 *   username?: string | null,
 *   email?: string | null,
 *   session?: import("@supabase/supabase-js").Session | null,
 * }} details
 */
export function rememberAccountLogin({
  userId,
  loginId = "",
  password = "",
  username = null,
  email = null,
  session = null,
}) {
  const accounts = getSavedAccounts();
  const existing = accounts.find((account) => account.userId === userId);
  const entry = {
    userId,
    loginId: loginId || existing?.loginId || username || email || "",
    password: password || existing?.password || "",
    username: username ?? existing?.username ?? null,
    email: email ?? existing?.email ?? null,
    refreshToken: session?.refresh_token ?? existing?.refreshToken,
    accessToken: session?.access_token ?? existing?.accessToken,
    expiresAt: session?.expires_at ?? existing?.expiresAt,
    lastUsedAt: Date.now(),
  };

  const index = accounts.findIndex((account) => account.userId === userId);
  if (index >= 0) accounts[index] = { ...accounts[index], ...entry };
  else accounts.push(entry);

  writeSavedAccounts(accounts);
  localStorage.setItem(LAST_ACTIVE_KEY, userId);
}

/**
 * @param {import("@supabase/supabase-js").Session} session
 * @param {{ loginId?: string, password?: string, username?: string | null, email?: string | null }} [meta]
 */
export function persistSession(session, meta = {}) {
  if (!session?.user?.id) return;

  rememberAccountLogin({
    userId: session.user.id,
    loginId: meta.loginId,
    password: meta.password,
    username: meta.username,
    email: meta.email ?? session.user.email ?? null,
    session,
  });
}

/**
 * @param {string} userId
 * @param {{ username?: string | null, email?: string | null, loginId?: string, password?: string }} meta
 */
export function updateSavedAccountMeta(userId, meta) {
  const accounts = getSavedAccounts();
  const index = accounts.findIndex((account) => account.userId === userId);
  if (index < 0) return;
  accounts[index] = { ...accounts[index], ...meta };
  writeSavedAccounts(accounts);
}

export function removeSavedAccount(userId) {
  const accounts = getSavedAccounts().filter((account) => account.userId !== userId);
  writeSavedAccounts(accounts);
  if (localStorage.getItem(LAST_ACTIVE_KEY) === userId) {
    localStorage.removeItem(LAST_ACTIVE_KEY);
  }
}

export function getLastActiveAccountId() {
  return localStorage.getItem(LAST_ACTIVE_KEY);
}

export function beginAddingAnotherAccount() {
  addingAnotherAccount = true;
}

export function isAddingAnotherAccount() {
  return addingAnotherAccount;
}

export function clearAddingAnotherAccount() {
  addingAnotherAccount = false;
}

export function beginAccountTransition() {
  accountTransitionDepth += 1;
}

export function endAccountTransition() {
  accountTransitionDepth = Math.max(0, accountTransitionDepth - 1);
}

export function isAccountTransitionInProgress() {
  return accountTransitionDepth > 0;
}

export async function signOutLocalSession() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}

/** @param {SavedAccount} account @returns {Promise<import("@supabase/supabase-js").Session | null>} */
async function tryRestoreSessionFromTokens(account) {
  if (!account.refreshToken || !account.accessToken) return null;

  const supabase = getSupabaseClient();
  await signOutLocalSession();

  const { data, error } = await supabase.auth.setSession({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });

  if (error || !data.session || data.session.user.id !== account.userId) {
    return null;
  }

  persistSession(data.session, {
    username: account.username ?? null,
    email: account.email ?? data.session.user.email ?? null,
    loginId: getAccountLoginId(account),
    password: account.password,
  });
  return data.session;
}

/** @returns {Promise<import("@supabase/supabase-js").Session | null>} */
export async function restoreLastActiveSession() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    persistSession(data.session);
    return data.session;
  }

  const lastActiveId = getLastActiveAccountId();
  if (!lastActiveId) return null;

  const account = getSavedAccounts().find((entry) => entry.userId === lastActiveId);
  if (!account) return null;

  try {
    return await tryRestoreSessionFromTokens(account);
  } catch (error) {
    console.warn("Could not restore last active session from saved tokens", error);
    return null;
  }
}

/** Keep saved logins but return to the sign-in screen. */
export async function signOutToLoginPicker() {
  beginAccountTransition();
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const existing = getSavedAccounts().find(
        (account) => account.userId === data.session.user.id
      );
      persistSession(data.session, {
        username: existing?.username ?? null,
        email: data.session.user.email ?? existing?.email ?? null,
        loginId: existing?.loginId,
        password: existing?.password,
      });
    }
    await signOutLocalSession();
  } finally {
    endAccountTransition();
  }
}

/**
 * @param {string | null | undefined} userId
 * @param {{ removeFromDevice?: boolean }} [options]
 * @returns {Promise<null>}
 */
export async function signOutCurrentAccount(userId, { removeFromDevice = false } = {}) {
  if (removeFromDevice && userId) {
    removeSavedAccount(userId);
  }
  await signOutToLoginPicker();
  return null;
}

export async function signOutAllAccounts() {
  beginAccountTransition();
  try {
    writeSavedAccounts([]);
    localStorage.removeItem(LAST_ACTIVE_KEY);
    await signOutLocalSession();
  } finally {
    endAccountTransition();
  }
}

/** @param {(accounts: SavedAccount[]) => void} listener */
export function subscribeSavedAccounts(listener) {
  listeners.add(listener);
  listener(getSavedAccounts());
  return () => listeners.delete(listener);
}
