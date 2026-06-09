import {
  getCurrentUser,
  isPasswordRecoveryPending,
  requestPasswordReset,
  signInWithIdentifier,
  signOut,
  signOutEveryAccount,
  signUpWithPassword,
  subscribeAuth,
  subscribePasswordRecovery,
  updatePassword,
} from "./auth.js";
import {
  getAccountUsername,
  loadAccountUsername,
  normalizeFamilyUsername,
  subscribeAccountUsername,
} from "./account-username.js";
import {
  beginAddingAnotherAccount,
  clearAddingAnotherAccount,
  getAccountDisplayName,
  getAccountLoginId,
  getSavedAccounts,
  isAccountTransitionInProgress,
  isAddingAnotherAccount,
  persistSession,
  rememberAccountLogin,
  removeSavedAccount,
  signOutLocalSession,
  subscribeSavedAccounts,
  updateSavedAccountMeta,
} from "./saved-accounts.js";
import { getSupabaseClient } from "./supabase-client.js";

/** @type {{ showAuthView: () => void, showHomeView: () => void, resumeCurrentAccount: () => void } | null} */
let navigation = null;

let authModeSignInBtn = null;
let authModeSignUpBtn = null;
let authLoginIdInput = null;
let authEmailInput = null;
let authFamilyUsernameInput = null;
let authPasswordInput = null;
let authSubmitBtn = null;
let authStatusEl = null;
let authAddAnotherHintEl = null;
let accountBarEl = null;
let accountUsernameEl = null;
let accountSettingsBtn = null;
let profilesSyncHint = null;
let accountSettingsDialog = null;
let accountSettingsListEl = null;
let accountAddAnotherBtn = null;
let accountSettingsSignOutAllBtn = null;
let accountSettingsCloseBtn = null;
let authModeToggleEl = null;
let authFormEl = null;
let authForgotRowEl = null;
let authForgotPasswordBtn = null;
let authForgotPasswordPanel = null;
let authForgotLoginIdInput = null;
let authForgotSendBtn = null;
let authForgotBackBtn = null;
let authForgotStatusEl = null;
let authResetPasswordPanel = null;
let authNewPasswordInput = null;
let authConfirmPasswordInput = null;
let authResetPasswordBtn = null;
let authResetStatusEl = null;
let authHeadingEl = null;
let authViewEl = null;
let authSavedLoginsEl = null;
let authSavedLoginsListEl = null;
let accountSwitchBtn = null;

/** @type {"sign-in" | "sign-up"} */
let authMode = "sign-in";

/** @type {"default" | "forgot-password" | "reset-password"} */
let authPanel = "default";

function setPanelStatus(el, message, isError = false) {
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("auth-status-error", isError);
  el.classList.toggle("hidden", !message);
}

function setAuthStatus(message, isError = false) {
  setPanelStatus(authStatusEl, message, isError);
}

function setForgotStatus(message, isError = false) {
  setPanelStatus(authForgotStatusEl, message, isError);
}

function setResetStatus(message, isError = false) {
  setPanelStatus(authResetStatusEl, message, isError);
}

function updateAuthPanels() {
  const isRecovery = authPanel === "reset-password" || isPasswordRecoveryPending();
  const isForgot = authPanel === "forgot-password";
  const showDefault = !isRecovery && !isForgot;

  authModeToggleEl?.classList.toggle("hidden", !showDefault);
  authFormEl?.classList.toggle("hidden", !showDefault);
  authForgotPasswordPanel?.classList.toggle("hidden", !isForgot);
  authResetPasswordPanel?.classList.toggle("hidden", !isRecovery);
  renderAuthSavedLogins();

  if (authHeadingEl) {
    authHeadingEl.textContent = isRecovery
      ? "Set a new password"
      : isForgot
        ? "Reset password"
        : "Sign in to play";
  }
}

