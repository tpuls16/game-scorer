import { loadProfilesSplit, getProfileById } from "./profiles.js";
import { createProfileOpenButton } from "./player-profile-page.js";

/**
 * @param {HTMLElement} container
 * @param {{ isSelected: (profile: { id: string, name: string, favorite: boolean }) => boolean, onToggle: (profile: { id: string, name: string, favorite: boolean }) => void, profileBackContext?: { view: "home" | "setup", gameId?: string } }} options
 */
export function renderFavoriteProfileChips(container, {
  isSelected,
  onToggle,
  profileBackContext = { view: "home" },
}) {
  container.innerHTML = "";
  const { favorites } = loadProfilesSplit();

  favorites.forEach((profile) => {
    const row = document.createElement("div");
    row.className = "profile-chip-row is-favorite";

    const selectBtn = document.createElement("button");
    selectBtn.type = "button";
    selectBtn.className = "profile-chip";
    selectBtn.dataset.profileId = profile.id;
    selectBtn.textContent = `★ ${profile.name}`;
    const selected = isSelected(profile);
    selectBtn.setAttribute("aria-pressed", selected ? "true" : "false");
    selectBtn.classList.toggle("is-selected", selected);
    selectBtn.addEventListener("click", () => onToggle(profile));

    row.append(selectBtn, createProfileOpenButton(profile, profileBackContext));
    container.append(row);
  });

  return favorites.length;
}

/**
 * @param {{
 *   onPick: (profile: { id: string, name: string, favorite: boolean }) => void,
 *   placeholder?: string,
 *   labelText?: string,
 *   isOptionDisabled?: (profile: { id: string, name: string, favorite: boolean }) => boolean,
 *   formatOptionLabel?: (profile: { id: string, name: string, favorite: boolean }) => string,
 * }} options
 */
export function mountOtherProfilesDropdown({
  onPick,
  placeholder = "Choose a player…",
  labelText = "Other household players",
  isOptionDisabled,
  formatOptionLabel,
}) {
  const wrap = document.createElement("div");
  wrap.className = "profiles-other-dropdown";

  const label = document.createElement("label");
  label.className = "profiles-other-select-label";

  const labelTextEl = document.createElement("span");
  labelTextEl.className = "profiles-other-select-text";
  labelTextEl.textContent = labelText;

  const select = document.createElement("select");
  select.className = "profiles-other-select";
  select.setAttribute("aria-label", labelText);

  function refresh() {
    const { others } = loadProfilesSplit();
    select.innerHTML = "";
    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = placeholder;
    select.append(defaultOpt);

    others.forEach((profile) => {
      const opt = document.createElement("option");
      opt.value = profile.id;
      opt.textContent = formatOptionLabel ? formatOptionLabel(profile) : profile.name;
      if (isOptionDisabled?.(profile)) opt.disabled = true;
      select.append(opt);
    });

    wrap.classList.toggle("hidden", others.length === 0);
  }

  select.addEventListener("change", () => {
    if (!select.value) return;
    const profile = getProfileById(select.value);
    if (profile) onPick(profile);
    select.value = "";
    refresh();
  });

  label.append(labelTextEl, select);
  wrap.append(label);
  refresh();

  return { element: wrap, refresh, select };
}
