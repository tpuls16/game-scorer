import { getGameById } from "./catalog.js";
import { getProfileById, loadProfiles } from "./profiles.js";
import { scopedStorageKey, HISTORY_STORAGE_BASE } from "./user-storage.js";
import { getTotalScore as getSkullKingTotal } from "../games/skull-king/scoring.js";
import { getTotalScore as getFlip7Total } from "../games/flip7/scoring.js";
import { getTeamTotals } from "../games/rook/scoring.js";

const HISTORY_VERSION = 1;
const MAX_HISTORY_ENTRIES = 200;

/**
 * @typedef {{
 *   name: string,
 *   profileId?: string,
 *   guest?: boolean,
 *   score?: number,
 *   place?: number,
 *   detail?: string
 * }} HistoryPlayerResult
 */

/**
 * @typedef {{
 *   id: string,
 *   gameId: string,
 *   gameName: string,
 *   completedAt: string,
 *   players: HistoryPlayerResult[],
 *   standings?: { label: string, score: number, place: number }[],
 *   meta?: Record<string, unknown>
 * }} GameHistoryEntry
 */

function historyStorageKey() {
  return scopedStorageKey(HISTORY_STORAGE_BASE);
}

function createHistoryId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `history-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** @returns {GameHistoryEntry[]} */
export function loadGameHistory() {
  const raw = localStorage.getItem(historyStorageKey());
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.entries)) return [];
    return parsed.entries;
  } catch {
    return [];
  }
}

/** @param {GameHistoryEntry[]} entries */
function writeGameHistory(entries) {
  try {
    localStorage.setItem(
      historyStorageKey(),
      JSON.stringify({
        version: HISTORY_VERSION,
        entries: entries.slice(0, MAX_HISTORY_ENTRIES),
      })
    );
  } catch (error) {
    console.error("Failed to save game history", error);
  }
}

/** @param {GameHistoryEntry} entry */
function appendHistoryEntry(entry) {
  const entries = loadGameHistory();
  entries.unshift(entry);
  writeGameHistory(entries);
}

/**
 * @param {{ name: string, profileId?: string, guest?: boolean, score: number }[]} standings
 * @returns {HistoryPlayerResult[]}
 */
function assignPlaces(standings) {
  return standings
    .sort((a, b) => b.score - a.score)
    .map((player, index) => ({
      name: player.name,
      profileId: player.profileId,
      guest: player.guest,
      score: player.score,
      place: index + 1,
    }));
}

/** @param {unknown} game */
function buildSkullKingHistory(game) {
  const standings = game.players.map((player) => ({
    name: player.name,
    profileId: player.profileId,
    guest: player.guest,
    score: getSkullKingTotal(player.rounds ?? []),
  }));

  return {
    gameId: "skull-king",
    players: assignPlaces(standings),
    meta: {
      totalRounds: game.totalRounds,
      useExpansion: Boolean(game.useExpansion),
    },
  };
}

/** @param {unknown} game */
function buildFlip7History(game) {
  const standings = game.players.map((player) => ({
    name: player.name,
    profileId: player.profileId,
    guest: player.guest,
    score: getFlip7Total(player.rounds ?? []),
  }));

  return {
    gameId: "flip7",
    players: assignPlaces(standings),
    meta: {
      targetScore: game.targetScore,
      flip7Bonus: game.flip7Bonus,
    },
  };
}

/** @param {unknown} game */
function buildRookHistory(game) {
  const totals = getTeamTotals(game);
  const teamStandings = game.teamLabels
    .map((label, index) => ({
      label,
      score: totals[index] ?? 0,
    }))
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({
      ...row,
      place: index + 1,
    }));

  const players = game.players.map((player, index) => {
    const teamIndex = index < 2 ? 0 : 1;
    const teamPlace =
      teamStandings.find((row) => row.label === game.teamLabels[teamIndex])?.place ?? teamIndex + 1;

    return {
      name: player.name,
      profileId: player.profileId,
      guest: player.guest,
      score: totals[teamIndex] ?? 0,
      place: teamPlace,
      detail: game.teamLabels[teamIndex],
    };
  });

  return {
    gameId: "rook",
    players,
    standings: teamStandings,
    meta: {
      targetScore: game.targetScore,
      handsPlayed: game.rounds?.length ?? 0,
    },
  };
}

/** @param {unknown} game */
function buildHistorySummary(game) {
  const gameId = game.gameId ?? "skull-king";
  switch (gameId) {
    case "skull-king":
      return buildSkullKingHistory(game);
    case "flip7":
      return buildFlip7History(game);
    case "rook":
      return buildRookHistory(game);
    default:
      return null;
  }
}

/**
 * @param {Record<string, unknown> & { completed?: boolean, historyRecorded?: boolean }} game
 * @returns {boolean}
 */
export function tryRecordGameHistory(game) {
  if (!game?.completed || game.historyRecorded) return false;

  const summary = buildHistorySummary(game);
  if (!summary) return false;

  const gameDef = getGameById(summary.gameId);
  appendHistoryEntry({
    id: createHistoryId(),
    gameId: summary.gameId,
    gameName: gameDef?.name ?? summary.gameId,
    completedAt: new Date().toISOString(),
    players: summary.players,
    standings: summary.standings,
    meta: summary.meta,
  });

  game.historyRecorded = true;
  return true;
}

/**
 * @param {string} profileId
 * @returns {GameHistoryEntry[]}
 */
export function getHistoryForProfile(profileId) {
  const profile = getProfileById(profileId);
  if (!profile) return [];

  const nameKey = profile.name.trim().toLowerCase();
  return loadGameHistory().filter((entry) =>
    entry.players.some(
      (player) =>
        player.profileId === profileId ||
        (!player.guest && player.name.trim().toLowerCase() === nameKey)
    )
  );
}

/**
 * @param {HistoryPlayerResult} player
 * @returns {import("./profiles.js").PlayerProfile | null}
 */
export function resolveHistoryPlayerProfile(player) {
  if (player.guest) return null;
  if (player.profileId) {
    const byId = getProfileById(player.profileId);
    if (byId) return byId;
  }
  return (
    loadProfiles().find(
      (profile) => profile.name.trim().toLowerCase() === player.name.trim().toLowerCase()
    ) ?? null
  );
}

/** @param {string} iso */
export function formatHistoryDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** @param {string} iso */
export function formatHistoryDateShort(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** @param {number} [limit] @returns {GameHistoryEntry[]} */
export function getRecentGameHistory(limit = 3) {
  return loadGameHistory().slice(0, limit);
}
