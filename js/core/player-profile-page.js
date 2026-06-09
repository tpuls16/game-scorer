import { getProfileById } from "./profiles.js";
import {
  formatHistoryDate,
  getHistoryForProfile,
  resolveHistoryPlayerProfile,
} from "./game-history.js";

/** @typedef {{ view: "home" | "setup", gameId?: string }} ProfileBackContext */

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

/**
 * @param {import("./game-history.js").HistoryPlayerResult} player
 * @param {string} viewingProfileId
 */
function createHistoryPlayerName(player, viewingProfileId) {
  const profile = resolveHistoryPlayerProfile(player);

  if (profile && profile.id !== viewingProfileId) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "history-player-link";
    btn.textContent = player.name;
    btn.addEventListener("click", () => showPlayerProfile(profile.id, backContext));
    return btn;
  }

  const span = document.createElement("span");
  span.textContent = player.name;
  if (player.guest) span.className = "history-player-guest";
  return span;
}

function renderProfileHistory(profileId) {
  if (!profileHistoryEl) return;

  const entries = getHistoryForProfile(profileId);
  profileHistoryEl.innerHTML = "";

  profileComingSoonEl?.classList.toggle("hidden", entries.length > 0);

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No completed games yet for this player.";
    profileHistoryEl.append(empty);
    return;
  }

  entries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "history-entry";

    const header = document.createElement("header");
    header.className = "history-entry-header";

    const title = document.createElement("h4");
    title.className = "history-entry-title";
    title.textContent = entry.gameName;

    const date = document.createElement("p");
    date.className = "hint history-entry-date";
    date.textContent = formatHistoryDate(entry.completedAt);

    header.append(title, date);

    const list = document.createElement("ol");
    list.className = "history-entry-standings";

    const sortedPlayers = [...entry.players].sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
    sortedPlayers.forEach((player) => {
      const item = document.createElement("li");
      item.className = "history-entry-player";

      const place = document.createElement("span");
      place.className = "history-entry-place";
      place.textContent = `${player.place ?? "—"}.`;

      const nameWrap = document.createElement("span");
      nameWrap.className = "history-entry-player-name";
      nameWrap.append(createHistoryPlayerName(player, profileId));

      const score = document.createElement("span");
      score.className = "history-entry-score";
      score.textContent =
        typeof player.score === "number" ? `${player.score} pts` : "";

      if (player.detail) {
        const detail = document.createElement("span");
        detail.className = "hint history-entry-detail";
        detail.textContent = player.detail;
        item.append(place, nameWrap, detail, score);
      } else {
        item.append(place, nameWrap, score);
      }

      list.append(item);
    });

    card.append(header, list);
    profileHistoryEl.append(card);
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
