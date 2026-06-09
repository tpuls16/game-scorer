import { loadProfiles, subscribeProfiles } from "./profiles.js";
import { renderSavedProfileChips } from "./profile-chip.js";

/**
 * @typedef {{ name: string, isGuest?: boolean, profileId?: string }} RosterEntry
 * @typedef {{ name: string, profileId?: string, guest?: boolean }} GamePlayerRef
 */

function createNoopPicker() {
  return {
    getPlayerNames: () => [],
    getPlayersForGame: () => [],
    setRosterFromPlayers: () => {},
    getPlayerCount: () => 0,
    addGuest: () => {},
    destroy: () => {},
    refreshProfiles: () => {},
  };
}

/** @param {RosterEntry} entry */
function isGuestEntry(entry) {
  return Boolean(entry.isGuest);
}

/**
 * @param {HTMLElement | null} hostEl
 * @param {{ maxPlayers?: number, onChange?: () => void, profileBackContext?: { view: "home" | "setup", gameId?: string } }} [options]
 */
export function createPlayerPicker(hostEl, { maxPlayers = 10, onChange, profileBackContext = { view: "home" } } = {}) {
  if (!hostEl) {
    console.error("Player picker host element not found:", hostEl);
    return createNoopPicker();
  }

  /** @type {RosterEntry[]} */
  let roster = [];
  let unsubscribeProfiles = null;

  const root = document.createElement("div");
  root.className = "player-picker";

  const savedSection = document.createElement("div");
  savedSection.className = "player-picker-saved setup-subsection";
  const savedHeading = document.createElement("h4");
  savedHeading.textContent = "Saved players";
  const savedHint = document.createElement("p");
  savedHint.className = "hint";
  savedHint.textContent = "Tap names from your account to add them to this game.";
  const chipsEl = document.createElement("div");
  chipsEl.className = "profile-chips";
  chipsEl.setAttribute("role", "group");
  chipsEl.setAttribute("aria-label", "Saved players");
  const chipsEmpty = document.createElement("p");
  chipsEmpty.className = "hint profile-chips-empty";
  chipsEmpty.textContent =
    "No saved players yet. Add names on the home screen, or use Guests below.";

  const guestsSection = document.createElement("div");
  guestsSection.className = "player-picker-guests setup-subsection setup-subsection-compact";
  const guestsHeading = document.createElement("h4");
  guestsHeading.textContent = "Guests";
  const guestsHint = document.createElement("p");
  guestsHint.className = "hint";
  guestsHint.textContent =
    "One-time players for this game — they are saved to your account when you start.";
  const guestListEl = document.createElement("div");
  guestListEl.className = "player-picker-guest-list";
  guestListEl.setAttribute("aria-label", "Guest players");
  const addGuestBtn = document.createElement("button");
  addGuestBtn.type = "button";
  addGuestBtn.className = "btn btn-secondary btn-add-guest";
  addGuestBtn.textContent = "+ Add guest";

  savedSection.append(savedHeading, savedHint, chipsEl, chipsEmpty);
  guestsSection.append(guestsHeading, guestsHint, guestListEl, addGuestBtn);
  root.append(savedSection, guestsSection);
  hostEl.innerHTML = "";
  hostEl.appendChild(root);

  function emitChange() {
    onChange?.();
  }

  function isNameTaken(name) {
    const lower = name.trim().toLowerCase();
    return roster.some((entry) => entry.name.trim().toLowerCase() === lower);
  }

  function renderProfileChips() {
    const savedCount = renderSavedProfileChips(chipsEl, {
      isSelected: (profile) => roster.some((e) => e.profileId === profile.id),
      onToggle: toggleProfile,
      profileBackContext,
    });
    chipsEmpty.classList.toggle("hidden", savedCount > 0);
    chipsEl.classList.toggle("hidden", savedCount === 0);
  }

  /** @param {{ id: string, name: string }} profile */
  function toggleProfile(profile) {
    const index = roster.findIndex((e) => e.profileId === profile.id);
    if (index >= 0) {
      removeRosterEntry(index);
      return;
    }
    if (roster.length >= maxPlayers) return;
    if (isNameTaken(profile.name)) return;
    roster.push({ name: profile.name, profileId: profile.id });
    render();
    emitChange();
  }

  function removeRosterEntry(index) {
    roster.splice(index, 1);
    render();
    emitChange();
  }

  function createGuestRow(entry) {
    const row = document.createElement("div");
    row.className = "player-input-row roster-guest";

    const badge = document.createElement("span");
    badge.className = "roster-player-badge roster-guest-badge";
    badge.textContent = "Guest";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Guest name";
    input.value = entry.name;
    input.maxLength = 24;
    input.addEventListener("input", () => {
      entry.name = input.value;
      emitChange();
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-secondary";
    removeBtn.textContent = "✕";
    removeBtn.title = "Remove guest";
    removeBtn.addEventListener("click", () => {
      const index = roster.indexOf(entry);
      if (index >= 0) removeRosterEntry(index);
    });

    row.append(badge, input, removeBtn);
    return row;
  }

  function renderGuests() {
    guestListEl.innerHTML = "";
    const guests = roster.filter(isGuestEntry);
    guests.forEach((entry) => {
      guestListEl.append(createGuestRow(entry));
    });
    guestListEl.classList.toggle("is-empty", guests.length === 0);
  }

  function render() {
    renderProfileChips();
    renderGuests();
  }

  function addGuest(value = "") {
    if (roster.length >= maxPlayers) return;
    roster.push({ name: value, isGuest: true });
    render();
    const lastInput = guestListEl.querySelector(".roster-guest:last-child input");
    lastInput?.focus();
    emitChange();
  }

  addGuestBtn.addEventListener("click", () => addGuest());

  function getOrderedRoster() {
    const saved = roster.filter((entry) => !isGuestEntry(entry) && entry.profileId);
    const guests = roster.filter(isGuestEntry);
    return [...saved, ...guests];
  }

  function getPlayerNames() {
    return getOrderedRoster()
      .map((entry) => entry.name.trim())
      .filter(Boolean);
  }

  /** @returns {GamePlayerRef[]} */
  function getPlayersForGame() {
    return getOrderedRoster()
      .map((entry) => {
        const name = entry.name.trim();
        if (!name) return null;
        return isGuestEntry(entry)
          ? { name, guest: true }
          : { name, profileId: entry.profileId };
      })
      .filter(Boolean);
  }

  /** @param {GamePlayerRef[]} players */
  function setRosterFromPlayers(players) {
    const profiles = loadProfiles();
    roster = players.map((player) => {
      const name = player.name ?? "";
      if (player.guest) return { name, isGuest: true };

      if (player.profileId) {
        const byId = profiles.find((p) => p.id === player.profileId);
        if (byId) return { name: byId.name, profileId: byId.id };
      }

      const profile = profiles.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
      if (profile) return { name: profile.name, profileId: profile.id };

      return { name, isGuest: true };
    });
    render();
  }

  function setPlayerNames(names) {
    setRosterFromPlayers(names.map((name) => ({ name })));
  }

  function getPlayerCount() {
    return roster.length;
  }

  function refreshProfiles() {
    const profiles = loadProfiles();
    roster = roster
      .map((entry) => {
        if (isGuestEntry(entry)) return entry;
        if (!entry.profileId) return entry;
        const profile = profiles.find((p) => p.id === entry.profileId);
        if (!profile) return null;
        return { ...entry, name: profile.name };
      })
      .filter(Boolean);
    render();
  }

  function destroy() {
    unsubscribeProfiles?.();
    hostEl.innerHTML = "";
  }

  unsubscribeProfiles = subscribeProfiles(refreshProfiles);
  render();

  return {
    getPlayerNames,
    getPlayersForGame,
    setRosterFromPlayers,
    setPlayerNames,
    getPlayerCount,
    addGuest,
    destroy,
    refreshProfiles,
  };
}
