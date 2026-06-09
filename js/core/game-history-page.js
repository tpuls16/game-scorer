import { getRecentGameHistory, loadGameHistory } from "./game-history.js";
import { renderHistoryEntries } from "./history-render.js";
import { showPlayerProfile } from "./player-profile-page.js";

let recentGamesListEl = null;
let viewAllBtn = null;
let gameHistoryViewEl = null;
let gameHistoryListEl = null;
let gameHistoryBackBtn = null;

/** @type {{ showView: (view: string, gameId?: string) => void, showHomeView: () => void } | null} */
let navigation = null;

export function bindGameHistoryNavigation(nav) {
  navigation = nav;
}

export function showGameHistory() {
  if (!navigation || !gameHistoryListEl) return;

  renderHistoryEntries(gameHistoryListEl, loadGameHistory(), {
    onPlayerClick: (profileId) => showPlayerProfile(profileId, { view: "game-history" }),
    emptyMessage: "No completed games yet. Finish a game to see it here.",
  });

  navigation.showView("game-history");
}

function closeGameHistory() {
  navigation?.showHomeView();
}

export function renderHomeRecentGames() {
  if (!recentGamesListEl) return;

  const entries = getRecentGameHistory(3);

  renderHistoryEntries(recentGamesListEl, entries, {
    compact: true,
    maxStandings: 3,
    emptyMessage: "No completed games yet. Finish a game to see scorecards here.",
  });
}

export function initGameHistoryPage() {
  recentGamesListEl = document.getElementById("recent-games-list");
  viewAllBtn = document.getElementById("recent-games-view-all-btn");
  gameHistoryViewEl = document.getElementById("game-history-view");
  gameHistoryListEl = document.getElementById("game-history-list");
  gameHistoryBackBtn = document.getElementById("game-history-back-btn");

  viewAllBtn?.addEventListener("click", showGameHistory);
  gameHistoryBackBtn?.addEventListener("click", closeGameHistory);

  document.addEventListener("keydown", (event) => {
    if (gameHistoryViewEl?.classList.contains("hidden")) return;
    if (event.key === "Escape") closeGameHistory();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGameHistoryPage);
} else {
  initGameHistoryPage();
}
