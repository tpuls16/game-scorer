import {
  calculateFlip7RoundScore,
  formatScore,
  formatRoundBreakdown,
  getTotalScore,
  hasReachedTarget,
  normalizeRoundInput,
  DEFAULT_TARGET_SCORE,
  DEFAULT_FLIP7_BONUS,
  DEFAULT_BUST_POINTS,
  bustPenaltyFromPoints,
  parseBustPenaltyInput,
  formatBustRoundLabel,
  MIN_PLAYERS,
  MAX_PLAYERS,
  NUMBER_CARD_VALUES,
  PLUS_MODIFIER_CARD_VALUES,
  FLIP7_REQUIRED_NUMBER_CARDS,
} from "./scoring.js";
import { createPlayerPicker } from "../../core/player-picker.js";
import { scopedStorageKey } from "../../core/user-storage.js";

const STORAGE_KEY_BASE = "game-scorer-flip7";

function gameStorageKey() {
  return scopedStorageKey(STORAGE_KEY_BASE);
}

/** @type {{ showView: (view: string, gameId: string) => void, showExitGameConfirm: (fn: () => void) => void, exitToHome: () => void } | null} */
let shellRef = null;

function showView(view) {
  shellRef?.showView(view, "flip7");
}

const setupPanel = document.getElementById("flip7-setup");
const gamePanel = document.getElementById("flip7-game-panel");
const gameOverPanel = document.getElementById("flip7-game-over-panel");
/** @type {ReturnType<typeof createPlayerPicker>} */
let setupPlayerPicker;
/** @type {ReturnType<typeof createPlayerPicker>} */
let settingsPlayerPicker;

function initPlayerPickers() {
  const profileBackContext = { view: "setup", gameId: "flip7" };
  setupPlayerPicker = createPlayerPicker(document.getElementById("flip7-player-picker"), {
    maxPlayers: MAX_PLAYERS,
    profileBackContext,
  });
  settingsPlayerPicker = createPlayerPicker(document.getElementById("flip7-settings-player-picker"), {
    maxPlayers: MAX_PLAYERS,
    profileBackContext,
  });
}
const targetScoreInput = document.getElementById("flip7-target-score");
const bonusPointsInput = document.getElementById("flip7-bonus-points");
const bustPointsInput = document.getElementById("flip7-bust-points");
const roundBadge = document.getElementById("flip7-round-badge");
const roundInfo = document.getElementById("flip7-round-info");
const roundPreview = document.getElementById("flip7-round-preview");
const gameOverRoundPreview = document.getElementById("flip7-game-over-round-preview");
const roundForm = document.getElementById("flip7-round-form");
const playerRoundInputsEl = document.getElementById("flip7-player-round-inputs");
const roundDetailView = document.getElementById("flip7-round-detail-view");
const roundDetailTitle = document.getElementById("flip7-round-detail-title");
const roundDetailContent = document.getElementById("flip7-round-detail-content");
const backToCurrentBtn = document.getElementById("flip7-back-to-current-btn");
const scoreboard = document.getElementById("flip7-scoreboard");
const gameOverScoreboard = document.getElementById("flip7-game-over-scoreboard");
const leaderBanner = document.getElementById("flip7-leader-banner");
const undoRoundBtn = document.getElementById("flip7-undo-round-btn");
const winnerText = document.getElementById("flip7-winner-text");
const finalStandings = document.getElementById("flip7-final-standings");
const settingsDialog = document.getElementById("flip7-settings-dialog");
const settingsTargetInput = document.getElementById("flip7-settings-target-score");
const settingsBonusInput = document.getElementById("flip7-settings-bonus-points");
const settingsBustInput = document.getElementById("flip7-settings-bust-points");

let game = null;
let viewingRound = null;
let editingRound = false;

function saveGame() {
  localStorage.setItem(gameStorageKey(), JSON.stringify(game));
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
  viewingRound = null;
  editingRound = false;
}

function createEmptyGame(playerNames, options = {}) {
  return {
    gameId: "flip7",
    players: playerNames.map((name) => ({ name, rounds: [] })),
    currentRound: 1,
    completed: false,
    targetScore: options.targetScore ?? DEFAULT_TARGET_SCORE,
    flip7Bonus: options.flip7Bonus ?? DEFAULT_FLIP7_BONUS,
    bustPoints: options.bustPoints ?? DEFAULT_BUST_POINTS,
  };
}

