import { subscribeAuth } from "./auth.js";
import {
  createHousehold,
  joinHouseholdByCode,
  loadMyHouseholds,
  regenerateHouseholdInviteCode,
  setHouseholdInviteCode,
} from "./households.js";

let householdsListEl = null;
let householdsEmptyHint = null;
let householdsLiveScoresEl = null;
let joinHouseholdForm = null;
let joinHouseholdInput = null;
let joinHouseholdStatusEl = null;
let createHouseholdForm = null;
let createHouseholdInput = null;
let createHouseholdStatusEl = null;

const HOUSEHOLDS_EMPTY_DEFAULT =
  "You're not in a household yet. Create one for your family or join with an invite code below.";

function setStatus(el, message, isError = false) {
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("household-status-error", isError);
  el.classList.toggle("hidden", !message);
}

function normalizeInviteCodeInput(input) {
  input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * @param {HTMLElement} statusEl
 * @param {import("./households.js").HouseholdMembership} household
 */
function renderOwnerInviteControls(statusEl, household) {
  const section = document.createElement("div");
  section.className = "household-invite-controls";

  const heading = document.createElement("h4");
  heading.className = "households-subheading";
  heading.textContent = "Join code";

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent =
    "Set a code your family will remember, or generate a random one. Share it so others can join.";

  const row = document.createElement("div");
  row.className = "household-invite-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "household-invite-input";
  input.maxLength = 12;
  input.value = household.inviteCode;
  input.placeholder = "6–12 letters or numbers";
  input.setAttribute("aria-label", "Household join code");

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn btn-primary";
  saveBtn.textContent = "Save code";

  const regenBtn = document.createElement("button");
  regenBtn.type = "button";
  regenBtn.className = "btn btn-secondary";
  regenBtn.textContent = "Generate new code";

  input.addEventListener("input", () => normalizeInviteCodeInput(input));

  saveBtn.addEventListener("click", async () => {
    const code = input.value.trim();
    if (code.length < 6) {
      setStatus(statusEl, "Join code must be at least 6 characters.", true);
      return;
    }

    setStatus(statusEl, "Saving…");
    saveBtn.disabled = true;
    regenBtn.disabled = true;

    try {
      const updated = await setHouseholdInviteCode(household.id, code);
      input.value = updated.inviteCode;
      setStatus(statusEl, "Join code saved.");
      await refreshHouseholdsList();
    } catch (error) {
      setStatus(
        statusEl,
        error instanceof Error ? error.message : "Could not save join code.",
        true
      );
    } finally {
      saveBtn.disabled = false;
      regenBtn.disabled = false;
    }
  });

  regenBtn.addEventListener("click", async () => {
    setStatus(statusEl, "Generating…");
    saveBtn.disabled = true;
    regenBtn.disabled = true;

    try {
      const updated = await regenerateHouseholdInviteCode(household.id);
      input.value = updated.inviteCode;
      setStatus(statusEl, "New join code generated.");
      await refreshHouseholdsList();
    } catch (error) {
      setStatus(
        statusEl,
        error instanceof Error ? error.message : "Could not generate join code.",
        true
      );
    } finally {
      saveBtn.disabled = false;
      regenBtn.disabled = false;
    }
  });

  row.append(input, saveBtn, regenBtn);
  section.append(heading, hint, row);
  return section;
}

/**
 * @param {import("./households.js").HouseholdMembership} household
 */
function renderHouseholdCard(household) {
  const card = document.createElement("article");
  card.className = "household-card";
  card.dataset.householdId = household.id;

  const title = document.createElement("h3");
  title.className = "household-card-name";
  title.textContent = household.name;

  const meta = document.createElement("p");
  meta.className = "hint household-card-meta";
  const roleLabel = household.role === "owner" ? "Owner" : "Member";
  meta.textContent = roleLabel;

  const cardStatus = document.createElement("p");
  cardStatus.className = "household-status household-card-status hidden";
  cardStatus.setAttribute("aria-live", "polite");

  card.append(title, meta);

  if (household.role === "owner") {
    card.append(renderOwnerInviteControls(cardStatus, household));
  } else {
    const codeLine = document.createElement("p");
    codeLine.className = "hint household-card-meta";
    codeLine.textContent = `Join code: ${household.inviteCode}`;

    const shareHint = document.createElement("p");
    shareHint.className = "hint household-card-share";
    shareHint.textContent = "Ask the owner if you need the join code for someone else.";

    card.append(codeLine, shareHint);
  }

  card.append(cardStatus);
  return card;
}

async function refreshHouseholdsList() {
  if (!householdsListEl || !householdsEmptyHint) return;

  householdsListEl.innerHTML = "";

  try {
    const households = await loadMyHouseholds();
    householdsEmptyHint.textContent = HOUSEHOLDS_EMPTY_DEFAULT;
    householdsEmptyHint.classList.toggle("hidden", households.length > 0);
    householdsLiveScoresEl?.classList.toggle("hidden", households.length === 0);

    households.forEach((household) => {
      householdsListEl.append(renderHouseholdCard(household));
    });
  } catch (error) {
    householdsEmptyHint.classList.remove("hidden");
    householdsEmptyHint.textContent =
      error instanceof Error ? error.message : "Could not load your households.";
    householdsLiveScoresEl?.classList.add("hidden");
  }
}

async function handleJoinHousehold(event) {
  event.preventDefault();
  if (!joinHouseholdInput) return;

  const code = joinHouseholdInput.value.trim();
  if (code.length < 6) {
    setStatus(joinHouseholdStatusEl, "Enter the full join code.", true);
    return;
  }

  setStatus(joinHouseholdStatusEl, "Joining…");
  joinHouseholdForm?.querySelector("button[type=submit]")?.setAttribute("disabled", "true");

  try {
    await joinHouseholdByCode(code);
    joinHouseholdInput.value = "";
    setStatus(joinHouseholdStatusEl, "Joined household.");
    await refreshHouseholdsList();
  } catch (error) {
    setStatus(
      joinHouseholdStatusEl,
      error instanceof Error ? error.message : "Could not join household.",
      true
    );
  } finally {
    joinHouseholdForm?.querySelector("button[type=submit]")?.removeAttribute("disabled");
  }
}

async function handleCreateHousehold(event) {
  event.preventDefault();
  if (!createHouseholdInput) return;

  const name = createHouseholdInput.value.trim();
  if (!name) {
    setStatus(createHouseholdStatusEl, "Enter a household name.", true);
    return;
  }

  setStatus(createHouseholdStatusEl, "Creating…");
  createHouseholdForm?.querySelector("button[type=submit]")?.setAttribute("disabled", "true");

  try {
    await createHousehold(name);
    createHouseholdInput.value = "";
    setStatus(createHouseholdStatusEl, "Household created — set your join code below.");
    await refreshHouseholdsList();
  } catch (error) {
    setStatus(
      createHouseholdStatusEl,
      error instanceof Error ? error.message : "Could not create household.",
      true
    );
  } finally {
    createHouseholdForm?.querySelector("button[type=submit]")?.removeAttribute("disabled");
  }
}

export function initHouseholdsPage() {
  householdsListEl = document.getElementById("households-list");
  householdsEmptyHint = document.getElementById("households-empty-hint");
  householdsLiveScoresEl = document.getElementById("households-live-scores");
  joinHouseholdForm = document.getElementById("join-household-form");
  joinHouseholdInput = document.getElementById("join-household-code");
  joinHouseholdStatusEl = document.getElementById("join-household-status");
  createHouseholdForm = document.getElementById("create-household-form");
  createHouseholdInput = document.getElementById("create-household-name");
  createHouseholdStatusEl = document.getElementById("create-household-status");

  joinHouseholdInput?.addEventListener("input", () => {
    normalizeInviteCodeInput(joinHouseholdInput);
  });

  joinHouseholdForm?.addEventListener("submit", handleJoinHousehold);
  createHouseholdForm?.addEventListener("submit", handleCreateHousehold);

  subscribeAuth((user) => {
    if (user) {
      refreshHouseholdsList();
    } else if (householdsListEl) {
      householdsListEl.innerHTML = "";
      householdsEmptyHint?.classList.remove("hidden");
      householdsEmptyHint.textContent = HOUSEHOLDS_EMPTY_DEFAULT;
      householdsLiveScoresEl?.classList.add("hidden");
    }
  });
}