function showForgotPasswordPanel() {
  authPanel = "forgot-password";
  setAuthStatus("");
  setForgotStatus("");
  if (authForgotLoginIdInput && authLoginIdInput?.value.trim()) {
    authForgotLoginIdInput.value = authLoginIdInput.value.trim();
  }
  updateAuthPanels();
  authForgotLoginIdInput?.focus();
}

function showDefaultAuthPanel() {
  authPanel = "default";
  setForgotStatus("");
  setResetStatus("");
  updateAuthPanels();
}

function showResetPasswordPanel() {
  authPanel = "reset-password";
  setAuthStatus("");
  setForgotStatus("");
  updateAuthPanels();
  authNewPasswordInput?.focus();
}

function setAuthMode(mode) {
  authMode = mode;
  authPanel = "default";
  const isSignUp = mode === "sign-up";

  authModeSignInBtn?.classList.toggle("is-active", !isSignUp);
  authModeSignUpBtn?.classList.toggle("is-active", isSignUp);

  document.getElementById("auth-sign-in-fields")?.classList.toggle("hidden", isSignUp);
  document.getElementById("auth-sign-up-fields")?.classList.toggle("hidden", !isSignUp);
  authForgotRowEl?.classList.toggle("hidden", isSignUp);

  if (authLoginIdInput) authLoginIdInput.required = !isSignUp;
  if (authEmailInput) authEmailInput.required = isSignUp;
  if (authFamilyUsernameInput) authFamilyUsernameInput.required = isSignUp;

  if (authSubmitBtn) {
    authSubmitBtn.textContent = isSignUp ? "Create account" : "Sign in";
  }

  if (authPasswordInput) {
    authPasswordInput.autocomplete = isSignUp ? "new-password" : "current-password";
  }

  setAuthStatus("");
  updateAuthPanels();
}

function updateAddAnotherHint() {
  if (!authAddAnotherHintEl) return;
  const show = isAddingAnotherAccount();
  authAddAnotherHintEl.classList.toggle("hidden", !show);
}

let familySettingsAvailable = true;

function updateAccountBar(user) {
  if (!accountBarEl) return;
  const showBar = Boolean(user) && !isPasswordRecoveryPending();
  accountBarEl.classList.toggle("hidden", !showBar);
  profilesSyncHint?.classList.toggle("hidden", !showBar);
  updateFamilySettingsButton();
}

/** @param {boolean} available */
export function setFamilySettingsAvailable(available) {
  familySettingsAvailable = available;
  updateFamilySettingsButton();
  if (!available) {
    closeAccountSettings();
  }
}

function updateFamilySettingsButton() {
  const signedIn = Boolean(getCurrentUser()) && !isPasswordRecoveryPending();
  const showSettings = signedIn && familySettingsAvailable;
  accountSettingsBtn?.classList.toggle("hidden", !showSettings);
}

function getActiveAccountLabel() {
  const user = getCurrentUser();
  if (!user) return null;

  const username = getAccountUsername();
  if (username) return username;

  const saved = getSavedAccounts().find((account) => account.userId === user.id);
  return saved ? getAccountDisplayName(saved) : null;
}

function updateAccountIdentity() {
  const label = getActiveAccountLabel();
  if (accountUsernameEl) {
    accountUsernameEl.textContent = label ?? "";
    accountUsernameEl.classList.toggle("hidden", !label);
  }
}

function renderAuthSavedLogins() {
  if (!authSavedLoginsEl || !authSavedLoginsListEl) return;

  const showPicker =
    authPanel === "default" &&
    authMode === "sign-in" &&
    !isPasswordRecoveryPending() &&
    getSavedAccounts().length > 0;

  authSavedLoginsEl.classList.toggle("hidden", !showPicker);
  if (!showPicker) return;

  const accounts = [...getSavedAccounts()].sort(
    (a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)
  );

  authSavedLoginsListEl.innerHTML = "";
  accounts.forEach((account) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "auth-saved-login-btn";
    btn.dataset.savedLoginId = account.userId;

    const name = document.createElement("span");
    name.className = "auth-saved-login-name";
    name.textContent = getAccountDisplayName(account);

    const action = document.createElement("span");
    action.className = "auth-saved-login-action";
    action.textContent = account.password ? "Sign in" : "Fill login";

    btn.append(name, action);
    authSavedLoginsListEl.append(btn);
  });
}

