import { subscribeAuth } from "./auth.js";
import {
  loadProfiles,
  loadProfilesSorted,
  addProfile,
  updateProfile,
  removeProfile,
  subscribeProfiles,
} from "./profiles.js";
import { createProfileOpenButton } from "./player-profile-page.js";
import { createFavoriteToggleButton } from "./profile-favorite.js";

let profilesListEl = null;
let addProfileForm = null;
let addProfileInput = null;
let profilesEmptyHint = null;
let saveProfileBtn = null;
let profileDeleteDialogEl = null;
let profileDeleteStep1El = null;
let profileDeleteStep2El = null;
let profileDeleteStep1MessageEl = null;
let profileDeleteStep2MessageEl = null;
/** @type {string | null} */
let editingProfileId = null;
/** @type {string | null} */
let pendingDeleteProfileId = null;

/**
 * @param {HTMLElement} container
 * @param {{ id: string, name: string, favorite: boolean }} profile
 */
function appendProfileListItem(container, profile) {
  const item = document.createElement("div");
  item.className = "profile-list-item";
  item.dataset.profileId = profile.id;

  const isEditing = editingProfileId === profile.id;

  if (isEditing) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "profile-name-input";
    input.value = profile.name;
    input.maxLength = 24;
    input.setAttribute("aria-label", "Player name");
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitRename(profile.id, input);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRename();
      }
    });

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn-primary profile-save-btn";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", () => commitRename(profile.id, input));

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn-secondary profile-cancel-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", cancelRename);

    item.append(input, saveBtn, cancelBtn);
    container.append(item);
    input.focus();
    input.select();
    return;
  }

  const favoriteBtn = createFavoriteToggleButton(profile);

  const nameEl = document.createElement("span");
  nameEl.className = "profile-list-name";
  nameEl.textContent = profile.name;
  if (profile.favorite) {
    item.classList.add("is-favorite");
  }

  const actions = document.createElement("div");
  actions.className = "profile-list-actions";

  const profileBtn = createProfileOpenButton(profile, { view: "home" });

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "btn btn-secondary profile-edit-btn";
  editBtn.textContent = "Rename";
  editBtn.addEventListener("click", () => startRename(profile.id));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-secondary profile-delete-btn";
  deleteBtn.textContent = "Delete";
  deleteBtn.setAttribute("aria-label", `Remove ${profile.name}`);
  deleteBtn.addEventListener("click", () => {
    const current = loadProfiles().find((p) => p.id === profile.id);
    if (!current) return;
    openProfileDeleteDialog(current);
  });

  actions.append(profileBtn, editBtn, deleteBtn);
  item.append(favoriteBtn, nameEl, actions);
  container.append(item);
}

function renderProfilesList() {
  if (!profilesListEl) return;

  const sorted = loadProfilesSorted();

  profilesEmptyHint?.classList.toggle("hidden", sorted.length > 0);

  profilesListEl.innerHTML = "";
  sorted.forEach((profile) => appendProfileListItem(profilesListEl, profile));
}

function startRename(profileId) {
  editingProfileId = profileId;
  renderProfilesList();
}

function cancelRename() {
  editingProfileId = null;
  renderProfilesList();
}

/** @param {string} profileId @param {HTMLInputElement} input */
function commitRename(profileId, input) {
  const nextName = input.value.trim();
  if (!nextName) {
    alert("Enter a name to save.");
    input.focus();
    return;
  }

  const current = loadProfiles().find((p) => p.id === profileId);
  if (current && current.name === nextName) {
    editingProfileId = null;
    renderProfilesList();
    return;
  }

  try {
    const ok = updateProfile(profileId, nextName);
    if (!ok) {
      alert("Could not save that name. It may be empty or already used by another saved player.");
      input.focus();
      input.select();
      return;
    }
    editingProfileId = null;
    renderProfilesList();
  } catch (error) {
    alert(error instanceof Error ? error.message : "Could not save player.");
    input.focus();
  }
}

