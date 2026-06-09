import { getProfileById } from "./profiles.js";
import { getHistoryForProfile } from "./game-history.js";
import { renderHistoryEntries } from "./history-render.js";

/** @typedef {{ view: "home" | "setup" | "game-history", gameId?: string }} ProfileBackContext */

let profileTitleEl = null;
let profileHistoryEl = null;
let profileComingSoonEl = null;
let backBtn = null;

/** @type {ProfileBackContext} */
let backContext = { view: "home" };

/** @type {{ showView: (view: string, gameId?: string) => void, showHomeView: () => void, resumeSetup: (gameId: string) => void } | null} */
let navigation = null;

/** @type {string | null} */
let currentProfileId = null;

export function bindProfileNavigation(nav) {
  navigation = nav;
}

function renderProfileHistory(profileId) {
  if (!profileHistoryEl) return;

  const entries = getHistoryForProfile(profileId);
  profileComingSoonEl?.classList.toggle("hidden", entries.length > 0);

  renderHistoryEntries(profileHistoryEl, entries, {
    viewingProfileId: profileId,
    onPlayerClick: (id) => showPlayerProfile(id, backContext),
    emptyMessage: "No completed games yet for this player.",
  });
}

export function showPlayerProfile(profileId, context = { view: "home" }) {
  const profile = getProfileById(profileId);
  if (!profile || !navigation) return;

  currentProfileId = profileId;
  backContext = context;
  if (profileTitleEl) profileTitleEl.textContent = profile.name;
  renderProfileHistory(profileId);

  const appTitle = document.getElementById("app-title");
  const appSubtitle = document.getElementById("app-subtitle");
  if (appTitle) appTitle.textContent = profile.name;
  if (appSubtitle) appSubtitle.textContent = "Player profile";
  document.title = `${profile.name} — Game Scorer`;

  navigation.showView("player-profile");
}

function closePlayerProfile() {
  if (!navigation) return;

  if (backContext.view === "setup" && backContext.gameId) {
    navigation.resumeSetup(backContext.gameId);
    return;
  }
  if (backContext.view === "game-history") {
    navigation.showView("game-history");
    return;
  }
  navigation.showHomeView();
}

export function initPlayerProfilePage() {
  profileTitleEl = document.getElementById("player-profile-title");
  profileHistoryEl = document.getElementById("player-profile-history");
  profileComingSoonEl = document.getElementById("player-profile-coming-soon");
  backBtn = document.getElementById("player-profile-back-btn");

  backBtn?.addEventListener("click", closePlayerProfile);

  document.addEventListener("keydown", (event) => {
    const view = document.getElementById("player-profile-view");
    if (view?.classList.contains("hidden")) return;
    if (event.key === "Escape") closePlayerProfile();
  });
}

/**
 * @param {{ id: string, name: string }} profile
 * @param {ProfileBackContext} [context]
 */
export function createProfileOpenButton(profile, context = { view: "home" }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-secondary btn-profile-open";
  btn.textContent = "Profile";
  btn.setAttribute("aria-label", `Open ${profile.name} profile`);
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    showPlayerProfile(profile.id, context);
  });
  return btn;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPlayerProfilePage);
} else {
  initPlayerProfilePage();
}