function fillLoginFromSaved(account) {
  const loginId = getAccountLoginId(account);
  if (authLoginIdInput) authLoginIdInput.value = loginId;
  if (authPasswordInput) {
    authPasswordInput.value = account.password ?? "";
  }
  setAuthMode("sign-in");
}

async function persistLoginAfterSignIn(loginId, password) {
  const user = getCurrentUser();
  if (!user) return;

  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();

  rememberAccountLogin({
    userId: user.id,
    loginId,
    password,
    username: getAccountUsername(),
    email: user.email ?? null,
    session: data.session,
  });
}

async function completeSignIn(loginId, password) {
  await loadAccountUsername();
  await persistLoginAfterSignIn(loginId, password);
  updateSavedAccountMeta(getCurrentUser()?.id ?? "", {
    username: getAccountUsername(),
    loginId,
    password,
  });
  clearAddingAnotherAccount();
  updateAddAnotherHint();
  renderAuthSavedLogins();
  setAuthStatus("");
  navigation?.resumeCurrentAccount();
}

async function signInWithSavedAccount(account) {
  fillLoginFromSaved(account);

  const loginId = getAccountLoginId(account);
  const password = account.password || authPasswordInput?.value || "";

  if (!loginId) {
    setAuthStatus("This saved account is missing a username. Enter it below.", true);
    authLoginIdInput?.focus();
    return;
  }

  if (password.length < 6) {
    setAuthStatus("Enter the password below, then tap Sign in.", false);
    authPasswordInput?.focus();
    return;
  }

  setAuthStatus("Signing in…");
  authSubmitBtn.disabled = true;

  try {
    await signInWithIdentifier(loginId, password);
    await completeSignIn(loginId, password);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not sign in. Try again.";
    setAuthStatus(message, true);
  } finally {
    authSubmitBtn.disabled = false;
  }
}

function renderAccountSettingsList() {
  if (!accountSettingsListEl) return;

  const currentUser = getCurrentUser();
  const accounts = getSavedAccounts();
  const hasMultiple = accounts.length > 1;

  accountSettingsSignOutAllBtn?.classList.toggle("hidden", !hasMultiple);

  if (accounts.length === 0) {
    accountSettingsListEl.innerHTML =
      '<p class="hint account-settings-empty">No saved family accounts on this device.</p>';
    return;
  }

  accountSettingsListEl.innerHTML = "";
  const sortedAccounts = [...accounts].sort((a, b) => {
    const aCurrent = currentUser?.id === a.userId;
    const bCurrent = currentUser?.id === b.userId;
    if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
    return getAccountDisplayName(a).localeCompare(getAccountDisplayName(b), undefined, {
      sensitivity: "base",
    });
  });

  sortedAccounts.forEach((account) => {
    const isCurrent = currentUser?.id === account.userId;
    const card = document.createElement("div");
    card.className = "account-picker-card";
    if (isCurrent) card.classList.add("is-current");

    const name = document.createElement("span");
    name.className = "account-picker-card-name";
    name.textContent = getAccountDisplayName(account);

    const meta = document.createElement("span");
    meta.className = "account-picker-card-meta";
    meta.textContent = isCurrent ? "Signed in now" : getAccountLoginId(account);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-secondary";
    removeBtn.textContent = "Remove";
    removeBtn.setAttribute("aria-label", `Remove ${getAccountDisplayName(account)} from this device`);
    removeBtn.addEventListener("click", () => handleRemoveSavedAccount(account.userId));

    card.append(name, meta, removeBtn);
    accountSettingsListEl.append(card);
  });
}

