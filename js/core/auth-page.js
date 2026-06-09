import {
  getCurrentUser,
  signInWithIdentifier,
  signOut,
  signUpWithPassword,
  subscribeAuth,
} from "./auth.js";
import {
  getAccountUsername,
  loadAccountUsername,
  normalizeFamilyUsername,
  subscribeAccountUsername,
} from "./account-username.js";

/** @type {{ showAuthView: () => void, showHomeView: () => void } | null} */
let navigation = null;

let authModeSignInBtn = null;
let authModeSignUpBtn = null;
let authLoginIdInput = null;
let authEmailInput = null;
let authFamilyUsernameInput = null;
let authPasswordInput = null;
let authSubmitBtn = null;
let authStatusEl = null;
let accountBarEl = null;
let accountUsernameEl = null;
let accountSignOutBtn = null;
let profilesSyncHint = null;

/** @type {"sign-in" | "sign-up"} */
let authMode = "sign-in";

function setAuthStatus(message, isError = false) {
  if (!authStatusEl) return;
  authStatusEl.textContent = message;
  authStatusEl.classList.toggle("auth-status-error", isError);
  authStatusEl.classList.toggle("hidden", !message);
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignUp = mode === "sign-up";

  authModeSignInBtn?.classList.toggle("is-active", !isSignUp);
  authModeSignUpBtn?.classList.toggle("is-active", isSignUp);

  document.getElementById("auth-sign-in-fields")?.classList.toggle("hidden", isSignUp);
  document.getElementById("auth-sign-up-fields")?.classList.toggle("hidden", !isSignUp);

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
}

function updateAccountBar(user) {
  if (!accountBarEl) return;
  accountBarEl.classList.toggle("hidden", !user);
  profilesSyncHint?.classList.toggle("hidden", !user);
}

function updateAccountIdentity() {
  if (accountUsernameEl) {
    accountUsernameEl.textContent = getAccountUsername() ?? "";
    accountUsernameEl.classList.toggle("hidden", !getAccountUsername());
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
      setAuthStatus("");
      navigation?.showHomeView();
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
    await loadAccountUsername();
    setAuthStatus("Account created. You are signed in.");
    navigation?.showHomeView();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong. Try again.";
    setAuthStatus(message, true);
  } finally {
    authSubmitBtn.disabled = false;
  }
}

async function handleSignOut() {
  try {
    await signOut();
    setAuthMode("sign-in");
    navigation?.showAuthView();
  } catch (error) {
    console.error("Sign out failed", error);
    alert("Could not sign out. Try again.");
  }
}

export function bindAuthNavigation(nav) {
  navigation = nav;
}

export function initAuthPage() {
  authModeSignInBtn = document.getElementById("auth-mode-sign-in");
  authModeSignUpBtn = document.getElementById("auth-mode-sign-up");
  authLoginIdInput = document.getElementById("auth-login-id");
  authEmailInput = document.getElementById("auth-email");
  authFamilyUsernameInput = document.getElementById("auth-family-username");
  authPasswordInput = document.getElementById("auth-password");
  authSubmitBtn = document.getElementById("auth-submit-btn");
  authStatusEl = document.getElementById("auth-status");
  accountBarEl = document.getElementById("account-bar");
  accountUsernameEl = document.getElementById("account-username");
  accountSignOutBtn = document.getElementById("account-sign-out-btn");
  profilesSyncHint = document.getElementById("profiles-sync-hint");

  const authForm = document.getElementById("auth-form");
  authForm?.addEventListener("submit", handleAuthSubmit);

  authModeSignInBtn?.addEventListener("click", () => setAuthMode("sign-in"));
  authModeSignUpBtn?.addEventListener("click", () => setAuthMode("sign-up"));
  accountSignOutBtn?.addEventListener("click", handleSignOut);

  subscribeAuth((user) => {
    updateAccountBar(user);
    if (!user) {
      setAuthMode("sign-in");
      navigation?.showAuthView();
    }
  });

  subscribeAccountUsername(() => {
    updateAccountIdentity();
  });

  setAuthMode("sign-in");
  updateAccountIdentity();
  updateAccountBar(getCurrentUser());
}
