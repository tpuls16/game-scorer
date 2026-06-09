/** Official Flip 7 scoring order: sum numbers → ×2 → add +modifiers → Flip 7 bonus */

export const DEFAULT_TARGET_SCORE = 200;
export const DEFAULT_FLIP7_BONUS = 15;
/** Round total when a player busts (0 = official rules; negative = house penalty). */
export const DEFAULT_BUST_POINTS = 0;
export const MIN_BUST_POINTS = -100;
export const MAX_BUST_POINTS = 0;
/** Max points lost on bust (positive number shown in setup UI). */
export const MAX_BUST_PENALTY = 100;

export function clampBustPoints(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return DEFAULT_BUST_POINTS;
  if (n > 0) return 0;
  return Math.max(MIN_BUST_POINTS, Math.min(MAX_BUST_POINTS, Math.round(n)));
}

/** Points lost on bust for display in inputs (0–100). */
export function bustPenaltyFromPoints(bustPoints = DEFAULT_BUST_POINTS) {
  const stored = clampBustPoints(bustPoints);
  return stored >= 0 ? 0 : -stored;
}

/** Convert a positive “points lost” value from the UI into stored bust round score. */
export function bustPointsFromPenalty(penalty) {
  const n = Number(penalty);
  if (Number.isNaN(n) || n <= 0) return DEFAULT_BUST_POINTS;
  return -Math.min(MAX_BUST_PENALTY, Math.round(n));
}

export function parseBustPenaltyInput(value) {
  return bustPointsFromPenalty(Math.abs(Number(value)));
}

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 18;
export const FLIP7_REQUIRED_NUMBER_CARDS = 7;

/** Number cards in the deck (each value can appear at most once per player per round). */
export const NUMBER_CARD_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Score modifier cards in the official deck (one of each). */
export const PLUS_MODIFIER_CARD_VALUES = [2, 4, 6, 8, 10];

export function sumNumberCards(numberCards = []) {
  return numberCards.reduce((sum, value) => sum + value, 0);
}

export function sumPlusModifiers(plusModifiers = []) {
  return plusModifiers.reduce((sum, value) => sum + value, 0);
}

/**
 * Normalize stored or legacy round fields before scoring.
 * @param {Record<string, unknown>} roundData
 */
export function normalizeRoundInput(roundData = {}) {
  const busted = Boolean(roundData.busted);
  let numberCards = Array.isArray(roundData.numberCards)
    ? [...roundData.numberCards].map(Number).filter((n) => !Number.isNaN(n))
    : [];

  if (numberCards.length === 0 && roundData.numberSum != null && roundData.numberSum > 0) {
    return {
      busted,
      numberCards: [],
      numberSum: Math.max(0, Number(roundData.numberSum) || 0),
      x2: Boolean(roundData.x2),
      plusModifiers: legacyPlusModifiers(roundData),
      flip7: Boolean(roundData.flip7),
      legacyNumberSumOnly: true,
    };
  }

  numberCards = [...new Set(numberCards)].sort((a, b) => a - b);
  if (numberCards.length > FLIP7_REQUIRED_NUMBER_CARDS) {
    numberCards = numberCards.slice(0, FLIP7_REQUIRED_NUMBER_CARDS);
  }

  const plusModifiers = Array.isArray(roundData.plusModifiers)
    ? [...roundData.plusModifiers].map(Number).filter((n) => !Number.isNaN(n))
    : legacyPlusModifiers(roundData);

  const numberSum = sumNumberCards(numberCards);
  const flip7 =
    !busted &&
    (Boolean(roundData.flip7) ||
      numberCards.length >= FLIP7_REQUIRED_NUMBER_CARDS);

  return {
    busted,
    numberCards,
    numberSum,
    x2: Boolean(roundData.x2),
    plusModifiers,
    flip7,
    legacyNumberSumOnly: false,
  };
}

function legacyPlusModifiers(roundData) {
  const mods = [];
  const single = Number(roundData.plusModifier) || 0;
  const extra = Number(roundData.extraPlus) || 0;
  if (single > 0) mods.push(single);
  if (extra > 0) mods.push(extra);
  return mods;
}