function openAccountSettings() {
  renderAccountSettingsList();
  accountSettingsDialog?.classList.remove("hidden");
  accountSettingsCloseBtn?.focus();
}

function closeAccountSettings() {
  accountSettingsDialog?.classList.add("hidden");
}

async function persistCurrentSessionWithUsername() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  const existing = getSavedAccounts().find(
    (account) => account.userId === data.session.user.id
  );
  persistSession(data.session, {
    username: getAccountUsername(),
    email: data.session.user.email ?? null,
    loginId: existing?.loginId,
    password: existing?.password,
  });
}

async function handleSwitchToLoginPicker() {
  try {
    await persistCurrentSessionWithUsername();
    await signOut();
    closeAccountSettings();
    setAuthMode("sign-in");
    showDefaultAuthPanel();
    navigation?.showAuthView();
    renderAuthSavedLogins();
  } catch (error) {
    console.error("Switch to login picker failed", error);
    alert("Could not open the sign-in screen. Try again.");
  }
}

async function handleAddAnotherAccount() {
  try {
    beginAddingAnotherAccount();
    updateAddAnotherHint();
    await handleSwitchToLoginPicker();
    if (authLoginIdInput) authLoginIdInput.value = "";
    if (authPasswordInput) authPasswordInput.value = "";
    authLoginIdInput?.focus();
  } catch (error) {
    console.error("Add another account failed", error);
    alert(error instanceof Error ? error.message : "Could not prepare another sign-in.");
  }
}

async function handleRemoveSavedAccount(userId) {
  const account = getSavedAccounts().find((entry) => entry.userId === userId);
  if (!account) return;

  const label = getAccountDisplayName(account);
  if (!confirm(`Remove "${label}" from this device? You will need to sign in again to use it.`)) {
    return;
  }

  const isCurrent = getCurrentUser()?.id === userId;
  removeSavedAccount(userId);
  renderAccountSettingsList();
  renderAuthSavedLogins();

  if (isCurrent) {
    await signOut();
    closeAccountSettings();
    setAuthMode("sign-in");
    navigation?.showAuthView();
  }
}

async function handleSignOutAll() {
  if (!confirm("Remove every saved family login from this device?")) return;
  try {
    await signOutEveryAccount();
    closeAccountSettings();
    setAuthMode("sign-in");
    navigation?.showAuthView();
  } catch (error) {
    console.error("Sign out all failed", error);
    alert("Could not sign out. Try again.");
  }
}

