import { GAMES, DEFAULT_GAME_ID, getGameById, createGameModules } from "./catalog.js";
import { isSignedIn } from "./auth.js";
import { bindAuthNavigation } from "./auth-page.js";
import { bindProfileNavigation } from "./player-profile-page.js";

const appTitle = document.getElementById("app-title");
const appSubtitle = document.getElementById("app-subtitle");
const homeView = document.getElementById("home-view");
const authView = document.getElementById("auth-view");
const profilesView = document.getElementById("profiles-view");
const playerProfileView = document.getElementById("player-profile-view");
const gamePickerEl = document.getElementById("game-picker");
const setupView = document.getElementById("setup-view");
const gameView = document.getElementById("game-view");
const gameOverView = document.getElementById("game-over-view");
const confirmDialog = document.getElementById("confirm-dialog");
const confirmDialogMessage = document.getElementById("confirm-dialog-message");
const confirmDialogCancel = document.getElementById("confirm-dialog-cancel");
const confirmDialogConfirm = document.getElementById("confirm-dialog-confirm");

let selectedGameId = DEFAULT_GAME_ID;
let confirmDialogOnConfirm = null;

const shell = {
  showView,
  showExitGameConfirm,
  exitToHome,
};

const gameModules = createGameModules(shell);

function getActiveModule() {
  return gameModules[selectedGameId];
}

function showExitGameConfirm(onConfirm) {
  confirmDialogOnConfirm = onConfirm;
  confirmDialogMessage.textContent =
    "Are you sure you want to leave this game? All scores and progress will be lost.";
  confirmDialog.classList.remove("hidden");
  confirmDialogConfirm.focus();
}

function closeExitGameConfirm() {
  confirmDialog.classList.add("hidden");
  confirmDialogOnConfirm = null;
}

function confirmExitGame() {
  const onConfirm = confirmDialogOnConfirm;
  closeExitGameConfirm();
  onConfirm?.();
}

function updateAppHeader(view) {
  const gameDef = getGameById(selectedGameId);

  if (view === "home") {
    appTitle.textContent = "Game Scorer";
    appSubtitle.textContent = "Choose a game to start scoring";
    document.title = "Game Scorer";
    document.body.dataset.theme = "home";
    return;
  }

  if (view === "auth") {
    appTitle.textContent = "Game Scorer";
    appSubtitle.textContent = "Sign in to continue";
    document.title = "Sign in — Game Scorer";
    document.body.dataset.theme = "home";
    return;
  }

  if (view === "player-profile") {
    document.body.dataset.theme = "home";
    document.title = `${appTitle.textContent} — Game Scorer`;
    return;
  }

  if (gameDef) {
    appTitle.textContent = `${gameDef.icon} ${gameDef.name}`;
    document.title = `${gameDef.name} — Game Scorer`;
    document.body.dataset.theme = gameDef.theme ?? selectedGameId;

    if (view === "setup") {
      appSubtitle.textContent = gameDef.description;
    } else if (view === "over") {
      appSubtitle.textContent = "Final standings";
    } else {
      appSubtitle.textContent = gameDef.tagline ?? "Track scores round by round";
    }
  }
}

function showView(view, gameId = selectedGameId) {
  if (view !== "auth" && !isSignedIn()) {
    selectedGameId = DEFAULT_GAME_ID;
    view = "auth";
    gameId = DEFAULT_GAME_ID;
  }

  const isSkullKing = gameId === "skull-king";
  const isFlip7 = gameId === "flip7";
  const isRook = gameId === "rook";

  homeView.classList.toggle("hidden", view !== "home");
  authView?.classList.toggle("hidden", view !== "auth");
  profilesView?.classList.toggle("hidden", view !== "home");
  playerProfileView?.classList.toggle("hidden", view !== "player-profile");
  setupView.classList.toggle("hidden", view !== "setup");

  document.getElementById("skull-king-setup").classList.toggle("hidden", view !== "setup" || !isSkullKing);
  document.getElementById("flip7-setup").classList.toggle("hidden", view !== "setup" || !isFlip7);
  document.getElementById("rook-setup").classList.toggle("hidden", view !== "setup" || !isRook);

  gameView.classList.toggle("hidden", view !== "game");
  document.getElementById("skull-king-game-panel").classList.toggle("hidden", view !== "game" || !isSkullKing);
  document.getElementById("flip7-game-panel").classList.toggle("hidden", view !== "game" || !isFlip7);
  document.getElementById("rook-game-panel").classList.toggle("hidden", view !== "game" || !isRook);

  gameOverView.classList.toggle("hidden", view !== "over");
  document.getElementById("skull-king-game-over-panel").classList.toggle("hidden", view !== "over" || !isSkullKing);
  document.getElementById("flip7-game-over-panel").classList.toggle("hidden", view !== "over" || !isFlip7);
  document.getElementById("rook-game-over-panel").classList.toggle("hidden", view !== "over" || !isRook);

  if (!isSkullKing || view === "home" || view === "setup") {
    document.getElementById("round-detail-view").classList.add("hidden");
  }

  updateAppHeader(view);
}