function normalizeSavedGame(saved) {
  saved.gameId = "flip7";
  saved.targetScore = saved.targetScore ?? DEFAULT_TARGET_SCORE;
  saved.flip7Bonus = saved.flip7Bonus ?? DEFAULT_FLIP7_BONUS;
  saved.bustPoints = clampBustPoints(saved.bustPoints ?? DEFAULT_BUST_POINTS);
  return saved;
}

function getMaxScoredRound() {
  let maxRound = 0;
  for (const player of game.players) {
    for (const roundData of player.rounds) {
      maxRound = Math.max(maxRound, roundData.round);
    }
  }
  return maxRound;
}

function getScoreboardRoundCount() {
  if (game.completed) return getMaxScoredRound();
  return Math.max(game.currentRound, getMaxScoredRound());
}

function recalculateStoredRoundScores() {
  for (const player of game.players) {
    for (const roundData of player.rounds) {
      const scored = calculateFlip7RoundScore({
        ...roundData,
        flip7BonusPoints: game.flip7Bonus,
        bustPoints: game.bustPoints,
      });
      Object.assign(roundData, scored);
    }
  }
}

function readCardPickerState(card) {
  const busted = card.classList.contains("is-busted");
  const numberCards = [...card.querySelectorAll(".flip7-num-btn.is-selected")]
    .map((btn) => Number(btn.dataset.value))
    .sort((a, b) => a - b);
  const x2 = card.querySelector(".flip7-mod-x2.is-selected") != null;
  const plusModifiers = [...card.querySelectorAll(".flip7-mod-plus.is-selected")]
    .map((btn) => Number(btn.dataset.value))
    .sort((a, b) => a - b);

  return { busted, numberCards, x2, plusModifiers };
}

function updatePlayerCardPreview(card) {
  const preview = card.querySelector(".flip7-live-score");
  const flip7Badge = card.querySelector(".flip7-flip7-badge");
  if (!preview) return;

  const scored = calculateFlip7RoundScore({
    ...readCardPickerState(card),
    flip7BonusPoints: game.flip7Bonus,
    bustPoints: game.bustPoints,
  });

  preview.textContent = `${formatScore(scored.total)} this round`;
  preview.classList.toggle("is-zero", scored.busted && scored.total === 0);
  preview.classList.toggle("negative", scored.busted && scored.total < 0);
  preview.classList.toggle("positive", !scored.busted && scored.total > 0);

  if (flip7Badge) {
    const showFlip7 = scored.flip7 && !scored.busted;
    flip7Badge.classList.toggle("hidden", !showFlip7);
    flip7Badge.textContent = `Flip 7! +${game.flip7Bonus}`;
  }
}

function setCardBusted(card, busted) {
  card.classList.toggle("is-busted", busted);
  const bustBtn = card.querySelector(".flip7-bust-btn");
  const picker = card.querySelector(".flip7-card-picker");
  if (bustBtn) bustBtn.classList.toggle("is-active", busted);
  if (picker) picker.classList.toggle("hidden", busted);
  if (busted) {
    card.querySelectorAll(".flip7-pick-btn.is-selected").forEach((btn) => {
      btn.classList.remove("is-selected");
      btn.setAttribute("aria-pressed", "false");
    });
  }
  updatePlayerCardPreview(card);
}

function createPickButton(label, className, { selected = false, onChange } = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `flip7-pick-btn ${className}`;
  btn.textContent = label;
  btn.setAttribute("aria-pressed", selected ? "true" : "false");
  if (selected) btn.classList.add("is-selected");

  btn.addEventListener("click", () => {
    const next = !btn.classList.contains("is-selected");
    btn.classList.toggle("is-selected", next);
    btn.setAttribute("aria-pressed", next ? "true" : "false");
    const card = btn.closest(".flip7-player-card");
    if (card?.classList.contains("is-busted")) {
      setCardBusted(card, false);
    }
    onChange?.();
  });

  return btn;
}