/**
 * @param {{
 *   busted?: boolean,
 *   numberCards?: number[],
 *   numberSum?: number,
 *   x2?: boolean,
 *   plusModifiers?: number[],
 *   plusModifier?: number,
 *   extraPlus?: number,
 *   flip7?: boolean,
 *   flip7BonusPoints?: number,
 *   bustPoints?: number,
 * }} input
 */
export function calculateFlip7RoundScore(input = {}) {
  const normalized = normalizeRoundInput(input);
  const { flip7BonusPoints = DEFAULT_FLIP7_BONUS, bustPoints = DEFAULT_BUST_POINTS } = input;
  const bustTotal = clampBustPoints(bustPoints);

  if (normalized.busted) {
    return {
      busted: true,
      flip7: false,
      numberCards: [],
      numberSum: 0,
      multiplied: 0,
      plusModifiers: [],
      plusModifier: 0,
      extraPlus: 0,
      flip7Bonus: 0,
      total: bustTotal,
    };
  }

  const { numberCards, numberSum, x2, plusModifiers, flip7 } = normalized;
  const multiplied = x2 ? numberSum * 2 : numberSum;
  const plusTotal = sumPlusModifiers(plusModifiers);
  const flip7Bonus = flip7 ? flip7BonusPoints : 0;
  const total = multiplied + plusTotal + flip7Bonus;

  return {
    busted: false,
    flip7,
    numberCards,
    numberSum,
    multiplied,
    plusModifiers,
    plusModifier: plusTotal,
    extraPlus: 0,
    x2,
    flip7Bonus,
    total,
  };
}

export function formatScore(score) {
  if (score > 0) return `+${score}`;
  return String(score);
}

export function formatBustRoundLabel(bustPoints = DEFAULT_BUST_POINTS) {
  const penalty = bustPenaltyFromPoints(bustPoints);
  if (penalty === 0) return "Bust (0 pts)";
  return `Bust (−${penalty} pts)`;
}

export function getTotalScore(rounds) {
  const sum = rounds.reduce((acc, round) => acc + (round.total ?? 0), 0);
  return Math.max(0, sum);
}

export function formatRoundBreakdown(
  roundData,
  { flip7BonusPoints = DEFAULT_FLIP7_BONUS, bustPoints = DEFAULT_BUST_POINTS } = {}
) {
  if (roundData.busted) {
    const total = roundData.total ?? clampBustPoints(bustPoints);
    return [`Busted — ${formatScore(total)} for this round.`];
  }

  const lines = [];
  const cards = roundData.numberCards ?? [];

  if (cards.length > 0) {
    const sum = roundData.numberSum ?? sumNumberCards(cards);
    lines.push(`Number cards: ${cards.join(", ")} (= ${sum})`);
  } else if (roundData.numberSum != null) {
    lines.push(`Number cards: ${roundData.numberSum}`);
  }

  if (roundData.multiplied !== roundData.numberSum) {
    lines.push(`After ×2: ${roundData.multiplied}`);
  }

  const plusMods = roundData.plusModifiers?.length
    ? roundData.plusModifiers
    : legacyPlusModifiers(roundData);

  if (plusMods.length > 0) {
    const plusTotal = sumPlusModifiers(plusMods);
    const detail = plusMods.map((v) => `+${v}`).join(", ");
    lines.push(`Modifiers: ${detail} (${formatScore(plusTotal)})`);
  } else {
    const plusTotal = (roundData.plusModifier ?? 0) + (roundData.extraPlus ?? 0);
    if (plusTotal > 0) {
      lines.push(`+ modifiers: ${formatScore(plusTotal)}`);
    }
  }

  if (roundData.flip7) {
    lines.push(`Flip 7 bonus: ${formatScore(roundData.flip7Bonus ?? flip7BonusPoints)}`);
  }

  return lines;
}

export function hasReachedTarget(total, targetScore = DEFAULT_TARGET_SCORE) {
  return total >= targetScore;
}
