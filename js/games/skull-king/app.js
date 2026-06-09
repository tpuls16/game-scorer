import {
  calculateRoundScore,
  formatScore,
  formatBonusLine,
  getBonusFields,
  EXPANSION_BONUS_FIELDS,
  getTotalScore,
} from "./scoring.js";
import {
  MAX_PLAYERS,
  DEFAULT_TOTAL_ROUNDS,
  DEFAULT_STARTING_CARDS,
  DEFAULT_CARD_INCREMENT,
  getDeckSize,
  getMaxCardsPerRound,
  buildDefaultCardsPerRound,
  applyDeckCap,
} from "./deck.js";
import { createNumberField } from "../../core/ui-utils.js";
import { tryRecordGameHistory } from "../../core/game-history.js";
import {
  mapSkullKingPlayers,
  mapSkullKingPlayersFromSettings,
  promoteGuestsToSavedProfiles,
  rosterRefsFromGamePlayers,
} from "../../core/game-players.js";
import { createPlayerPicker } from "../../core/player-picker.js";
import { scopedStorageKey } from "../../core/user-storage.js";

const STORAGE_KEY_BASE = "skull-king-game";

function gameStorageKey() {
  return scopedStorageKey(STORAGE_KEY_BASE);
}

/** @type {{ showView: (view: string, gameId: string) => void, showExitGameConfirm: (fn: () => void) => void, exitToHome: () => void } | null} */
let shellRef = null;

function showView(view) {
  shellRef?.showView(view, "skull-king");
}

const gameView = document.getElementById("skull-king-game-panel");
const gameOverView = document.getElementById("skull-king-game-over-panel");
/** @type {ReturnType<typeof createPlayerPicker>} */
let setupPlayerPicker;
/** @type {ReturnType<typeof createPlayerPicker>} */
let settingsPlayerPicker;

function initPlayerPickers() {
  const profileBackContext = { view: "setup", gameId: "skull-king" };
  setupPlayerPicker = createPlayerPicker(document.getElementById("sk-player-picker"), {
    maxPlayers: MAX_PLAYERS,
    onChange: () => renderRoundSchedule({ preserveCustom: true }),
    profileBackContext,
  });
  settingsPlayerPicker = createPlayerPicker(document.getElementById("sk-settings-player-picker"), {
    maxPlayers: MAX_PLAYERS,
    onChange: () =>
      renderRoundSchedule({
        preserveCustom: true,
        scheduleEls: settingsScheduleEls,
        cardsCacheKey: "settings",
      }),
    profileBackContext,
  });
}
const playerRoundInputsEl = document.getElementById("player-round-inputs");
const roundBadge = document.getElementById("round-badge");
const roundInfo = document.getElementById("round-info");
const roundPreview = document.getElementById("round-preview");
const gameOverRoundPreview = document.getElementById("game-over-round-preview");
const roundForm = document.getElementById("round-form");
const roundDetailView = document.getElementById("round-detail-view");
const roundDetailTitle = document.getElementById("round-detail-title");
const roundDetailContent = document.getElementById("round-detail-content");
const backToCurrentBtn = document.getElementById("back-to-current-btn");
const scoreboard = document.getElementById("scoreboard");
const gameOverScoreboard = document.getElementById("game-over-scoreboard");
const leaderBanner = document.getElementById("leader-banner");
const undoRoundBtn = document.getElementById("undo-round-btn");
const winnerText = document.getElementById("winner-text");
const finalStandings = document.getElementById("final-standings");
const useExpansionCheckbox = document.getElementById("use-expansion-checkbox");
const totalRoundsInput = document.getElementById("total-rounds");
const startingCardsInput = document.getElementById("starting-cards");
const cardIncrementInput = document.getElementById("card-increment");
const deckLimitHint = document.getElementById("deck-limit-hint");
const roundScheduleEl = document.getElementById("round-schedule");
const gameSettingsDialog = document.getElementById("sk-game-settings-dialog");
const setupScheduleEls = {
  roundScheduleEl,
  totalRoundsInput,
  startingCardsInput,
  cardIncrementInput,
  deckLimitHint,
  useExpansionCheckbox,
  getPlayerCount: getSetupPlayerCount,
};

