import { toggleProfileFavorite } from "./profiles.js";

/** @param {{ id: string, name: string, favorite: boolean }} profile */
export function createFavoriteToggleButton(profile) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-favorite-toggle";
  btn.textContent = profile.favorite ? "★" : "☆";
  btn.setAttribute(
    "aria-label",
    profile.favorite ? `Remove ${profile.name} from favorites` : `Add ${profile.name} to favorites`
  );
  btn.setAttribute("aria-pressed", profile.favorite ? "true" : "false");
  btn.classList.toggle("is-favorite", profile.favorite);
  btn.title = profile.favorite ? "Unfavorite" : "Favorite";
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleProfileFavorite(profile.id);
  });
  return btn;
}
