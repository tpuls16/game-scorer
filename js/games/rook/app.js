import {
  MIN_PLAYERS,
  MAX_PLAYERS,
  DEFAULT_TOTAL_HANDS,
  DEFAULT_TARGET_SCORE,
  ROOK_DECK_SIZE,
  GAME_DISPLAY_NAME,
  RULES_NAME,
  MIN_BID,
  MAX_BID,
  DEFAULT_BID,
  BID_INCREMENT,
  COUNTERS_PER_HAND,
  calculateHandScore,
  countersTotalIsValid,
  describeCountersTotal,
  handScoringIsReady,
  countCardPointsFromCaptures,
  formatScore,
  getTeamTotals,
  hasReachedTarget,
  buildTeamLabels,
} from "./scoring.js";
import { tryRecordGameHistory } from "../../core/game-history.js";
import { mapRookPlayers, rosterRefsFromGamePlayers } from "../../core/game-players.js";
import { createPlayerPicker } from "../../core/player-picker.js";
import { scopedStorageKey } from "../../core/user-storage.js";

const STORAGE_KEY_BASE = "game-scorer-rook";

function gameStorageKey() {
  return scopedStorageKey(STORAGE_KEY_BASE);
}

/** @type {{ showView: (view: string, gameId: string) => void, showExitGameConfirm: (fn: () => void) => void, exitToHome: () => void } | null} */
let shellRef = null;

function showView(view) {
  shellRef?.showView(view, "rook");
}

/** @type {ReturnType<typeof createPlayerPicker>} */
let setupPlayerPicker;
/** @type {ReturnType<typeof createPlayerPicker>} */
let settingsPlayerPicker;

const totalHandsInput = document.getElementById("rook-total-hands");
const targetScoreInput = document.getElementById("rook-target-score");
const kittyPointsInput = document.getElementById("rook-kitty-points");
const teamPreviewEl = document.getElementById("rook-team-preview");
const roundBadge = document.getElementById("rook-round-badge");
const roundInfo = document.getElementById("rook-round-info");
const handForm = document.getElementById("rook-hand-form");
const scoreHandBtn = handForm?.querySelector('button[type="submit"]');
const handTeamInputsEl = document.getElementById("rook-hand-team-inputs");
const handPreviewEl = document.getElementById("rook-hand-preview");
const bidInput = document.getElementById("rook-bid");
const bidDisplay = document.getElementById("rook-bid-display");
const bidDecreaseBtn = document.getElementById("rook-bid-decrease");
const bidIncreaseBtn = document.getElementById("rook-bid-increase");
const undoHandBtn = document.getElementById("rook-undo-hand-btn");
const leaderBanner = document.getElementById("rook-leader-banner");
const scoreboard = document.getElementById("rook-scoreboard");
const gameOverScoreboard = document.getElementById("rook-game-over-scoreboard");
const winnerText = document.getElementById("rook-winner-text");
const finalStandings = document.getElementById("rook-final-standings");
const settingsDialog = document.getElementById("rook-settings-dialog");
const settingsTotalHandsInput = document.getElementById("rook-settings-total-hands");
const settingsTargetScoreInput = document.getElementById("rook-settings-target-score");

/** @type {ReturnType<typeof import("./scoring.js").createEmptyGame> | null} */
let game = null;

function initPlayerPickers() {
  const profileBackContext = { view: "setup", gameId: "rook" };
  setupPlayerPicker = createPlayerPicker(document.getElementById("rook-player-picker"), {
    maxPlayers: MAX_PLAYERS,
    profileBackContext,
    onChange: renderSetupTeamPreview,
  });
  settingsPlayerPicker = createPlayerPicker(document.getElementById("rook-settings-player-picker"), {
    maxPlayers: MAX_PLAYERS,
    profileBackContext,
  });
}

function saveGame() {
  if (game) localStorage.setItem(gameStorageKey(), JSON.stringify(game));
}