function renderGamePicker() {
  gamePickerEl.innerHTML = GAMES.map((gameDef) => {
    const badge = gameDef.available
      ? '<span class="game-card-badge">Available</span>'
      : '<span class="game-card-badge soon">Coming soon</span>';

    return `
      <button
        type="button"
        class="game-card"
        data-game-id="${gameDef.id}"
        ${gameDef.available ? "" : "disabled"}
        aria-label="${gameDef.name}${gameDef.available ? "" : " (coming soon)"}"
      >
        <span class="game-card-icon" aria-hidden="true">${gameDef.icon}</span>
        <span class="game-card-body">
          <p class="game-card-name">${gameDef.name}</p>
          <p class="game-card-desc">${gameDef.description}</p>
          ${badge}
        </span>
      </button>
    `;
  }).join("");
}

function showHomeView() {
  if (!isSignedIn()) {
    showAuthView();
    return;
  }
  selectedGameId = DEFAULT_GAME_ID;
  showView("home");
}

function showAuthView() {
  selectedGameId = DEFAULT_GAME_ID;
  showView("auth");
}

function selectGame(gameId) {
  const gameDef = getGameById(gameId);
  if (!gameDef?.available) return;
  selectedGameId = gameId;
  getActiveModule().initSetupView();
  getActiveModule().onSetupVisible?.();
}

function exitToHome() {
  Object.values(gameModules).forEach((mod) => mod.clearGame());
  showHomeView();
}

function initFromSavedGame() {
  if (gameModules["skull-king"].hasSavedGame()) {
    selectedGameId = "skull-king";
    if (gameModules["skull-king"].loadSavedGame()) return;
  }
  if (gameModules.flip7.hasSavedGame()) {
    selectedGameId = "flip7";
    if (gameModules.flip7.loadSavedGame()) return;
  }
  if (gameModules.rook.hasSavedGame()) {
    selectedGameId = "rook";
    if (gameModules.rook.loadSavedGame()) return;
  }
  showHomeView();
}

bindProfileNavigation({
  showView,
  showHomeView,
  resumeSetup(gameId) {
    selectedGameId = gameId;
    showView("setup", gameId);
    getActiveModule().onSetupVisible?.();
  },
});

bindAuthNavigation({
  showAuthView,
  showHomeView,
});

function wireShellEvents() {
  gamePickerEl.addEventListener("click", (event) => {
    const card = event.target.closest("[data-game-id]");
    if (!card) return;
    selectGame(card.dataset.gameId);
  });

  document.getElementById("back-to-home-btn").addEventListener("click", showHomeView);
  document.getElementById("game-over-back-to-home-btn")?.addEventListener("click", showHomeView);

  confirmDialogCancel.addEventListener("click", closeExitGameConfirm);
  confirmDialogConfirm.addEventListener("click", confirmExitGame);
  confirmDialog.querySelector("[data-confirm-dismiss]").addEventListener("click", closeExitGameConfirm);

  document.addEventListener("keydown", (event) => {
    if (!confirmDialog.classList.contains("hidden") && event.key === "Escape") {
      closeExitGameConfirm();
      return;
    }
    const mod = getActiveModule();
    if (mod?.isSettingsOpen?.() && event.key === "Escape") {
      mod.handleSettingsEscape();
    }
  });
}

export async function startApp() {
  renderGamePicker();
  wireShellEvents();

  if (!isSignedIn()) {
    showAuthView();
    return;
  }

  initFromSavedGame();
}