function saveProfileFromInput() {
  const name = addProfileInput?.value.trim() ?? "";
  if (!name) {
    addProfileInput?.focus();
    return;
  }

  try {
    const created = addProfile(name);
    if (!created) {
      alert("That name is already saved, or could not be added.");
      return;
    }
    addProfileInput.value = "";
    addProfileInput.focus();
    renderProfilesList();
  } catch (error) {
    alert(error instanceof Error ? error.message : "Could not save player.");
  }
}

function handleAddProfile(event) {
  event.preventDefault();
  saveProfileFromInput();
}

function showProfileDeleteStep(step) {
  profileDeleteStep1El?.classList.toggle("hidden", step !== 1);
  profileDeleteStep2El?.classList.toggle("hidden", step !== 2);
}

function closeProfileDeleteDialog() {
  pendingDeleteProfileId = null;
  profileDeleteDialogEl?.classList.add("hidden");
  showProfileDeleteStep(1);
}

function openProfileDeleteDialog(profile) {
  pendingDeleteProfileId = profile.id;
  if (profileDeleteStep1MessageEl) {
    profileDeleteStep1MessageEl.textContent = `Remove "${profile.name}" from your saved players?`;
  }
  if (profileDeleteStep2MessageEl) {
    profileDeleteStep2MessageEl.textContent = `This permanently deletes "${profile.name}" from this account. Game history for this player will remain, but they will no longer appear in your roster.`;
  }
  showProfileDeleteStep(1);
  profileDeleteDialogEl?.classList.remove("hidden");
  document.getElementById("profile-delete-cancel-btn")?.focus();
}

function confirmProfileDelete() {
  const profileId = pendingDeleteProfileId;
  if (!profileId) return;

  const profile = loadProfiles().find((p) => p.id === profileId);
  if (!profile) {
    closeProfileDeleteDialog();
    return;
  }

  if (editingProfileId === profileId) editingProfileId = null;
  removeProfile(profileId);
  closeProfileDeleteDialog();
}

export function initProfilesPage() {
  profilesListEl = document.getElementById("profiles-list");
  addProfileForm = document.getElementById("add-profile-form");
  addProfileInput = document.getElementById("add-profile-name");
  profilesEmptyHint = document.getElementById("profiles-empty-hint");
  saveProfileBtn = document.getElementById("add-profile-save-btn");
  profileDeleteDialogEl = document.getElementById("profile-delete-dialog");
  profileDeleteStep1El = document.getElementById("profile-delete-step-1");
  profileDeleteStep2El = document.getElementById("profile-delete-step-2");
  profileDeleteStep1MessageEl = document.getElementById("profile-delete-step1-message");
  profileDeleteStep2MessageEl = document.getElementById("profile-delete-step2-message");

  if (!profilesListEl || !addProfileForm || !addProfileInput) {
    console.error("Saved players UI elements are missing from the page.");
    return;
  }

  addProfileForm.addEventListener("submit", handleAddProfile);
  saveProfileBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    saveProfileFromInput();
  });

  document.getElementById("profile-delete-cancel-btn")?.addEventListener("click", closeProfileDeleteDialog);
  document.getElementById("profile-delete-continue-btn")?.addEventListener("click", () => {
    showProfileDeleteStep(2);
    document.getElementById("profile-delete-back-btn")?.focus();
  });
  document.getElementById("profile-delete-back-btn")?.addEventListener("click", () => {
    showProfileDeleteStep(1);
    document.getElementById("profile-delete-cancel-btn")?.focus();
  });
  document.getElementById("profile-delete-confirm-btn")?.addEventListener("click", confirmProfileDelete);
  profileDeleteDialogEl
    ?.querySelector("[data-profile-delete-dismiss]")
    ?.addEventListener("click", closeProfileDeleteDialog);

  document.addEventListener("keydown", (event) => {
    if (profileDeleteDialogEl?.classList.contains("hidden")) return;
    if (event.key === "Escape") closeProfileDeleteDialog();
  });

  subscribeProfiles(() => {
    if (editingProfileId && !loadProfiles().some((p) => p.id === editingProfileId)) {
      editingProfileId = null;
    }
    renderProfilesList();
  });

  subscribeAuth((user) => {
    if (user) {
      renderProfilesList();
    }
  });

  renderProfilesList();
}

