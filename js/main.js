import { initAuth } from "./core/auth.js";
import "./core/account-username.js";
import { initAuthPage } from "./core/auth-page.js";
import { initProfileSync } from "./core/profile-sync.js";
import "./core/player-profile-page.js";
import "./core/game-history-page.js";
import { initProfilesPage } from "./core/profiles-page.js";
import { startApp } from "./core/shell.js";

async function boot() {
  await initAuth();
  initProfileSync();
  initAuthPage();
  initProfilesPage();
  await startApp();
}

boot().catch((error) => {
  console.error("App failed to start", error);
});