async function handleForgotPasswordSend() {
  const identifier = authForgotLoginIdInput?.value.trim() ?? "";
  if (!identifier) {
    setForgotStatus("Enter your email or family username.", true);
    authForgotLoginIdInput?.focus();
    return;
  }

  setForgotStatus("Sending reset link…");
  authForgotSendBtn.disabled = true;

  try {
    await requestPasswordReset(identifier);
    setForgotStatus("Check your email for a password reset link.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not send reset link. Try again.";
    setForgotStatus(message, true);
  } finally {
    authForgotSendBtn.disabled = false;
  }
}

async function handleResetPasswordSubmit() {
  const password = authNewPasswordInput?.value ?? "";
  const confirmPassword = authConfirmPasswordInput?.value ?? "";

  if (password.length < 6) {
    setResetStatus("Password must be at least 6 characters.", true);
    authNewPasswordInput?.focus();
    return;
  }
  if (password !== confirmPassword) {
    setResetStatus("Passwords do not match.", true);
    authConfirmPasswordInput?.focus();
    return;
  }

  setResetStatus("Updating password…");
  authResetPasswordBtn.disabled = true;

  try {
    await updatePassword(password);
    if (authNewPasswordInput) authNewPasswordInput.value = "";
    if (authConfirmPasswordInput) authConfirmPasswordInput.value = "";
    setResetStatus("Password updated. You are signed in.");
    await loadAccountUsername();
    const user = getCurrentUser();
    const saved = user
      ? getSavedAccounts().find((account) => account.userId === user.id)
      : null;
    const loginId = saved ? getAccountLoginId(saved) : user?.email ?? "";
    await persistLoginAfterSignIn(loginId, password);
    showDefaultAuthPanel();
    navigation?.resumeCurrentAccount();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update password. Try again.";
    setResetStatus(message, true);
  } finally {
    authResetPasswordBtn.disabled = false;
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!authPasswordInput) return;

  const password = authPasswordInput.value;

  if (password.length < 6) {
    setAuthStatus("Password must be at least 6 characters.", true);
    return;
  }

  setAuthStatus(authMode === "sign-in" ? "Signing in…" : "Creating account…");
  authSubmitBtn.disabled = true;

  try {
    if (authMode === "sign-in") {
      if (!authLoginIdInput) return;
      const identifier = authLoginIdInput.value.trim();
      if (!identifier) {
        setAuthStatus("Enter your email or family username.", true);
        return;
      }
      await signInWithIdentifier(identifier, password);
      await completeSignIn(identifier, password);
      return;
    }

    if (!authEmailInput || !authFamilyUsernameInput) return;

    const email = authEmailInput.value.trim();
    const familyUsername = normalizeFamilyUsername(authFamilyUsernameInput.value);

    if (!email) {
      setAuthStatus("Enter your family email address.", true);
      return;
    }
    if (!familyUsername) {
      setAuthStatus(
        "Choose a family username (3–32 letters, numbers, or underscores).",
        true
      );
      return;
    }

    await signUpWithPassword(email, password, familyUsername);
    setAuthStatus("Account created. You are signed in.");
    await completeSignIn(familyUsername, password);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong. Try again.";
    setAuthStatus(message, true);
  } finally {
    authSubmitBtn.disabled = false;
  }
}

export function bindAuthNavigation(nav) {
  navigation = nav;
}

export function initAuthPage() {
  authViewEl = document.getElementById("auth-view");
  authHeadingEl = document.getElementById("auth-heading");
  authSavedLoginsEl = document.getElementById("auth-saved-logins");
  authSavedLoginsListEl = document.getElementById("auth-saved-logins-list");
  accountSwitchBtn = document.getElementById("account-switch-btn");
  authModeToggleEl = document.getElementById("auth-mode-toggle");
  authFormEl = document.getElementById("auth-form");
  authModeSignInBtn = document.getElementById("auth-mode-sign-in");
  authModeSignUpBtn = document.getElementById("auth-mode-sign-up");
  authLoginIdInput = document.getElementById("auth-login-id");
  authEmailInput = document.getElementById("auth-email");
  authFamilyUsernameInput = document.getElementById("auth-family-username");
  authPasswordInput = document.getElementById("auth-password");
  authSubmitBtn = document.getElementById("auth-submit-btn");
  authStatusEl = document.getElementById("auth-status");
  authAddAnotherHintEl = document.getElementById("auth-add-another-hint");
  accountBarEl = document.getElementById("account-bar");
  accountUsernameEl = document.getElementById("account-username");
  accountSettingsBtn = document.getElementById("account-settings-btn");
  profilesSyncHint = document.getElementById("profiles-sync-hint");
  accountSettingsDialog = document.getElementById("account-settings-dialog");
  accountSettingsListEl = document.getElementById("account-settings-list");
  accountAddAnotherBtn = document.getElementById("account-add-another-btn");
  accountSettingsSignOutAllBtn = document.getElementById("account-settings-sign-out-all-btn");
  accountSettingsCloseBtn = document.getElementById("account-settings-close-btn");
  authForgotRowEl = document.getElementById("auth-forgot-row");
  authForgotPasswordBtn = document.getElementById("auth-forgot-password-btn");
  authForgotPasswordPanel = document.getElementById("auth-forgot-password-panel");
  authForgotLoginIdInput = document.getElementById("auth-forgot-login-id");
  authForgotSendBtn = document.getElementById("auth-forgot-send-btn");
  authForgotBackBtn = document.getElementById("auth-forgot-back-btn");
  authForgotStatusEl = document.getElementById("auth-forgot-status");
  authResetPasswordPanel = document.getElementById("auth-reset-password-panel");
  authNewPasswordInput = document.getElementById("auth-new-password");
  authConfirmPasswordInput = document.getElementById("auth-confirm-password");
  authResetPasswordBtn = document.getElementById("auth-reset-password-btn");
  authResetStatusEl = document.getElementById("auth-reset-status");

  authFormEl?.addEventListener("submit", handleAuthSubmit);

  authModeSignInBtn?.addEventListener("click", () => setAuthMode("sign-in"));
  authModeSignUpBtn?.addEventListener("click", () => setAuthMode("sign-up"));
  authForgotPasswordBtn?.addEventListener("click", showForgotPasswordPanel);
  authForgotSendBtn?.addEventListener("click", handleForgotPasswordSend);
  authForgotBackBtn?.addEventListener("click", () => {
    showDefaultAuthPanel();
    setAuthMode("sign-in");
  });
  authResetPasswordBtn?.addEventListener("click", handleResetPasswordSubmit);
  accountSettingsBtn?.addEventListener("click", openAccountSettings);
  accountSwitchBtn?.addEventListener("click", handleSwitchToLoginPicker);
  accountAddAnotherBtn?.addEventListener("click", handleAddAnotherAccount);
  accountSettingsSignOutAllBtn?.addEventListener("click", handleSignOutAll);
  accountSettingsCloseBtn?.addEventListener("click", closeAccountSettings);
  accountSettingsDialog
    ?.querySelector("[data-account-settings-dismiss]")
    ?.addEventListener("click", closeAccountSettings);

  authSavedLoginsListEl?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-saved-login-id]");
    if (!button) return;
    const account = getSavedAccounts().find(
      (entry) => entry.userId === button.dataset.savedLoginId
    );
    if (account) signInWithSavedAccount(account);
  });

  subscribePasswordRecovery((pending) => {
    if (pending) {
      navigation?.showAuthView();
      showResetPasswordPanel();
    }
  });

  subscribeAuth((user) => {
    updateAccountBar(user);
    renderAuthSavedLogins();
    if (isPasswordRecoveryPending()) {
      navigation?.showAuthView();
      return;
    }
    if (
      !user &&
      !isAddingAnotherAccount() &&
      !isAccountTransitionInProgress()
    ) {
      setAuthMode("sign-in");
      showDefaultAuthPanel();
      navigation?.showAuthView();
      renderAuthSavedLogins();
    }
    if (user) {
      updateAccountIdentity();
      renderAccountSettingsList();
      const authVisible = authViewEl && !authViewEl.classList.contains("hidden");
      if (
        authVisible &&
        !isAddingAnotherAccount() &&
        !isPasswordRecoveryPending() &&
        !isAccountTransitionInProgress()
      ) {
        navigation?.showHomeView();
      }
    }
  });

  subscribeAccountUsername(() => {
    updateAccountIdentity();
    renderAccountSettingsList();
  });

  subscribeSavedAccounts(() => {
    renderAccountSettingsList();
    renderAuthSavedLogins();
    updateAccountIdentity();
  });

  document.addEventListener("keydown", (event) => {
    if (!accountSettingsDialog?.classList.contains("hidden") && event.key === "Escape") {
      closeAccountSettings();
    }
  });

  setAuthMode("sign-in");
  if (isPasswordRecoveryPending()) {
    showResetPasswordPanel();
  } else {
    updateAuthPanels();
  }
  updateAddAnotherHint();
  updateAccountIdentity();
  updateAccountBar(getCurrentUser());
  renderAuthSavedLogins();
  renderAccountSettingsList();
}
