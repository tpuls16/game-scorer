import {
  getCurrentUser,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  subscribeAuth,
} from "./auth.js";

/** @type {{ showAuthView: () => void, showHomeView: () => void } | null} */
let navigation = null;

let authModeSignInBtn = null;
let authModeSignUpBtn = null;
let authEmailInput = null;
let authPasswordInput = null;
let authSubmitBtn = null;
let authStatusEl = null;
let accountBarEl = null;
let accountEmailEl = null;
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
  authModeSignInBtn?.classList.toggle("is-active", mode === "sign-in");
  authModeSignUpBtn?.classList.toggle("is-active", mode === "sign-up");
  if (authSubmitBtn) {
    authSubmitBtn.textContent = mode === "sign-in" ? "Sign in" : "Create account";
  }
  if (authPasswordInput) {
    authPasswordInput.autocomplete = mode === "sign-in" ? "current-password" : "new-password";
  }
  setAuthStatus("");
}

function updateAccountBar(user) {
  if (!accountBarEl) return;

  const signedIn = Boolean(user);
  accountBarEl.classList.toggle("hidden", !signedIn);
  profilesSyncHint?.classList.toggle("hidden", !signedIn);

  if (signedIn && accountEmailEl) {
    accountEmailEl.textContent = user.email ?? "Signed in";
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!authEmailInput || !authPasswordInput) return;

  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;

  if (!email) {
    setAuthStatus("Enter your email address.", true);
    return;
  }
  if (password.length < 6) {
    setAuthStatus("Password must be at least 6 characters.", true);
    return;
  }

  setAuthStatus(authMode === "sign-in" ? "Signing in…" : "Creating account…");
  authSubmitBtn.disabled = true;

  try {
    if (authMode === "sign-in") {
      await signInWithPassword(email, password);
      setAuthStatus("");
      navigation?.showHomeView();
    } else {
      await signUpWithPassword(email, password);
      setAuthStatus("Account created. You are signed in.");
      navigation?.showHomeView();
    }
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
  authEmailInput = document.getElementById("auth-email");
  authPasswordInput = document.getElementById("auth-password");
  authSubmitBtn = document.getElementById("auth-submit-btn");
  authStatusEl = document.getElementById("auth-status");
  accountBarEl = document.getElementById("account-bar");
  accountEmailEl = document.getElementById("account-email");
  accountSignOutBtn = document.getElementById("account-sign-out-btn");
  profilesSyncHint = document.getElementById("profiles-sync-hint");

  const authForm = document.getElementById("auth-form");
  authForm?.addEventListener("submit", handleAuthSubmit);

  authModeSignInBtn?.addEventListener("click", () => setAuthMode("sign-in"));
  authModeSignUpBtn?.addEventListener("click", () => setAuthMode("sign-up"));

  accountSignOutBtn?.addEventListener("click", () => {
    handleSignOut();
  });

  subscribeAuth((user) => {
    updateAccountBar(user);
    if (!user) {
      navigation?.showAuthView();
    }
  });

  setAuthMode("sign-in");
  updateAccountBar(getCurrentUser());
}
