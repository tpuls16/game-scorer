/**
 * Playable cards in the deck available for dealing each round.
 *
 * Base game (Simplified Rulebook): remove blanks, Loot, Kraken, and White Whale.
 * - Suited: 4 suits × 14 = 56 (Parrot/green, Pirate Map/purple, Treasure Chest/yellow, Jolly Roger/black)
 * - Special: 5 Pirates, 1 Tigress, 1 Skull King, 2 Mermaids, 5 Escapes = 14
 * - Total: 70
 *
 * Expansion pack adds 19 playable cards on top of the base deck.
 */
export const BASE_DECK_SIZE = 70;
export const EXPANSION_EXTRA_CARDS = 19;
export const EXPANSION_DECK_SIZE = BASE_DECK_SIZE + EXPANSION_EXTRA_CARDS;

export const MAX_PLAYERS = 10;
export const DEFAULT_TOTAL_ROUNDS = 10;
export const DEFAULT_STARTING_CARDS = 1;
export const DEFAULT_CARD_INCREMENT = 1;

export function getDeckSize(useExpansion = false) {
  return useExpansion ? EXPANSION_DECK_SIZE : BASE_DECK_SIZE;
}

export function getMaxCardsPerRound(numPlayers, useExpansion = false) {
  if (numPlayers < 1) return 0;
  return Math.floor(getDeckSize(useExpansion) / numPlayers);
}

export function buildDefaultCardsPerRound({
  totalRounds = DEFAULT_TOTAL_ROUNDS,
  startingCards = DEFAULT_STARTING_CARDS,
  cardIncrement = DEFAULT_CARD_INCREMENT,
  numPlayers = 2,
  useExpansion = false,
}) {
  const maxCards = getMaxCardsPerRound(numPlayers, useExpansion);

  return Array.from({ length: totalRounds }, (_, index) => {
    const desired = startingCards + index * cardIncrement;
    return clampCardsForRound(desired, maxCards);
  });
}

export function clampCardsForRound(cards, maxCards) {
  if (maxCards < 1) return 1;
  return Math.min(Math.max(cards, 1), maxCards);
}

export function applyDeckCap(cardsPerRound, numPlayers, useExpansion = false) {
  const maxCards = getMaxCardsPerRound(numPlayers, useExpansion);
  return cardsPerRound.map((cards) => clampCardsForRound(cards, maxCards));
}
