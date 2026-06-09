import { initAuth } from "./core/auth.js";
import { initAuthPage } from "./core/auth-page.js";
import { initHouseholdsPage } from "./core/households-page.js";
import { initProfileSync } from "./core/profile-sync.js";
import "./core/player-profile-page.js";
import "./core/profiles-page.js";
import { startApp } from "./core/shell.js";

async function boot() {
  await initAuth();
  initProfileSync();
  initAuthPage();
  initHouseholdsPage();
  startApp();
}

boot().catch((error) => {
  console.error("App failed to start", error);
});
