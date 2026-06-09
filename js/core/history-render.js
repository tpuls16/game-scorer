import { getGameById } from "./catalog.js";
import {
  formatHistoryDate,
  formatHistoryDateShort,
  resolveHistoryPlayerProfile,
} from "./game-history.js";

/**
 * @typedef {import("./game-history.js").GameHistoryEntry} GameHistoryEntry
 * @typedef {import("./game-history.js").HistoryPlayerResult} HistoryPlayerResult
 */

/**
 * @param {HistoryPlayerResult} player
 * @param {string | null | undefined} viewingProfileId
 * @param {(profileId: string) => void} [onPlayerClick]
 */
function createHistoryPlayerName(player, viewingProfileId, onPlayerClick) {
  const profile = resolveHistoryPlayerProfile(player);

  if (profile && profile.id !== viewingProfileId && onPlayerClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "history-player-link";
    btn.textContent = player.name;
    btn.addEventListener("click", () => onPlayerClick(profile.id));
    return btn;
  }

  const span = document.createElement("span");
  span.textContent = player.name;
  if (player.guest) span.className = "history-player-guest";
  return span;
}

/**
 * @param {GameHistoryEntry} entry
 * @returns {{ label: string, score: number, place: number }[]}
 */
function getStandingsRows(entry) {
  if (entry.standings?.length) {
    return [...entry.standings].sort((a, b) => a.place - b.place);
  }

  return [...entry.players]
    .sort((a, b) => (a.place ?? 99) - (b.place ?? 99))
    .map((player) => ({
      label: player.name,
      score: player.score ?? 0,
      place: player.place ?? 0,
      player,
    }));
}

/**
 * @param {GameHistoryEntry} entry
 * @param {{
 *   compact?: boolean,
 *   maxStandings?: number,
 *   viewingProfileId?: string | null,
 *   onPlayerClick?: (profileId: string) => void,
 * }} [options]
 * @returns {HTMLElement}
 */
export function createHistoryEntryElement(entry, options = {}) {
  const {
    compact = false,
    maxStandings = Infinity,
    viewingProfileId = null,
    onPlayerClick,
  } = options;

  const gameDef = getGameById(entry.gameId);
  const card = document.createElement("article");
  card.className = compact ? "history-entry history-entry-compact" : "history-entry";

  const header = document.createElement("header");
  header.className = "history-entry-header";

  const titleRow = document.createElement("div");
  titleRow.className = "history-entry-title-row";

  if (gameDef?.icon) {
    const icon = document.createElement("span");
    icon.className = "history-entry-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = gameDef.icon;
    titleRow.append(icon);
  }

  const title = document.createElement("h4");
  title.className = "history-entry-title";
  title.textContent = entry.gameName;

  const date = document.createElement("p");
  date.className = "hint history-entry-date";
  const dateText = compact
    ? formatHistoryDateShort(entry.completedAt)
    : formatHistoryDate(entry.completedAt);
  date.textContent = entry.meta?.endedEarly ? `${dateText} · ended early` : dateText;

  titleRow.append(title, date);
  header.append(titleRow);

  const standings = getStandingsRows(entry);
  const visible = standings.slice(0, maxStandings);
  const hiddenCount = standings.length - visible.length;

  if (compact) {
    const summary = document.createElement("p");
    summary.className = "history-entry-compact-standings";
    summary.textContent = visible
      .map((row) => {
        const name = row.label ?? row.player?.name ?? "—";
        const score = typeof row.score === "number" ? row.score : "—";
        return `${row.place}. ${name} ${score}`;
      })
      .join(" · ");
    if (hiddenCount > 0) {
      summary.textContent += ` · +${hiddenCount} more`;
    }
    card.append(header, summary);
    return card;
  }

  const list = document.createElement("ol");
  list.className = "history-entry-standings";

  visible.forEach((row) => {
    const item = document.createElement("li");
    item.className = "history-entry-player";

    const place = document.createElement("span");
    place.className = "history-entry-place";
    place.textContent = `${row.place}.`;

    const nameWrap = document.createElement("span");
    nameWrap.className = "history-entry-player-name";

    if (row.player) {
      nameWrap.append(
        createHistoryPlayerName(row.player, viewingProfileId, onPlayerClick)
      );
    } else {
      nameWrap.textContent = row.label;
    }

    const score = document.createElement("span");
    score.className = "history-entry-score";
    score.textContent = typeof row.score === "number" ? `${row.score} pts` : "";

    if (row.player?.detail) {
      const detail = document.createElement("span");
      detail.className = "hint history-entry-detail";
      detail.textContent = row.player.detail;
      item.append(place, nameWrap, detail, score);
    } else {
      item.append(place, nameWrap, score);
    }

    list.append(item);
  });

  if (hiddenCount > 0) {
    const more = document.createElement("p");
    more.className = "hint history-entry-more";
    more.textContent = `+${hiddenCount} more not shown`;
    card.append(header, list, more);
    return card;
  }

  card.append(header, list);
  return card;
}

/**
 * @param {HTMLElement} container
 * @param {GameHistoryEntry[]} entries
 * @param {Parameters<typeof createHistoryEntryElement>[1]} [options]
 */
export function renderHistoryEntries(container, entries, options = {}) {
  container.innerHTML = "";

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = options.emptyMessage ?? "No completed games yet.";
    container.append(empty);
    return;
  }

  entries.forEach((entry) => {
    container.append(createHistoryEntryElement(entry, options));
  });
}