function restorePickerFromRoundData(card, roundData) {
  const normalized = normalizeRoundInput(roundData ?? {});
  setCardBusted(card, normalized.busted);

  const selectedNumbers = new Set(normalized.numberCards);
  card.querySelectorAll(".flip7-num-btn").forEach((btn) => {
    const on = selectedNumbers.has(Number(btn.dataset.value));
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });

  const x2Btn = card.querySelector(".flip7-mod-x2");
  if (x2Btn) {
    x2Btn.classList.toggle("is-selected", normalized.x2);
    x2Btn.setAttribute("aria-pressed", normalized.x2 ? "true" : "false");
  }

  const selectedPlus = new Set(normalized.plusModifiers);
  card.querySelectorAll(".flip7-mod-plus").forEach((btn) => {
    const on = selectedPlus.has(Number(btn.dataset.value));
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });

  updatePlayerCardPreview(card);
}

function renderSetupInputs() {
  setupPlayerPicker.setPlayerNames([]);
}

function initSetupView() {
  viewingRound = null;
  editingRound = false;
  roundDetailView.classList.add("hidden");
  targetScoreInput.value = DEFAULT_TARGET_SCORE;
  bonusPointsInput.value = DEFAULT_FLIP7_BONUS;
  bustPointsInput.value = bustPenaltyFromPoints(DEFAULT_BUST_POINTS);
  setupPlayerPicker?.refreshProfiles?.();
  renderSetupInputs();
  showView("setup");
}

function getPlayerTotals() {
  return game.players.map((player) => ({
    name: player.name,
    total: getTotalScore(player.rounds),
  }));
}

function getLeaders() {
  const totals = getPlayerTotals();
  const max = Math.max(...totals.map((p) => p.total));
  return totals.filter((p) => p.total === max);
}

function isRoundScored(roundNum) {
  return game.players.some((player) => player.rounds.some((r) => r.round === roundNum));
}

function renderLeaderBanner() {
  if (game.players.every((p) => p.rounds.length === 0)) {
    leaderBanner.classList.add("hidden");
    return;
  }

  const leaders = getLeaders();
  const leader = leaders[0];
  const toWin = Math.max(0, game.targetScore - leader.total);
  const tieNote = leaders.length > 1 ? " (tied)" : "";
  const winNote =
    leader.total >= game.targetScore
      ? " — at or past winning score!"
      : ` — ${toWin} to reach ${game.targetScore}`;

  leaderBanner.innerHTML = `Leading: <strong>${leaders.map((l) => l.name).join(", ")}</strong> — ${leader.total} pts${tieNote}${winNote}`;
  leaderBanner.classList.remove("hidden");
}

function openRoundDetail(roundNum, { edit = false } = {}) {
  if (!isRoundScored(roundNum)) return;
  viewingRound = roundNum;
  editingRound = edit;
  renderRoundDetail();
  updateRoundPanels();
}

function closeRoundDetail() {
  viewingRound = null;
  editingRound = false;
  updateRoundPanels();
}

function updateRoundPanels() {
  const isViewing = viewingRound !== null;
  roundDetailView.classList.toggle("hidden", !isViewing);
  roundForm.classList.toggle("hidden", isViewing && !game.completed);

  if (!game.completed) {
    backToCurrentBtn.classList.toggle("hidden", !isViewing);
    backToCurrentBtn.textContent = `Back to Round ${game.currentRound}`;
  } else {
    backToCurrentBtn.classList.add("hidden");
  }

  renderRoundPreview(roundPreview);
  if (gameOverRoundPreview) renderRoundPreview(gameOverRoundPreview);
}

