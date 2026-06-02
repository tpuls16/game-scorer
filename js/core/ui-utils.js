export function createPlayerInputRow(value = "", index, { container, onChange, minPlayers = 2 } = {}) {
  const row = document.createElement("div");
  row.className = "player-input-row";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = `Player ${index + 1}`;
  input.value = value;
  input.maxLength = 24;
  input.dataset.index = index;

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-secondary";
  removeBtn.textContent = "✕";
  removeBtn.title = "Remove player";
  removeBtn.addEventListener("click", () => {
    const rows = container.querySelectorAll(".player-input-row");
    if (rows.length <= minPlayers) return;
    row.remove();
    onChange?.();
  });

  row.append(input, removeBtn);
  return row;
}

export function getPlayerNamesFromContainer(container) {
  return [...container.querySelectorAll(".player-input-row input")]
    .map((input) => input.value.trim())
    .filter(Boolean);
}

export function createNumberField(labelText, id, min, max, { value = 0, required = true } = {}) {
  const wrapper = document.createElement("div");

  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = labelText;

  const input = document.createElement("input");
  input.type = "number";
  input.id = id;
  input.min = min;
  input.max = max;
  input.value = value;
  input.required = required;

  wrapper.append(label, input);
  return wrapper;
}

export function createCheckboxField(labelText, id, { checked = false } = {}) {
  const label = document.createElement("label");
  label.className = "checkbox-field";
  label.htmlFor = id;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.checked = checked;

  const text = document.createElement("span");
  text.textContent = labelText;

  label.append(input, text);
  return label;
}
