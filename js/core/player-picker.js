import { loadProfiles, loadProfilesSplit, subscribeProfiles } from "./profiles.js";
import { renderFavoriteProfileChips, mountOtherProfilesDropdown } from "./profile-chip.js";
import { createProfileOpenButton } from "./player-profile-page.js";

/**
 * @typedef {{ name: string, profileId?: string }} RosterEntry
 */

function createNoopPicker() {
  return {
    getPlayerNames: () => [],
    setPlayerNames: () => {},
    getPlayerCount: () => 0,
    addGuest: () => {},
    destroy: () => {},
    refreshProfiles: () => {},
  };
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

  const householdSection = document.createElement("div");
  householdSection.className = "player-picker-household setup-subsection";
  const householdHeading = document.createElement("h4");
  householdHeading.textContent = "Your players";
  const householdHint = document.createElement("p");
  householdHint.className = "hint";
  householdHint.textContent =
    "Tap a favorite to add them, or choose another saved player from the menu.";
  const chipsEl = document.createElement("div");
  chipsEl.className = "profile-chips";
  chipsEl.setAttribute("role", "group");
  chipsEl.setAttribute("aria-label", "Favorite saved players");
  const otherDropdownHost = document.createElement("div");
  otherDropdownHost.className = "profiles-other-dropdown-host";
  const chipsEmpty = document.createElement("p");
  chipsEmpty.className = "hint profile-chips-empty";
  chipsEmpty.textContent =
    "No saved players yet. Add names on the home screen under Your players.";

  const otherProfilesDropdown = mountOtherProfilesDropdown({
    placeholder: "Add another saved player…",
    onPick: (profile) => toggleProfile(profile),
    isOptionDisabled: (profile) =>
      roster.length >= maxPlayers ||
      roster.some((e) => e.profileId === profile.id) ||
      isNameTaken(profile.name),
    formatOptionLabel: (profile) =>
      roster.some((e) => e.profileId === profile.id) ? `${profile.name} (added)` : profile.name,
  });
  otherDropdownHost.append(otherProfilesDropdown.element);

  const rosterSection = document.createElement("div");
  rosterSection.className = "player-picker-roster setup-subsection";
  const rosterHeading = document.createElement("h4");
  rosterHeading.textContent = "Playing this game";
  const rosterEl = document.createElement("div");
  rosterEl.className = "game-roster";
  rosterEl.setAttribute("aria-label", "Players in this game");

  const actions = document.createElement("div");
  actions.className = "player-picker-actions";
  const addGuestBtn = document.createElement("button");
  addGuestBtn.type = "button";
  addGuestBtn.className = "btn btn-secondary";
  addGuestBtn.textContent = "+ Add guest";

  householdSection.append(
    householdHeading,
    householdHint,
    chipsEl,
    otherDropdownHost,
    chipsEmpty
  );
  rosterSection.append(rosterHeading, rosterEl);
  actions.append(addGuestBtn);
  root.append(householdSection, rosterSection, actions);
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
    const favoriteCount = renderFavoriteProfileChips(chipsEl, {
      isSelected: (profile) => roster.some((e) => e.profileId === profile.id),
      onToggle: toggleProfile,
      profileBackContext,
    });
    otherProfilesDropdown.refresh();
    const { favorites, others } = loadProfilesSplit();
    const total = favorites.length + others.length;
    chipsEmpty.classList.toggle("hidden", total > 0);
    chipsEl.classList.toggle("hidden", favoriteCount === 0);
    if (total > 0 && favoriteCount === 0) {
      chipsEmpty.textContent = "No favorites yet — use the menu below to add other saved players.";
      chipsEmpty.classList.remove("hidden");
    } else if (total === 0) {
      chipsEmpty.textContent =
        "No saved players yet. Add names on the home screen under Your players.";
    }
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

    row.append(input, removeBtn);
    return row;
  }

  function render() {
    renderProfileChips();
    rosterEl.innerHTML = "";

    roster.forEach((entry) => {
      if (entry.profileId) {
        const row = document.createElement("div");
        row.className = "roster-player";
        const name = document.createElement("span");
        name.className = "roster-player-name";
        name.textContent = entry.name;
        const badge = document.createElement("span");
        badge.className = "roster-player-badge";
        badge.textContent = "Saved";
        const profile = loadProfiles().find((p) => p.id === entry.profileId);
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn btn-secondary";
        removeBtn.textContent = "✕";
        removeBtn.title = "Remove from game";
        removeBtn.addEventListener("click", () => {
          const index = roster.indexOf(entry);
          if (index >= 0) removeRosterEntry(index);
        });
        const rosterActions = document.createElement("div");
        rosterActions.className = "roster-player-actions";
        if (profile) {
          rosterActions.append(createProfileOpenButton(profile, profileBackContext));
        }
        rosterActions.append(removeBtn);
        row.append(name, badge, rosterActions);
        rosterEl.append(row);
        return;
      }

      rosterEl.append(createGuestRow(entry));
    });

    if (roster.length === 0) {
      const empty = document.createElement("p");
      empty.className = "hint roster-empty";
      empty.textContent = "No players selected — tap saved player names above or add a guest.";
      rosterEl.append(empty);
    }
  }

  function addGuest(value = "") {
    if (roster.length >= maxPlayers) return;
    roster.push({ name: value });
    render();
    const lastInput = rosterEl.querySelector(".roster-guest:last-child input");
    lastInput?.focus();
    emitChange();
  }

  addGuestBtn.addEventListener("click", () => addGuest());

  function getPlayerNames() {
    return roster.map((entry) => entry.name.trim()).filter(Boolean);
  }

  function setPlayerNames(names) {
    const profiles = loadProfiles();
    roster = names.map((name) => {
      const profile = profiles.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
      if (profile) return { name: profile.name, profileId: profile.id };
      return { name };
    });
    render();
  }

  function getPlayerCount() {
    return roster.length;
  }

  function refreshProfiles() {
    const profiles = loadProfiles();
    roster = roster
      .map((entry) => {
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
    setPlayerNames,
    getPlayerCount,
    addGuest,
    destroy,
    refreshProfiles,
  };
}