function buildPlayerRoundFields(playerIndex, roundData = null) {
  const card = document.createElement("div");
  card.className = "player-score-card flip7-player-card";
  card.dataset.playerIndex = String(playerIndex);

  const header = document.createElement("div");
  header.className = "flip7-player-card-header";

  const title = document.createElement("h3");
  title.textContent = game.players[playerIndex].name;

  const preview = document.createElement("p");
  preview.className = "flip7-live-score";
  preview.textContent = "0 pts";

  const bustBtn = document.createElement("button");
  bustBtn.type = "button";
  bustBtn.className = "btn flip7-bust-btn";
  bustBtn.textContent = formatBustRoundLabel(game.bustPoints);

  header.append(title, preview, bustBtn);

  const flip7Badge = document.createElement("p");
  flip7Badge.className = "flip7-flip7-badge hidden";
  flip7Badge.textContent = `Flip 7! +${game.flip7Bonus}`;

  const picker = document.createElement("div");
  picker.className = "flip7-card-picker";

  const onPickerChange = () => updatePlayerCardPreview(card);

  const numberSection = document.createElement("div");
  numberSection.className = "flip7-picker-section";
  const numberLabel = document.createElement("p");
  numberLabel.className = "flip7-picker-label";
  numberLabel.textContent = "Number cards (tap each card in your row)";
  const numberGrid = document.createElement("div");
  numberGrid.className = "flip7-pick-grid flip7-number-grid";
  NUMBER_CARD_VALUES.forEach((value) => {
    const btn = createPickButton(String(value), "flip7-num-btn", { onChange: onPickerChange });
    btn.dataset.value = String(value);
    numberGrid.append(btn);
  });
  numberSection.append(numberLabel, numberGrid);

  const modSection = document.createElement("div");
  modSection.className = "flip7-picker-section";
  const modLabel = document.createElement("p");
  modLabel.className = "flip7-picker-label";
  modLabel.textContent = "Score modifiers";
  const modGrid = document.createElement("div");
  modGrid.className = "flip7-pick-grid flip7-modifier-grid";

  const x2Btn = createPickButton("×2", "flip7-mod-x2", { onChange: onPickerChange });
  modGrid.append(x2Btn);
  PLUS_MODIFIER_CARD_VALUES.forEach((value) => {
    const btn = createPickButton(`+${value}`, "flip7-mod-plus", { onChange: onPickerChange });
    btn.dataset.value = String(value);
    modGrid.append(btn);
  });

  const modHint = document.createElement("p");
  modHint.className = "hint flip7-picker-hint";
  modHint.textContent = `Select ${FLIP7_REQUIRED_NUMBER_CARDS} number cards for the Flip 7 bonus. Modifiers do not count toward it.`;

  modSection.append(modLabel, modGrid, modHint);
  picker.append(numberSection, modSection);

  bustBtn.addEventListener("click", () => {
    const next = !card.classList.contains("is-busted");
    setCardBusted(card, next);
  });

  card.append(header, flip7Badge, picker);
  restorePickerFromRoundData(card, roundData);
  return card;
}

function readPlayerRoundFromCard(card, roundNum) {
  const scored = calculateFlip7RoundScore({
    ...readCardPickerState(card),
    flip7BonusPoints: game.flip7Bonus,
    bustPoints: game.bustPoints,
  });

  return {
    round: roundNum,
    ...scored,
  };
}

function renderRoundDetail() {
  if (viewingRound === null) return;
  const roundNum = viewingRound;
  roundDetailTitle.textContent = `Round ${roundNum}${editingRound ? " — Edit scores" : ""}`;

  if (editingRound) {
    roundDetailContent.innerHTML = "";
    const form = document.createElement("form");
    form.className = "flip7-edit-round-form";
    form.id = "flip7-edit-round-form";

    game.players.forEach((player, index) => {
      const roundData = player.rounds.find((r) => r.round === roundNum);
      form.append(buildPlayerRoundFields(index, roundData));
    });

    const actions = document.createElement("div");
    actions.className = "btn-row";
    actions.innerHTML = `
      <button type="submit" class="btn btn-primary">Save round</button>
      <button type="button" class="btn btn-secondary" id="flip7-cancel-edit-round">Cancel</button>
    `;
    form.append(actions);
    roundDetailContent.append(form);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      saveEditedRound(roundNum);
    });
    document.getElementById("flip7-cancel-edit-round").addEventListener("click", () => {
      editingRound = false;
      renderRoundDetail();
    });
    return;
  }

  roundDetailContent.innerHTML = `
    <p class="hint">Official order: number sum → ×2 → +modifiers → Flip 7 bonus.</p>
    <div class="btn-row round-detail-actions">
      <button type="button" class="btn btn-secondary" id="flip7-edit-round-btn">Edit this round</button>
    </div>
  `;

  const playersWrap = document.createElement("div");
  playersWrap.className = "round-detail-players";

  game.players.forEach((player) => {
    const roundData = player.rounds.find((r) => r.round === roundNum);
    const block = document.createElement("div");
    block.className = "round-detail-player";

    if (!roundData) {
      block.innerHTML = `<h3>${player.name}</h3><p class="hint">No data recorded.</p>`;
    } else {
      const totalClass =
        roundData.total > 0 ? "positive" : roundData.total < 0 ? "negative" : "";
      const lines = formatRoundBreakdown(roundData, {
        flip7BonusPoints: game.flip7Bonus,
        bustPoints: game.bustPoints,
      });
      block.innerHTML = `
        <h3>${player.name}</h3>
        <ul class="round-detail-breakdown">
          ${lines.map((line) => `<li>${line}</li>`).join("")}
        </ul>
        <p class="round-detail-total ${totalClass}">Round total: ${formatScore(roundData.total)}</p>
      `;
    }
    playersWrap.append(block);
  });

  roundDetailContent.append(playersWrap);
  document.getElementById("flip7-edit-round-btn").addEventListener("click", () => {
    editingRound = true;
    renderRoundDetail();
  });
}