const settingsScheduleEls = {
  roundScheduleEl: document.getElementById("settings-round-schedule"),
  totalRoundsInput: document.getElementById("settings-total-rounds"),
  startingCardsInput: document.getElementById("settings-starting-cards"),
  cardIncrementInput: document.getElementById("settings-card-increment"),
  deckLimitHint: document.getElementById("settings-deck-limit-hint"),
  useExpansionCheckbox: document.getElementById("settings-use-expansion-checkbox"),
  getPlayerCount: () => settingsPlayerPicker.getPlayerCount(),
};

let game = null;
let viewingRound = null;
let setupCardsPerRound = null;
let settingsCardsPerRound = null;
let setupScheduleBuildKey = null;
let settingsScheduleBuildKey = null;
const EXPANSION_BONUS_KEYS = new Set(EXPANSION_BONUS_FIELDS.map((field) => field.key));

function getScheduleBuildKey(config, totalRounds) {
  return [
    config.numPlayers,
    config.useExpansion,
    totalRounds,
    config.startingCards,
    config.cardIncrement,
  ].join("|");
}

function getTotalRounds() {
  return game?.totalRounds ?? DEFAULT_TOTAL_ROUNDS;
}

function getCardsForRound(roundNum) {
  if (game?.cardsPerRound?.length) {
    return game.cardsPerRound[roundNum - 1] ?? roundNum;
  }
  return roundNum;
}

function getSetupPlayerCount() {
  return setupPlayerPicker.getPlayerCount();
}

function readCardsPerRoundFromSchedule(scheduleEls) {
  const inputs = [...scheduleEls.roundScheduleEl.querySelectorAll("input[data-round-index]")];
  if (!inputs.length) {
    return buildDefaultCardsPerRound(readScheduleConfig(scheduleEls));
  }
  return inputs.map((input) => Number(input.value));
}

function readScheduleConfig(scheduleEls) {
  return {
    totalRounds: Number(scheduleEls.totalRoundsInput.value),
    startingCards: Number(scheduleEls.startingCardsInput.value),
    cardIncrement: Number(scheduleEls.cardIncrementInput.value),
    numPlayers: scheduleEls.getPlayerCount(),
    useExpansion: scheduleEls.useExpansionCheckbox.checked,
  };
}

function renderRoundSchedule({ preserveCustom = true, scheduleEls = setupScheduleEls, cardsCacheKey = "setup" } = {}) {
  const config = readScheduleConfig(scheduleEls);
  const totalRounds = Math.max(1, Math.min(20, config.totalRounds || DEFAULT_TOTAL_ROUNDS));
  const playerCount = config.numPlayers;
  const schedulePlayerCount = Math.max(playerCount, 2);
  const maxCards = getMaxCardsPerRound(schedulePlayerCount, config.useExpansion);
  const buildKey = getScheduleBuildKey(config, totalRounds);
  const cachedCards =
    cardsCacheKey === "settings" ? settingsCardsPerRound : setupCardsPerRound;
  const cachedBuildKey =
    cardsCacheKey === "settings" ? settingsScheduleBuildKey : setupScheduleBuildKey;

  scheduleEls.totalRoundsInput.value = totalRounds;

  let cardsPerRound = buildDefaultCardsPerRound({
    ...config,
    totalRounds,
    numPlayers: schedulePlayerCount,
  });

  if (
    preserveCustom &&
    cachedCards &&
    cachedCards.length === totalRounds &&
    cachedBuildKey === buildKey
  ) {
    cardsPerRound = applyDeckCap(cachedCards, schedulePlayerCount, config.useExpansion);
  }

  if (playerCount >= 2) {
    if (cardsCacheKey === "settings") {
      settingsCardsPerRound = cardsPerRound;
      settingsScheduleBuildKey = buildKey;
    } else {
      setupCardsPerRound = cardsPerRound;
      setupScheduleBuildKey = buildKey;
    }
  }

  scheduleEls.roundScheduleEl.innerHTML = cardsPerRound
    .map((cards, index) => {
      const desired = config.startingCards + index * config.cardIncrement;
      const capped = desired > maxCards;
      return `
        <label class="round-schedule-item${capped ? " capped" : ""}">
          <span class="round-schedule-round">Round ${index + 1}</span>
          <input
            type="number"
            min="1"
            max="${Math.max(maxCards, 1)}"
            value="${cards}"
            data-round-index="${index}"
            aria-label="Cards dealt in round ${index + 1}"
          />
          <span class="round-schedule-unit">cards each</span>
        </label>
      `;
    })
    .join("");

  const deckLabel = config.useExpansion ? "expanded" : "base";
  let hint = `${getDeckSize(config.useExpansion)}-card ${deckLabel} deck · up to ${maxCards} cards per player per round`;

  if (playerCount < 2) {
    hint = `Add at least 2 players to lock in the deal schedule. Preview below assumes ${schedulePlayerCount} players. ${hint}`;
  } else {
    hint = `${playerCount} players · ${hint}`;
  }

  const anyCapped = cardsPerRound.some((cards, index) => {
    const desired = config.startingCards + index * config.cardIncrement;
    return desired > maxCards;
  });

  if (anyCapped) {
    hint += " · * rounds capped to fit the deck";
  }

  scheduleEls.deckLimitHint.textContent = hint;
}

