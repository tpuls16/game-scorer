/**
 * Skull King scoring rules (base game + optional expansion pack).
 * Base rules per the Simplified Rulebook: bonuses and bid points only apply
 * when the player makes their exact bid. Zero bids use cards dealt that round.
 */

export const BASE_BONUS_FIELDS = [
  {
    key: "standard14",
    inputId: "std14",
    label: "14s (Parrot / Pirate Map / Treasure Chest)",
    points: 10,
    max: 3,
  },
  {
    key: "black14",
    inputId: "black14",
    label: "14 trump (Jolly Roger)",
    points: 20,
    max: 1,
  },
  {
    key: "mermaidByPirate",
    inputId: "mermaid",
    label: "Mermaid captured by Pirate",
    points: 20,
    max: 2,
  },
  {
    key: "pirateBySkullKing",
    inputId: "pirate",
    label: "Pirate captured by Skull King",
    points: 30,
    max: 5,
  },
  {
    key: "skullKingByMermaid",
    inputId: "skmermaid",
    label: "Skull King captured by Mermaid",
    points: 40,
    max: 1,
  },
];

export const EXPANSION_BONUS_FIELDS = [
  { key: "expansion8", inputId: "exp8", label: "Expansion 8 captured", points: 5, max: 4 },
  { key: "expansion7", inputId: "exp7", label: "Expansion 7 captured", points: -5, max: 4 },
  {
    key: "firstMateConCaptured",
    inputId: "fmc",
    label: "First Mate Con → Skull King or Mermaid",
    points: 30,
    max: 1,
  },
  {
    key: "davyJonesSeaMonsters",
    inputId: "davy",
    label: "Sea monsters via Davy Jones' Locker",
    points: 20,
    max: 3,
  },
];

export function getBonusFields(useExpansion = false) {
  return useExpansion
    ? [...BASE_BONUS_FIELDS, ...EXPANSION_BONUS_FIELDS]
    : BASE_BONUS_FIELDS;
}

export function emptyBonuses(useExpansion = false) {
  return Object.fromEntries(
    getBonusFields(useExpansion).map(({ key }) => [key, 0])
  );
}

export function calculateRoundScore(round, bid, tricks, bonuses = {}, options = {}) {
  const { useExpansion = false, cardsDealt = round } = options;
  const fields = getBonusFields(useExpansion);

  const diff = Math.abs(bid - tricks);
  const madeBid = diff === 0;

  let baseScore = 0;

  if (bid === 0) {
    baseScore = tricks === 0 ? 10 * cardsDealt : -10 * cardsDealt;
  } else if (madeBid) {
    baseScore = 20 * tricks;
  } else {
    baseScore = -10 * diff;
  }

  let bonusScore = 0;
  if (madeBid) {
    for (const { key, points } of fields) {
      bonusScore += (bonuses[key] ?? 0) * points;
    }
  }

  return {
    baseScore,
    bonusScore,
    total: baseScore + bonusScore,
    madeBid,
  };
}

export function formatScore(score) {
  if (score > 0) return `+${score}`;
  return String(score);
}

export function formatBonusLine({ label, points }, count) {
  const total = count * points;
  const sign = total > 0 ? "+" : "";
  return `${label}: ${count} × ${formatScore(points)} = ${sign}${total}`;
}

export function getTotalScore(rounds) {
  return rounds.reduce((sum, round) => sum + (round.total ?? 0), 0);
}