function saveEditedRound(roundNum) {
  const form = document.getElementById("flip7-edit-round-form");
  const cards = [...form.querySelectorAll(".flip7-player-card")];

  cards.forEach((card) => {
    const playerIndex = Number(card.dataset.playerIndex);
    const result = readPlayerRoundFromCard(card, roundNum);
    const player = game.players[playerIndex];
    const idx = player.rounds.findIndex((r) => r.round === roundNum);
    if (idx >= 0) {
      player.rounds[idx] = result;
    } else {
      player.rounds.push(result);
    }
  });

  recalculateStoredRoundScores();
  checkGameCompleteAfterEdit();
  editingRound = false;
  viewingRound = null;
  saveGame();
  if (game.completed) {
    renderGameOver();
  } else {
    renderGameView();
  }
}

function checkGameCompleteAfterEdit() {
  const maxRound = getMaxScoredRound();
  const anyWinner = getPlayerTotals().some((p) => hasReachedTarget(p.total, game.targetScore));
  if (anyWinner && maxRound >= 1) {
    game.completed = true;
    game.currentRound = maxRound;
  } else {
    game.completed = false;
    game.currentRound = Math.max(maxRound + 1, 1);
  }
}

function renderRoundPreview(container) {
  if (!container) return;
  container.innerHTML = "";

  const total = getScoreboardRoundCount();
  for (let r = 1; r <= total; r++) {
    const scored = isRoundScored(r);
    const isCurrent = r === game.currentRound && !game.completed;
    const isViewing = viewingRound === r;

    if (scored) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `R${r}`;
      button.className = "done";
      if (isCurrent) button.classList.add("current");
      if (isViewing) button.classList.add("viewing");
      button.title = `View Round ${r}`;
      button.addEventListener("click", () => openRoundDetail(r));
      container.append(button);
      continue;
    }

    const span = document.createElement("span");
    span.textContent = `R${r}`;
    if (isCurrent) span.classList.add("current");
    container.append(span);
  }
}

function renderRoundForm() {
  const round = game.currentRound;
  roundBadge.textContent = `Round ${round}`;
  const bustPenalty = bustPenaltyFromPoints(game.bustPoints);
  const bustNote = bustPenalty === 0 ? "Bust: 0" : `Bust: −${bustPenalty}`;
  roundInfo.textContent = `First to ${game.targetScore} pts · Flip 7: +${game.flip7Bonus} · ${bustNote}`;

  playerRoundInputsEl.innerHTML = "";
  game.players.forEach((player, index) => {
    playerRoundInputsEl.append(buildPlayerRoundFields(index));
  });

  undoRoundBtn.classList.toggle("hidden", game.currentRound <= 1);
}

function readRoundFormData() {
  const round = game.currentRound;
  return [...playerRoundInputsEl.querySelectorAll(".flip7-player-card")].map((card) =>
    readPlayerRoundFromCard(card, round)
  );
}