function readSetupRoundConfig() {
  return readScheduleConfig(setupScheduleEls);
}

function readSetupCardsPerRound() {
  return readCardsPerRoundFromSchedule(setupScheduleEls);
}

function createEmptyGame(playerRefs, options = {}) {
  const {
    useExpansion = false,
    totalRounds = DEFAULT_TOTAL_ROUNDS,
    cardsPerRound = buildDefaultCardsPerRound({
      totalRounds,
      numPlayers: playerRefs.length,
      useExpansion,
    }),
  } = options;

  return {
    gameId: "skull-king",
    players: mapSkullKingPlayers(playerRefs),
    currentRound: 1,
    completed: false,
    useExpansion,
    totalRounds,
    cardsPerRound,
  };
}

function normalizeSavedGame(savedGame) {
  const playerCount = savedGame.players.length;
  const useExpansion = savedGame.useExpansion ?? false;
  const totalRounds = savedGame.totalRounds ?? DEFAULT_TOTAL_ROUNDS;

  savedGame.useExpansion = useExpansion;
  savedGame.totalRounds = totalRounds;
  savedGame.cardsPerRound =
    savedGame.cardsPerRound ??
    buildDefaultCardsPerRound({
      totalRounds,
      numPlayers: playerCount,
      useExpansion,
    });

  savedGame.cardsPerRound = applyDeckCap(
    savedGame.cardsPerRound.slice(0, totalRounds),
    playerCount,
    useExpansion
  );

  while (savedGame.cardsPerRound.length < totalRounds) {
    const nextIndex = savedGame.cardsPerRound.length;
    savedGame.cardsPerRound.push(
      clampSavedRoundCards(nextIndex + 1, savedGame, playerCount, useExpansion)
    );
  }

  return savedGame;
}

function clampSavedRoundCards(roundNum, savedGame, playerCount, useExpansion) {
  const maxCards = getMaxCardsPerRound(playerCount, useExpansion);
  return Math.min(roundNum, maxCards);
}

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

function getGameSnapshot() {
  if (game) return game;
  const saved = loadGame();
  return saved ? normalizeSavedGame(saved) : null;
}

function archiveToHistory({ endedEarly = true } = {}) {
  const snapshot = getGameSnapshot();
  if (!snapshot) return false;
  return tryRecordGameHistory(snapshot, { endedEarly });
}

function clearGame() {
  localStorage.removeItem(gameStorageKey());
  game = null;
}

function exitToSetup() {
  clearGame();
  initSetupView();
}

function renderSetupInputs() {
  setupPlayerPicker.setPlayerNames([]);
}

function getSetupPlayerNames() {
  return setupPlayerPicker.getPlayerNames();
}