function loadGame() {
  const saved = localStorage.getItem(gameStorageKey());
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

function clearGame() {
  localStorage.removeItem(gameStorageKey());
  game = null;
}

/** @param {import("../../core/game-players.js").GamePlayerRef[]} playerRefs @param {{ totalHands?: number, targetScore?: number }} [options] */
function createEmptyGame(playerRefs, options = {}) {
  const names = playerRefs.map((player) => player.name);
  const teamIndices = [
    [0, 1],
    [2, 3],
  ];
  const teamLabels = buildTeamLabels(names, teamIndices);
  return {
    gameId: "rook",
    players: mapRookPlayers(playerRefs),
    teams: teamIndices,
    teamLabels,
    rounds: [],
    currentHand: 1,
    totalHands: options.totalHands ?? DEFAULT_TOTAL_HANDS,
    targetScore: options.targetScore ?? DEFAULT_TARGET_SCORE,
    completed: false,
  };
}

/** @param {ReturnType<createEmptyGame>} saved */
function normalizeSavedGame(saved) {
  saved.gameId = "rook";
  saved.totalHands = Math.max(1, Math.min(30, Number(saved.totalHands) || DEFAULT_TOTAL_HANDS));
  saved.targetScore = Math.max(100, Math.min(1000, Number(saved.targetScore) || DEFAULT_TARGET_SCORE));
  saved.currentHand = Math.max(1, Number(saved.currentHand) || 1);
  saved.rounds = Array.isArray(saved.rounds) ? saved.rounds : [];
  saved.completed = Boolean(saved.completed);

  const names = saved.players?.map((p) => p.name) ?? [];
  saved.teams = [
    [0, 1],
    [2, 3],
  ];
  saved.teamLabels = buildTeamLabels(names, saved.teams);
  saved.rounds = saved.rounds.map((round) => normalizeSavedRound(round, saved.teams));
  return saved;
}

/** @param {Record<string, unknown>} round @param {[number, number][]} teams */
function normalizeSavedRound(round, teams) {
  if (!Array.isArray(round.trickPoints) && round.teamCounts) {
    const counts = /** @type {[import("./scoring.js").TeamCaptureCounts, import("./scoring.js").TeamCaptureCounts]} */ ([
      round.teamCounts[0],
      round.teamCounts[1],
    ]);
    round.trickPoints = [
      countCardPointsFromCaptures(counts[0]),
      countCardPointsFromCaptures(counts[1]),
    ];
    delete round.teamCounts;
  }

  if (round.kittyPlayerIndex == null && round.kittyTeam != null) {
    const kittyTeam = Number(round.kittyTeam) === 1 ? 1 : 0;
    round.kittyPlayerIndex = teams[kittyTeam]?.[0] ?? 0;
  }

  return round;
}

/** @param {number} bid */
function setBidValue(bid) {
  const clamped = Math.max(MIN_BID, Math.min(MAX_BID, Math.round(bid / BID_INCREMENT) * BID_INCREMENT));
  if (bidInput) bidInput.value = String(clamped);
  if (bidDisplay) bidDisplay.textContent = String(clamped);
  if (bidDecreaseBtn) bidDecreaseBtn.disabled = clamped <= MIN_BID;
  if (bidIncreaseBtn) bidIncreaseBtn.disabled = clamped >= MAX_BID;
}

function renderSetupTeamPreview() {
  if (!teamPreviewEl) return;
  const names = setupPlayerPicker.getPlayerNames();
  if (names.length !== MAX_PLAYERS) {
    teamPreviewEl.textContent =
      names.length < MAX_PLAYERS
        ? `Select ${MAX_PLAYERS} players to preview teams.`
        : `${GAME_DISPLAY_NAME} uses exactly ${MAX_PLAYERS} players. Remove extras.`;
    return;
  }
  const labels = buildTeamLabels(names, [
    [0, 1],
    [2, 3],
  ]);
  teamPreviewEl.innerHTML = `
    <p><strong>Team 1:</strong> ${labels[0]}</p>
    <p><strong>Team 2:</strong> ${labels[1]}</p>
    <p class="hint">Partners are the 1st &amp; 2nd players listed vs. 3rd &amp; 4th. Reorder using remove/add if needed.</p>
  `;
}

function renderSetupInputs() {
  setupPlayerPicker.setPlayerNames([]);
  if (totalHandsInput) totalHandsInput.value = String(DEFAULT_TOTAL_HANDS);
  if (targetScoreInput) targetScoreInput.value = String(DEFAULT_TARGET_SCORE);
  renderSetupTeamPreview();
}

function initSetupView() {
  setupPlayerPicker?.refreshProfiles?.();
  renderSetupInputs();
  showView("setup");
}

/**
 * @param {string} selector
 * @param {number} teamIndex
 */
function selectExclusiveTeamButton(selector, teamIndex) {
  handTeamInputsEl?.querySelectorAll(selector).forEach((btn) => {
    const selected = Number(btn.dataset.teamIndex) === teamIndex;
    btn.classList.toggle("is-selected", selected);
    btn.setAttribute("aria-pressed", String(selected));
  });
}

/** @param {string} selector */
function clearExclusiveTeamButton(selector) {
  handTeamInputsEl?.querySelectorAll(selector).forEach((btn) => {
    btn.classList.remove("is-selected");
    btn.setAttribute("aria-pressed", "false");
  });
}

/** @param {string} selector @returns {0 | 1 | null} */
function readSelectedTeamButton(selector) {
  const selected = handTeamInputsEl?.querySelector(`${selector}.is-selected`);
  if (!selected) return null;
  return Number(selected.dataset.teamIndex) === 1 ? 1 : 0;
}

/**
 * @param {number} teamIndex
 * @param {string} label
 */
function buildTeamCaptureSection(teamIndex, label) {
  const section = document.createElement("div");
  section.className = "rook-team-capture";
  section.dataset.teamIndex = String(teamIndex);

  const header = document.createElement("div");
  header.className = "rook-team-header";

  const heading = document.createElement("h4");
  heading.textContent = label;

  const actions = document.createElement("div");
  actions.className = "rook-team-actions";

  const bidBtn = document.createElement("button");
  bidBtn.type = "button";
  bidBtn.className = "btn btn-secondary rook-team-toggle rook-bid-btn";
  bidBtn.dataset.teamIndex = String(teamIndex);
  bidBtn.textContent = "Bid";
  bidBtn.setAttribute("aria-pressed", "false");
  bidBtn.addEventListener("click", () => {
    selectExclusiveTeamButton(".rook-bid-btn", teamIndex);
    updateHandPreview();
  });

  const kittyBtn = document.createElement("button");
  kittyBtn.type = "button";
  kittyBtn.className = "btn btn-secondary rook-team-toggle rook-kitty-btn";
  kittyBtn.dataset.teamIndex = String(teamIndex);
  kittyBtn.textContent = "Kitty";
  kittyBtn.setAttribute("aria-pressed", "false");
  kittyBtn.addEventListener("click", () => {
    selectExclusiveTeamButton(".rook-kitty-btn", teamIndex);
    updateHandPreview();
  });

  actions.append(bidBtn, kittyBtn);
  header.append(heading, actions);

  const pointsLabel = document.createElement("label");
  pointsLabel.htmlFor = `rook-t${teamIndex}-points`;
  pointsLabel.textContent = "Points in tricks";
  const pointsInput = document.createElement("input");
  pointsInput.type = "number";
  pointsInput.id = `rook-t${teamIndex}-points`;
  pointsInput.min = "0";
  pointsInput.max = String(COUNTERS_PER_HAND);
  pointsInput.value = "0";
  pointsInput.dataset.teamIndex = String(teamIndex);
  pointsInput.dataset.field = "trick-points";
  pointsInput.addEventListener("input", updateHandPreview);
  pointsLabel.append(pointsInput);

  section.append(header, pointsLabel);
  return section;
}

function renderHandForm() {
  if (!game || !handTeamInputsEl) return;

  handTeamInputsEl.innerHTML = "";
  game.teamLabels.forEach((label, index) => {
    handTeamInputsEl.append(buildTeamCaptureSection(index, label));
  });
  setBidValue(DEFAULT_BID);
  if (kittyPointsInput) kittyPointsInput.value = "0";
  selectExclusiveTeamButton(".rook-bid-btn", 0);
  clearExclusiveTeamButton(".rook-kitty-btn");
  updateHandPreview();
}

function readHandFormInput() {
  const trickPoints = /** @type {[number, number]} */ ([0, 0]);
  handTeamInputsEl?.querySelectorAll('[data-field="trick-points"]').forEach((el) => {
    const teamIndex = Number(el.dataset.teamIndex);
    if (teamIndex === 0 || teamIndex === 1) {
      trickPoints[teamIndex] = Number(el.value);
    }
  });

  const kittyPoints = Number(kittyPointsInput?.value ?? 0);
  const biddingTeam = readSelectedTeamButton(".rook-bid-btn") ?? 0;
  const kittyTeamSelected = readSelectedTeamButton(".rook-kitty-btn");

  return {
    bid: Number(bidInput?.value ?? DEFAULT_BID),
    biddingTeam: /** @type {0 | 1} */ (biddingTeam),
    trickPoints,
    kittyTeam: kittyPoints > 0 ? kittyTeamSelected : /** @type {0 | 1} */ (0),
    kittyPoints,
  };
}

function updateHandPreview() {
  if (!game || !handPreviewEl) return;
  const input = readHandFormInput();
  const counterStatus = describeCountersTotal(input.trickPoints, input.kittyPoints);
  const countersValid = counterStatus.valid;
  const ready = handScoringIsReady(
    input.trickPoints,
    input.kittyPoints,
    input.biddingTeam,
    input.kittyPoints > 0 ? input.kittyTeam : 0
  );
  const needsKittyTeam = input.kittyPoints > 0 && input.kittyTeam !== 0 && input.kittyTeam !== 1;

  handPreviewEl.classList.toggle("rook-counters-valid", ready);
  handPreviewEl.classList.toggle("rook-counters-invalid", !ready);
  if (scoreHandBtn) scoreHandBtn.disabled = !ready;

  if (!countersValid) {
    handPreviewEl.textContent = counterStatus.text;
    return;
  }

  if (needsKittyTeam) {
    handPreviewEl.textContent = `${counterStatus.text}. Select which team won the kitty.`;
    return;
  }

  const preview = calculateHandScore(input);
  const bidder = game.teamLabels[input.biddingTeam];
  const sweepNote =
    preview.sweepTeam !== null
      ? ` Sweep: ${game.teamLabels[preview.sweepTeam]} +20.`
      : "";
  handPreviewEl.textContent = `${counterStatus.text}. ${bidder} bid ${input.bid}. Tricks: ${game.teamLabels[0]} ${preview.trickPoints[0]}, ${game.teamLabels[1]} ${preview.trickPoints[1]}, kitty ${input.kittyPoints}.${sweepNote} Hand score: ${formatScore(preview.teamScores[0])} / ${formatScore(preview.teamScores[1])}.`;
}

function renderLeaderBanner() {
  if (!game || !leaderBanner) return;
  if (!game.rounds.length) {
    leaderBanner.classList.add("hidden");
    return;
  }

  const totals = getTeamTotals(game);
  const max = Math.max(...totals);
  const leaders = game.teamLabels.filter((_, i) => totals[i] === max);
  const leader = leaders[0];
  const toWin = Math.max(0, game.targetScore - max);
  const tieNote = leaders.length > 1 ? " (tied)" : "";
  const winNote =
    max >= game.targetScore
      ? " — at or past winning score!"
      : ` — ${toWin} to reach ${game.targetScore}`;

  leaderBanner.innerHTML = `Leading: <strong>${leaders.join(", ")}</strong> — ${max} pts${tieNote}${winNote}`;
  leaderBanner.classList.remove("hidden");
}

function renderScoreboard(tableEl) {
  if (!game || !tableEl) return;
  const totals = getTeamTotals(game);
  const handCols = game.rounds.map((r) => r.hand);

  const headerCells = [
    '<th class="player-name">Team</th>',
    ...handCols.map((h) => `<th>Hand ${h}</th>`),
    '<th class="total-col">Total</th>',
  ];

  tableEl.querySelector("thead").innerHTML = `<tr>${headerCells.join("")}</tr>`;
  tableEl.querySelector("tbody").innerHTML = game.teamLabels
    .map((label, teamIndex) => {
      const cells = [`<td class="player-name">${label}</td>`];
      game.rounds.forEach((round) => {
        const pts = round.teamScores?.[teamIndex] ?? 0;
        cells.push(`<td>${formatScore(pts)}</td>`);
      });
      cells.push(`<td class="total-cell">${totals[teamIndex]}</td>`);
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("");
}

function renderGameView() {
  if (!game) return;

  const hand = game.currentHand;
  roundBadge.textContent = game.completed ? "Game complete" : `Hand ${hand} of ${game.totalHands}`;
  roundInfo.textContent = `${ROOK_DECK_SIZE}-card deck · ${RULES_NAME} · play to ${game.targetScore}`;

  handForm?.classList.toggle("hidden", game.completed);
  undoHandBtn?.classList.toggle("hidden", game.rounds.length === 0);

  if (!game.completed) {
    renderHandForm();
  }

  renderScoreboard(scoreboard);
  renderLeaderBanner();
}

function renderGameOver() {
  if (!game) return;
  const totals = getTeamTotals(game);
  const max = Math.max(...totals);
  const winners = game.teamLabels.filter((_, i) => totals[i] === max);

  winnerText.textContent =
    totals.every((t) => t === max)
      ? "It's a tie!"
      : `Winner${winners.length > 1 ? "s" : ""}: ${winners.join(" & ")} — ${max} points`;

  finalStandings.innerHTML = [...game.teamLabels]
    .map((label, i) => ({ label, total: totals[i] }))
    .sort((a, b) => b.total - a.total)
    .map((row, index) => {
      const medal = index === 0 ? "🥇 " : index === 1 ? "🥈 " : "";
      return `<li>${medal}${row.label}: <strong>${row.total}</strong> points</li>`;
    })
    .join("");

  renderScoreboard(gameOverScoreboard);
  if (tryRecordGameHistory(game)) saveGame();
  showView("over");
}

function checkGameComplete() {
  if (!game) return false;
  if (game.currentHand > game.totalHands) {
    game.completed = true;
    return true;
  }
  if (hasReachedTarget(game)) {
    game.completed = true;
    return true;
  }
  return false;
}

function scoreCurrentHand() {
  if (!game || game.completed) return;

  const input = readHandFormInput();
  if (!handScoringIsReady(input.trickPoints, input.kittyPoints, input.biddingTeam, input.kittyTeam)) {
    if (!countersTotalIsValid(input.trickPoints, input.kittyPoints)) {
      const status = describeCountersTotal(input.trickPoints, input.kittyPoints);
      alert(
        `Team trick points plus kitty must total exactly ${COUNTERS_PER_HAND} before scoring.\n\n${status.text}`
      );
      return;
    }
    if (input.kittyPoints > 0 && input.kittyTeam !== 0 && input.kittyTeam !== 1) {
      alert("Select which team won the last trick to receive the kitty points.");
      return;
    }
    return;
  }

  const result = calculateHandScore(input);
  game.rounds.push({
    hand: game.currentHand,
    bid: input.bid,
    biddingTeam: input.biddingTeam,
    trickPoints: result.trickPoints,
    kittyTeam: result.kittyTeam,
    kittyPoints: result.kittyPoints,
    teamCardPoints: result.teamCardPoints,
    teamScores: result.teamScores,
    madeBid: result.madeBid,
    sweepTeam: result.sweepTeam,
  });

  game.currentHand += 1;
  saveGame();

  if (checkGameComplete()) {
    saveGame();
    renderGameOver();
    return;
  }

  renderGameView();
}

function undoLastHand() {
  if (!game || !game.rounds.length) return;
  game.rounds.pop();
  game.currentHand = Math.max(1, game.currentHand - 1);
  game.completed = false;
  saveGame();
  renderGameView();
}

function startGame(playerRefs, options) {
  game = createEmptyGame(playerRefs, options);
  saveGame();
  showView("game");
  renderGameView();
}

function loadSavedGame() {
  const saved = loadGame();
  if (!saved) return false;
  game = normalizeSavedGame(saved);
  if (game.completed) {
    renderGameOver();
  } else {
    showView("game");
    renderGameView();
  }
  return true;
}

function openGameSettings() {
  if (!game) return;
  settingsTotalHandsInput.value = String(game.totalHands);
  if (settingsTargetScoreInput) settingsTargetScoreInput.value = String(game.targetScore);
  settingsPlayerPicker.setRosterFromPlayers(rosterRefsFromGamePlayers(game.players));
  settingsDialog.classList.remove("hidden");
}

function closeGameSettings() {
  settingsDialog.classList.add("hidden");
}

function saveGameSettings() {
  const playerRefs = settingsPlayerPicker.getPlayersForGame();
  const names = settingsPlayerPicker.getPlayerNames();
  const totalHands = Math.max(1, Math.min(30, Number(settingsTotalHandsInput.value)));
  const targetScore = Math.max(
    100,
    Math.min(1000, Number(settingsTargetScoreInput?.value ?? game.targetScore))
  );

  if (names.length !== MAX_PLAYERS) {
    alert(`${GAME_DISPLAY_NAME} requires exactly ${MAX_PLAYERS} players.`);
    return;
  }
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) {
    alert("Each player needs a unique name.");
    return;
  }

  game.players = mapRookPlayers(playerRefs);
  game.teams = [
    [0, 1],
    [2, 3],
  ];
  game.teamLabels = buildTeamLabels(names, game.teams);
  game.totalHands = totalHands;
  game.targetScore = targetScore;
  game.rounds = game.rounds.filter((r) => r.hand <= totalHands);
  if (game.currentHand > totalHands) game.currentHand = totalHands;
  game.completed = game.rounds.length >= totalHands || hasReachedTarget(game);

  saveGame();
  closeGameSettings();
  if (game.completed) renderGameOver();
  else renderGameView();
}

function bindEvents({ showExitGameConfirm }) {
  document.getElementById("rook-start-game-btn")?.addEventListener("click", () => {
    const playerRefs = setupPlayerPicker.getPlayersForGame();
    const names = setupPlayerPicker.getPlayerNames();
    const totalHands = Math.max(1, Math.min(30, Number(totalHandsInput?.value ?? DEFAULT_TOTAL_HANDS)));
    const targetScore = Math.max(100, Math.min(1000, Number(targetScoreInput?.value ?? DEFAULT_TARGET_SCORE)));

    if (names.length !== MAX_PLAYERS) {
      alert(`${GAME_DISPLAY_NAME} uses exactly ${MAX_PLAYERS} players in two partnerships.`);
      return;
    }
    if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) {
      alert("Each player needs a unique name.");
      return;
    }

    startGame(playerRefs, { totalHands, targetScore });
  });

  handForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    scoreCurrentHand();
  });

  bidDecreaseBtn?.addEventListener("click", () => {
    setBidValue(Number(bidInput?.value ?? DEFAULT_BID) - BID_INCREMENT);
    updateHandPreview();
  });
  bidIncreaseBtn?.addEventListener("click", () => {
    setBidValue(Number(bidInput?.value ?? DEFAULT_BID) + BID_INCREMENT);
    updateHandPreview();
  });
  kittyPointsInput?.addEventListener("input", () => {
    if (Number(kittyPointsInput.value) <= 0) clearExclusiveTeamButton(".rook-kitty-btn");
    updateHandPreview();
  });

  undoHandBtn?.addEventListener("click", undoLastHand);

  document.getElementById("rook-game-settings-btn")?.addEventListener("click", openGameSettings);
  document.getElementById("rook-game-over-settings-btn")?.addEventListener("click", openGameSettings);
  document.getElementById("rook-settings-save")?.addEventListener("click", saveGameSettings);
  document.getElementById("rook-settings-cancel")?.addEventListener("click", closeGameSettings);
  document.getElementById("rook-settings-close")?.addEventListener("click", closeGameSettings);
  settingsDialog?.querySelector("[data-settings-dismiss]")?.addEventListener("click", closeGameSettings);

  document.getElementById("rook-new-game-btn")?.addEventListener("click", () => {
    showExitGameConfirm(() => shellRef?.exitToHome());
  });

  document.getElementById("rook-play-again-btn")?.addEventListener("click", () => {
    showExitGameConfirm(() => {
      clearGame();
      initSetupView();
    });
  });

  document.getElementById("rook-end-game-btn")?.addEventListener("click", () => {
    if (!game) return;
    game.completed = true;
    saveGame();
    renderGameOver();
  });
}

export function createRookApp(shell) {
  shellRef = shell;
  initPlayerPickers();
  bindEvents({ showExitGameConfirm: shell.showExitGameConfirm });

  return {
    id: "rook",
    storageKey: STORAGE_KEY_BASE,
    loadSavedGame,
    initSetupView,
    clearGame,
    hasSavedGame: () => Boolean(localStorage.getItem(gameStorageKey())),
    onSetupVisible: () => {
      setupPlayerPicker?.refreshProfiles?.();
      renderSetupTeamPreview();
    },
    handleSettingsEscape: closeGameSettings,
    isSettingsOpen: () => !settingsDialog?.classList.contains("hidden"),
  };
}