function renderScoreboard(tableEl = scoreboard) {
  if (!tableEl) return;
  const thead = tableEl.querySelector("thead");
  const tbody = tableEl.querySelector("tbody");
  const roundCount = getScoreboardRoundCount();

  const headerCells = ['<th class="player-name">Player</th>'];
  for (let r = 1; r <= roundCount; r++) {
    const scored = isRoundScored(r);
    const linkClass = scored ? ' class="round-link"' : "";
    const dataRound = scored ? ` data-round="${r}"` : "";
    headerCells.push(`<th${linkClass}${dataRound}>R${r}</th>`);
  }
  headerCells.push("<th>Total</th>");
  thead.innerHTML = `<tr>${headerCells.join("")}</tr>`;

  tbody.innerHTML = game.players
    .map((player) => {
      const cells = [`<td class="player-name">${player.name}</td>`];
      for (let r = 1; r <= roundCount; r++) {
        const roundData = player.rounds.find((rd) => rd.round === r);
        if (!roundData) {
          cells.push("<td>—</td>");
        } else {
          const cls =
            roundData.total > 0 ? "positive" : roundData.total < 0 ? "negative" : "";
          const tag = roundData.busted ? " (bust)" : roundData.flip7 ? " ★" : "";
          cells.push(
            `<td class="${cls} round-link" data-round="${r}" title="View Round ${r}">${formatScore(roundData.total)}${tag}</td>`
          );
        }
      }
      cells.push(`<td class="total-cell">${getTotalScore(player.rounds)}</td>`);
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("");
}

function handleScoreboardClick(event) {
  const cell = event.target.closest("[data-round]");
  if (!cell) return;
  openRoundDetail(Number(cell.dataset.round));
}

function renderGameView() {
  renderRoundPreview(roundPreview);
  renderRoundForm();
  renderScoreboard(scoreboard);
  renderLeaderBanner();
  updateRoundPanels();
}

function renderGameOver() {
  const standings = getPlayerTotals().sort((a, b) => b.total - a.total);
  const topScore = standings[0].total;
  const winners = standings.filter((p) => p.total === topScore);

  if (winners.length === 1) {
    winnerText.textContent = `${winners[0].name} wins with ${winners[0].total} points!`;
  } else {
    winnerText.textContent = `${winners.map((w) => w.name).join(" & ")} tie for the win at ${topScore} points!`;
  }

  finalStandings.innerHTML = standings
    .map((p, i) => `<li>${i + 1}. ${p.name} — ${p.total} pts</li>`)
    .join("");

  renderRoundPreview(gameOverRoundPreview);
  renderScoreboard(gameOverScoreboard);
  updateRoundPanels();
  showView("over");
}

function startGame(playerNames, options) {
  viewingRound = null;
  editingRound = false;
  game = createEmptyGame(playerNames, options);
  saveGame();
  showView("game");
  renderGameView();
}

function scoreCurrentRound() {
  const results = readRoundFormData();
  game.players.forEach((player, index) => {
    player.rounds.push(results[index]);
  });

  const totals = getPlayerTotals();
  const winnerReached = totals.some((p) => hasReachedTarget(p.total, game.targetScore));

  if (winnerReached) {
    game.completed = true;
    saveGame();
    renderGameOver();
    return;
  }

  game.currentRound += 1;
  viewingRound = null;
  saveGame();
  renderGameView();
}

function undoLastRound() {
  if (game.currentRound <= 1) return;
  game.currentRound -= 1;
  game.completed = false;
  viewingRound = null;
  game.players.forEach((player) => {
    player.rounds = player.rounds.filter((r) => r.round !== game.currentRound);
  });
  saveGame();
  showView("game");
  renderGameView();
}

function openGameSettings() {
  if (!game) return;
  settingsTargetInput.value = game.targetScore;
  settingsBonusInput.value = game.flip7Bonus;
  settingsBustInput.value = bustPenaltyFromPoints(game.bustPoints);
  settingsPlayerPicker.setPlayerNames(game.players.map((player) => player.name));
  settingsDialog.classList.remove("hidden");
  document.getElementById("flip7-settings-save").focus();
}

function closeGameSettings() {
  settingsDialog.classList.add("hidden");
}

function saveGameSettings() {
  const playerNames = settingsPlayerPicker.getPlayerNames();
  const targetScore = Math.max(50, Math.min(500, Number(settingsTargetInput.value)));
  const flip7Bonus = Math.max(0, Math.min(50, Number(settingsBonusInput.value)));
  const bustPoints = parseBustPenaltyInput(settingsBustInput.value);

  if (playerNames.length < MIN_PLAYERS) {
    alert(`Flip 7 needs at least ${MIN_PLAYERS} players (official rules).`);
    return;
  }
  if (playerNames.length > MAX_PLAYERS) {
    alert(`Maximum ${MAX_PLAYERS} players.`);
    return;
  }

  const removedPlayers = game.players.slice(playerNames.length).filter((p) => p.rounds.length > 0);
  if (removedPlayers.length > 0) {
    const names = removedPlayers.map((p) => p.name).join(", ");
    if (!confirm(`Removing ${names} will delete their scores. Continue?`)) return;
  }

  game.players = playerNames.map((name, index) => ({
    name,
    rounds: game.players[index]?.rounds ?? [],
  }));
  game.targetScore = targetScore;
  game.flip7Bonus = flip7Bonus;
  game.bustPoints = bustPoints;
  recalculateStoredRoundScores();
  checkGameCompleteAfterEdit();
  saveGame();
  closeGameSettings();

  if (game.completed) {
    renderGameOver();
  } else {
    showView("game");
    renderGameView();
  }
}

function loadSavedGame() {
  game = loadGame();
  if (!game) return false;
  game = normalizeSavedGame(game);
  if (game.completed) {
    renderGameOver();
  } else {
    showView("game");
    renderGameView();
  }
  return true;
}

function bindEvents({ showExitGameConfirm }) {
  document.getElementById("flip7-start-game-btn").addEventListener("click", () => {
    const names = setupPlayerPicker.getPlayerNames();
    const targetScore = Math.max(50, Math.min(500, Number(targetScoreInput.value)));
    const flip7Bonus = Math.max(0, Math.min(50, Number(bonusPointsInput.value)));
    const bustPoints = parseBustPenaltyInput(bustPointsInput.value);

    if (names.length < MIN_PLAYERS) {
      alert(`Add at least ${MIN_PLAYERS} players (official Flip 7 rules).`);
      return;
    }
    if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) {
      alert("Each player needs a unique name.");
      return;
    }
    if (names.length > MAX_PLAYERS) {
      alert(`Maximum ${MAX_PLAYERS} players.`);
      return;
    }

    startGame(names, { targetScore, flip7Bonus, bustPoints });
  });

  document.getElementById("flip7-game-settings-btn").addEventListener("click", openGameSettings);
  document.getElementById("flip7-game-over-settings-btn").addEventListener("click", openGameSettings);
  document.getElementById("flip7-settings-save").addEventListener("click", saveGameSettings);
  document.getElementById("flip7-settings-cancel").addEventListener("click", closeGameSettings);
  document.getElementById("flip7-settings-close").addEventListener("click", closeGameSettings);
  settingsDialog.querySelector("[data-settings-dismiss]").addEventListener("click", closeGameSettings);

  roundForm.addEventListener("submit", (event) => {
    event.preventDefault();
    scoreCurrentRound();
  });

  undoRoundBtn.addEventListener("click", undoLastRound);
  backToCurrentBtn.addEventListener("click", closeRoundDetail);
  scoreboard.addEventListener("click", handleScoreboardClick);
  gameOverScoreboard.addEventListener("click", handleScoreboardClick);

  document.getElementById("flip7-new-game-btn").addEventListener("click", () => {
    showExitGameConfirm(() => shellRef?.exitToHome());
  });

  document.getElementById("flip7-play-again-btn").addEventListener("click", () => {
    showExitGameConfirm(() => {
      clearGame();
      initSetupView();
    });
  });
}

export function createFlip7App(shell) {
  shellRef = shell;
  initPlayerPickers();
  bindEvents({ showExitGameConfirm: shell.showExitGameConfirm });

  return {
    id: "flip7",
    storageKey: STORAGE_KEY_BASE,
    loadSavedGame,
    initSetupView,
    clearGame,
    hasSavedGame: () => Boolean(localStorage.getItem(gameStorageKey())),
    handleSettingsEscape: closeGameSettings,
    isSettingsOpen: () => !settingsDialog.classList.contains("hidden"),
  };
}