function getSetupPlayerRefs() {
  return setupPlayerPicker.getPlayersForGame();
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

function recalculateStoredRoundScores() {
  for (const player of game.players) {
    for (const roundData of player.rounds) {
      const cardsDealt = getCardsForRound(roundData.round);
      const result = calculateRoundScore(roundData.round, roundData.bid, roundData.tricks, roundData.bonuses ?? {}, {
        useExpansion: game.useExpansion,
        cardsDealt,
      });
      Object.assign(roundData, result, { cardsDealt });
    }
  }
}

function trimRoundDataBeyond(totalRounds) {
  for (const player of game.players) {
    player.rounds = player.rounds.filter((roundData) => roundData.round <= totalRounds);
  }
}

function inferSchedulePattern(cardsPerRound) {
  if (!cardsPerRound.length) {
    return { startingCards: DEFAULT_STARTING_CARDS, cardIncrement: DEFAULT_CARD_INCREMENT };
  }

  const startingCards = cardsPerRound[0];
  const cardIncrement =
    cardsPerRound.length > 1 ? cardsPerRound[1] - cardsPerRound[0] : DEFAULT_CARD_INCREMENT;

  return { startingCards, cardIncrement };
}

function renderSettingsPlayerInputs() {
  settingsPlayerPicker.setRosterFromPlayers(rosterRefsFromGamePlayers(game.players));
}

function populateGameSettingsForm() {
  settingsScheduleEls.useExpansionCheckbox.checked = game.useExpansion;
  settingsScheduleEls.totalRoundsInput.value = game.totalRounds;
  settingsCardsPerRound = [...game.cardsPerRound];

  const { startingCards, cardIncrement } = inferSchedulePattern(game.cardsPerRound);
  settingsScheduleEls.startingCardsInput.value = startingCards;
  settingsScheduleEls.cardIncrementInput.value = cardIncrement;

  renderSettingsPlayerInputs();
  const settingsConfig = readScheduleConfig(settingsScheduleEls);
  const settingsTotalRounds = Math.max(
    1,
    Math.min(20, Number(settingsScheduleEls.totalRoundsInput.value) || DEFAULT_TOTAL_ROUNDS)
  );
  settingsScheduleBuildKey = getScheduleBuildKey(settingsConfig, settingsTotalRounds);
  renderRoundSchedule({
    preserveCustom: true,
    scheduleEls: settingsScheduleEls,
    cardsCacheKey: "settings",
  });
}

function openGameSettings() {
  if (!game) return;
  populateGameSettingsForm();
  gameSettingsDialog.classList.remove("hidden");
  document.getElementById("sk-game-settings-save").focus();
}

function closeGameSettings() {
  gameSettingsDialog.classList.add("hidden");
}

function getSettingsPlayerNames() {
  return settingsPlayerPicker.getPlayerNames();
}

function getSettingsPlayerRefs() {
  return settingsPlayerPicker.getPlayersForGame();
}

function validateGameSettings(playerNames, useExpansion, totalRounds, cardsPerRound) {
  if (playerNames.length < 2) {
    alert("Add at least 2 players.");
    return false;
  }
  if (playerNames.length > MAX_PLAYERS) {
    alert(`Maximum ${MAX_PLAYERS} players.`);
    return false;
  }
  if (cardsPerRound.length !== totalRounds) {
    alert("Round schedule does not match the number of rounds.");
    return false;
  }
  if (cardsPerRound.some((cards) => cards < 1)) {
    alert("Each round must deal at least 1 card per player.");
    return false;
  }

  const maxCards = getMaxCardsPerRound(playerNames.length, useExpansion);
  if (cardsPerRound.some((cards) => cards > maxCards)) {
    alert(`This group can deal at most ${maxCards} cards per player per round with the selected deck.`);
    return false;
  }

  const maxScoredRound = getMaxScoredRound();
  if (totalRounds < maxScoredRound) {
    alert(`At least ${maxScoredRound} rounds have already been scored.`);
    return false;
  }

  return true;
}

function applyGameSettings(playerRefs, useExpansion, totalRounds, cardsPerRound) {
  const removedPlayers = game.players.slice(playerRefs.length).filter((player) => player.rounds.length > 0);
  if (removedPlayers.length > 0) {
    const names = removedPlayers.map((player) => player.name).join(", ");
    if (!confirm(`Removing ${names} will delete their scores. Continue?`)) {
      return false;
    }
  }

  game.players = mapSkullKingPlayersFromSettings(playerRefs, game.players);

  game.useExpansion = useExpansion;
  game.totalRounds = totalRounds;
  game.cardsPerRound = cardsPerRound;

  const maxScoredRound = getMaxScoredRound();
  trimRoundDataBeyond(totalRounds);
  recalculateStoredRoundScores();

  if (totalRounds === maxScoredRound && maxScoredRound > 0) {
    game.completed = true;
    game.currentRound = totalRounds;
  } else if (totalRounds > maxScoredRound) {
    game.completed = false;
    const nextRound = maxScoredRound + 1;
    if (game.currentRound < nextRound || game.currentRound > totalRounds) {
      game.currentRound = Math.min(nextRound, totalRounds);
    }
  } else {
    game.completed = false;
    game.currentRound = Math.min(Math.max(game.currentRound, 1), totalRounds);
    if (game.currentRound <= maxScoredRound) {
      game.currentRound = Math.min(maxScoredRound + 1, totalRounds);
    }
  }

  viewingRound = null;
  saveGame();
  closeGameSettings();

  if (game.completed) {
    renderGameOver();
  } else {
    showView("game");
    renderGameView();
  }

  return true;
}

function saveGameSettings() {
  const playerRefs = promoteGuestsToSavedProfiles(getSettingsPlayerRefs());
  const playerNames = getSettingsPlayerNames();
  const useExpansion = settingsScheduleEls.useExpansionCheckbox.checked;
  const totalRounds = Math.max(1, Math.min(20, Number(settingsScheduleEls.totalRoundsInput.value)));
  const cardsPerRound = applyDeckCap(
    readCardsPerRoundFromSchedule(settingsScheduleEls),
    playerNames.length,
    useExpansion
  );

  if (!validateGameSettings(playerNames, useExpansion, totalRounds, cardsPerRound)) {
    return;
  }

  applyGameSettings(playerRefs, useExpansion, totalRounds, cardsPerRound);
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

function renderLeaderBanner() {
  const leaders = getLeaders();
  if (game.currentRound === 1 && game.players.every((p) => p.rounds.length === 0)) {
    leaderBanner.classList.add("hidden");
    return;
  }

  const leaderNames = leaders.map((l) => l.name).join(", ");
  const scoreText = leaders.length === 1 ? `${leaders[0].total} pts` : `${leaders[0].total} pts (tied)`;
  leaderBanner.innerHTML = `Leading: <strong>${leaderNames}</strong> — ${scoreText}`;
  leaderBanner.classList.remove("hidden");
}

function isRoundScored(roundNum) {
  return game.players.some((player) => player.rounds.some((round) => round.round === roundNum));
}

function openRoundDetail(roundNum) {
  if (!isRoundScored(roundNum)) return;
  viewingRound = roundNum;
  renderRoundDetail();
  updateRoundPanels();
}

function closeRoundDetail() {
  viewingRound = null;
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
  if (gameOverRoundPreview) {
    renderRoundPreview(gameOverRoundPreview);
  }
}

function getBonusSummaryLines(bonuses = {}, madeBid, useExpansion = false) {
  if (!madeBid) {
    return ["Bonuses not applied — bid was not exact."];
  }

  const lines = getBonusFields(useExpansion).flatMap((field) => {
    const count = bonuses[field.key] ?? 0;
    if (!count) return [];
    return [formatBonusLine(field, count)];
  });

  return lines.length ? lines : ["No bonus cards played."];
}

function renderRoundDetail() {
  if (viewingRound === null) return;

  const roundNum = viewingRound;
  const cardsDealt = getCardsForRound(roundNum);
  roundDetailTitle.textContent = `Round ${roundNum} — ${cardsDealt} card${cardsDealt === 1 ? "" : "s"} dealt`;

  roundDetailContent.innerHTML = game.players
    .map((player) => {
      const roundData = player.rounds.find((round) => round.round === roundNum);
      if (!roundData) {
        return `<div class="round-detail-player"><h3>${player.name}</h3><p class="hint">No data recorded.</p></div>`;
      }

      const totalClass =
        roundData.total > 0 ? "positive" : roundData.total < 0 ? "negative" : "";
      const bonusLines = getBonusSummaryLines(
        roundData.bonuses,
        roundData.madeBid,
        game.useExpansion
      );

      const bonusHint =
        roundData.bonusScore !== 0
          ? ` · Bonuses/penalties: ${formatScore(roundData.bonusScore)}`
          : "";

      return `
        <div class="round-detail-player">
          <h3>${player.name}</h3>
          <dl class="round-detail-stats">
            <div><dt>Bid</dt><dd>${roundData.bid}</dd></div>
            <div><dt>Tricks won</dt><dd>${roundData.tricks}</dd></div>
            <div><dt>Made bid?</dt><dd>${roundData.madeBid ? "Yes" : "No"}</dd></div>
          </dl>
          <p class="hint">Base score: ${formatScore(roundData.baseScore)}${bonusHint}</p>
          <ul class="round-detail-breakdown">
            ${bonusLines.map((line) => `<li>${line}</li>`).join("")}
          </ul>
          <p class="round-detail-total ${totalClass}">Round total: ${formatScore(roundData.total)}</p>
        </div>
      `;
    })
    .join("");
}

function createRoundPreviewPill(roundNum, { scored = false, isCurrent = false, isViewing = false } = {}) {
  const cardsDealt = getCardsForRound(roundNum);
  const cardsLabel = `${cardsDealt} card${cardsDealt === 1 ? "" : "s"}`;

  const pill = document.createElement(scored ? "button" : "span");
  pill.className = "round-preview-pill";
  if (scored) {
    pill.type = "button";
    pill.classList.add("done");
  }
  if (isCurrent) pill.classList.add("current");
  if (isViewing) pill.classList.add("viewing");

  const roundLabel = document.createElement("span");
  roundLabel.className = "round-preview-round";
  roundLabel.textContent = `R${roundNum}`;

  const dealLabel = document.createElement("span");
  dealLabel.className = "round-preview-cards";
  dealLabel.textContent = cardsLabel;

  pill.append(roundLabel, dealLabel);
  pill.title = `Round ${roundNum} · ${cardsLabel} dealt to each player`;
  return pill;
}

function renderRoundPreview(container) {
  if (!container) return;

  container.innerHTML = "";
  for (let r = 1; r <= getTotalRounds(); r++) {
    const scored = isRoundScored(r);
    const isCurrent = r === game.currentRound && !game.completed;
    const isViewing = viewingRound === r;
    const pill = createRoundPreviewPill(r, { scored, isCurrent, isViewing });

    if (scored) {
      pill.addEventListener("click", () => openRoundDetail(r));
    }

    container.append(pill);
  }
}

function renderRoundForm() {
  const round = game.currentRound;
  const cardsDealt = getCardsForRound(round);
  const expansionBadge = game.useExpansion
    ? '<span class="expansion-badge">Expansion</span>'
    : "";
  roundBadge.innerHTML = `Round ${round} of ${getTotalRounds()}${expansionBadge}`;
  roundInfo.textContent = `${cardsDealt} card${cardsDealt === 1 ? "" : "s"} dealt to each player this round.`;

  playerRoundInputsEl.innerHTML = "";
  const bonusFields = getBonusFields(game.useExpansion);

  game.players.forEach((player, playerIndex) => {
    const card = document.createElement("div");
    card.className = "player-score-card";
    card.innerHTML = `<h3>${player.name}</h3>`;

    const grid = document.createElement("div");
    grid.className = "field-grid";

    grid.append(
      createNumberField("Bid", `bid-${playerIndex}`, 0, cardsDealt),
      createNumberField("Tricks won", `tricks-${playerIndex}`, 0, cardsDealt)
    );

    const bonusSection = document.createElement("details");
    bonusSection.className = "bonus-section";
    bonusSection.innerHTML = "<summary>Bonus cards (only if bid is exact)</summary>";

    const baseGrid = document.createElement("div");
    baseGrid.className = "bonus-grid";
    const expansionGrid = document.createElement("div");
    expansionGrid.className = "bonus-grid hidden";

    bonusFields.forEach((field) => {
      const inputField = createNumberField(
        field.label,
        `${field.inputId}-${playerIndex}`,
        0,
        field.max
      );
      if (EXPANSION_BONUS_KEYS.has(field.key)) {
        expansionGrid.append(inputField);
      } else {
        baseGrid.append(inputField);
      }
    });

    bonusSection.append(baseGrid);
    if (game.useExpansion) {
      const expansionHeading = document.createElement("p");
      expansionHeading.className = "hint bonus-subheading";
      expansionHeading.textContent = "Expansion pack";
      expansionGrid.classList.remove("hidden");
      bonusSection.append(expansionHeading, expansionGrid);
    }

    card.append(grid, bonusSection);
    playerRoundInputsEl.append(card);
  });

  undoRoundBtn.classList.toggle("hidden", game.currentRound === 1);
}

function readRoundFormData() {
  const round = game.currentRound;
  const bonusFields = getBonusFields(game.useExpansion);

  return game.players.map((player, index) => {
    const bid = Number(document.getElementById(`bid-${index}`).value);
    const tricks = Number(document.getElementById(`tricks-${index}`).value);

    const bonuses = Object.fromEntries(
      bonusFields.map((field) => [
        field.key,
        Number(document.getElementById(`${field.inputId}-${index}`).value),
      ])
    );

    const cardsDealt = getCardsForRound(round);

    const result = calculateRoundScore(round, bid, tricks, bonuses, {
      useExpansion: game.useExpansion,
      cardsDealt,
    });

    return {
      round,
      cardsDealt,
      bid,
      tricks,
      bonuses,
      ...result,
    };
  });
}

function renderScoreboard(tableEl = scoreboard) {
  if (!tableEl) return;

  const thead = tableEl.querySelector("thead");
  const tbody = tableEl.querySelector("tbody");

  const headerCells = ['<th class="player-name">Player</th>'];
  for (let r = 1; r <= getTotalRounds(); r++) {
    const scored = isRoundScored(r);
    const linkClass = scored ? ' class="round-link"' : "";
    const dataRound = scored ? ` data-round="${r}" title="View Round ${r}"` : "";
    headerCells.push(`<th${linkClass}${dataRound}>R${r}</th>`);
  }
  headerCells.push("<th>Total</th>");

  thead.innerHTML = `<tr>${headerCells.join("")}</tr>`;

  tbody.innerHTML = game.players
    .map((player) => {
      const cells = [`<td class="player-name">${player.name}</td>`];

      for (let r = 1; r <= getTotalRounds(); r++) {
        const roundData = player.rounds.find((rd) => rd.round === r);
        if (!roundData) {
          cells.push("<td>—</td>");
        } else {
          const cls = roundData.total > 0 ? "positive" : roundData.total < 0 ? "negative" : "";
          cells.push(
            `<td class="${cls} round-link" data-round="${r}" title="View Round ${r}">${formatScore(roundData.total)}</td>`
          );
        }
      }

      const total = getTotalScore(player.rounds);
      cells.push(`<td class="total-cell">${total}</td>`);
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
    winnerText.textContent = `Tie game! ${winners.map((w) => w.name).join(" & ")} share victory with ${topScore} points.`;
  }

  finalStandings.innerHTML = standings
    .map((p, i) => `<li>${i + 1}. ${p.name} — ${p.total} pts</li>`)
    .join("");

  renderRoundPreview(gameOverRoundPreview);
  renderScoreboard(gameOverScoreboard);
  updateRoundPanels();
  if (tryRecordGameHistory(game)) saveGame();
  showView("over");
}

function startGame(playerRefs, options = {}) {
  viewingRound = null;
  game = createEmptyGame(playerRefs, options);
  saveGame();
  showView("game");
  renderGameView();
}

function scoreCurrentRound() {
  const results = readRoundFormData();

  game.players.forEach((player, index) => {
    player.rounds.push(results[index]);
  });

  if (game.currentRound >= getTotalRounds()) {
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

function initSetupView() {
  viewingRound = null;
  setupCardsPerRound = null;
  setupScheduleBuildKey = null;
  roundDetailView.classList.add("hidden");
  totalRoundsInput.value = DEFAULT_TOTAL_ROUNDS;
  startingCardsInput.value = DEFAULT_STARTING_CARDS;
  cardIncrementInput.value = DEFAULT_CARD_INCREMENT;
  useExpansionCheckbox.checked = false;
  renderSetupInputs();
  renderRoundSchedule({ preserveCustom: false });
  showView("setup");
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
document.getElementById("sk-start-game-btn").addEventListener("click", () => {
  const playerRefs = getSetupPlayerRefs();
  const names = getSetupPlayerNames();
  const useExpansion = useExpansionCheckbox.checked;
  const totalRounds = Math.max(1, Math.min(20, Number(totalRoundsInput.value)));
  const cardsPerRound = applyDeckCap(
    readSetupCardsPerRound(),
    names.length,
    useExpansion
  );

  if (names.length < 2) {
    alert("Add at least 2 players to start.");
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
  if (cardsPerRound.length !== totalRounds) {
    alert("Round schedule does not match the number of rounds.");
    return;
  }
  if (cardsPerRound.some((cards) => cards < 1)) {
    alert("Each round must deal at least 1 card per player.");
    return;
  }

  const maxCards = getMaxCardsPerRound(names.length, useExpansion);
  if (cardsPerRound.some((cards) => cards > maxCards)) {
    alert(`This group can deal at most ${maxCards} cards per player per round with the selected deck.`);
    return;
  }

  startGame(promoteGuestsToSavedProfiles(playerRefs), { useExpansion, totalRounds, cardsPerRound });
});

[totalRoundsInput, startingCardsInput, cardIncrementInput, useExpansionCheckbox].forEach(
  (input) => {
    input.addEventListener("change", () => renderRoundSchedule({ preserveCustom: false }));
  }
);

roundScheduleEl.addEventListener("input", (event) => {
  if (!event.target.matches("input[data-round-index]")) return;
  setupCardsPerRound = readSetupCardsPerRound();
  setupScheduleBuildKey = getScheduleBuildKey(
    readScheduleConfig(setupScheduleEls),
    Math.max(1, Math.min(20, Number(totalRoundsInput.value) || DEFAULT_TOTAL_ROUNDS))
  );
});

[
  settingsScheduleEls.totalRoundsInput,
  settingsScheduleEls.startingCardsInput,
  settingsScheduleEls.cardIncrementInput,
  settingsScheduleEls.useExpansionCheckbox,
].forEach((input) => {
  input.addEventListener("change", () =>
    renderRoundSchedule({
      preserveCustom: false,
      scheduleEls: settingsScheduleEls,
      cardsCacheKey: "settings",
    })
  );
});

settingsScheduleEls.roundScheduleEl.addEventListener("input", (event) => {
  if (!event.target.matches("input[data-round-index]")) return;
  settingsCardsPerRound = readCardsPerRoundFromSchedule(settingsScheduleEls);
  settingsScheduleBuildKey = getScheduleBuildKey(
    readScheduleConfig(settingsScheduleEls),
    Math.max(
      1,
      Math.min(20, Number(settingsScheduleEls.totalRoundsInput.value) || DEFAULT_TOTAL_ROUNDS)
    )
  );
});

document.getElementById("sk-game-settings-btn").addEventListener("click", openGameSettings);
document.getElementById("sk-game-over-settings-btn").addEventListener("click", openGameSettings);
document.getElementById("sk-game-settings-save").addEventListener("click", saveGameSettings);
document.getElementById("sk-game-settings-cancel").addEventListener("click", closeGameSettings);
document.getElementById("sk-game-settings-close").addEventListener("click", closeGameSettings);
gameSettingsDialog.querySelector("[data-settings-dismiss]").addEventListener("click", closeGameSettings);

roundForm.addEventListener("submit", (event) => {
  event.preventDefault();
  scoreCurrentRound();
});

undoRoundBtn.addEventListener("click", undoLastRound);

backToCurrentBtn.addEventListener("click", closeRoundDetail);

scoreboard.addEventListener("click", handleScoreboardClick);
gameOverScoreboard.addEventListener("click", handleScoreboardClick);

document.getElementById("sk-new-game-btn").addEventListener("click", () => {
  showExitGameConfirm(() => shellRef?.exitToHome());
});

document.getElementById("sk-play-again-btn").addEventListener("click", () => {
  showExitGameConfirm(exitToSetup);
});
}

export function createSkullKingApp(shell) {
  shellRef = shell;
  initPlayerPickers();
  bindEvents({ showExitGameConfirm: shell.showExitGameConfirm });

  return {
    id: "skull-king",
    storageKey: STORAGE_KEY_BASE,
    loadSavedGame,
    initSetupView,
    clearGame,
    archiveToHistory,
    hasSavedGame: () => Boolean(localStorage.getItem(gameStorageKey())),
    onSetupVisible: () => {
      setupPlayerPicker?.refreshProfiles?.();
      renderRoundSchedule({ preserveCustom: false });
    },
    handleSettingsEscape: closeGameSettings,
    isSettingsOpen: () => !gameSettingsDialog.classList.contains("hidden"),
  };
}

