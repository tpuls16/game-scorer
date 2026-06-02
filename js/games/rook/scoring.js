/**
 * Rook — Tolman Rules (rookgame.com/official-rules).
 * @see https://rookgame.com/official-rules/
 */

export const GAME_DISPLAY_NAME = "Rook";
export const RULES_NAME = "Tolman Rules";
export const RULES_URL = "https://rookgame.com/official-rules/";

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 4;
export const DEFAULT_TOTAL_HANDS = 8;
export const DEFAULT_TARGET_SCORE = 500;
export const ROOK_DECK_SIZE = 57;

export const MIN_BID = 50;
export const MAX_BID = 180;
export const DEFAULT_BID = 120;
export const BID_INCREMENT = 5;
export const COUNTERS_PER_HAND = 180;
export const SWEEP_BONUS = 20;
export const MAX_HAND_TOTAL_WITH_SWEEP = 200;

/** In each color suit, 1 beats 14 (rank 1-14-13-…-2). */
export const SUIT_RANK_ONE_FAMILY = 15;
export const SUIT_RANK_HIGH_STANDARD = 14;

export const CAPTURE_POINTS = {
  one: 15,
  fourteen: 10,
  ten: 10,
  five: 5,
  rook: 20,
};

/** Max counters in the full 57-card deck. */
export const COUNTER_LIMITS = {
  fives: 4,
  tens: 4,
  fourteens: 4,
  ones: 4,
  rook: 1,
};

/** @type {readonly string[]} */
export const RULE_SUMMARY_LINES = [
  "Tolman Rules — full 57-card deck, 5-card kitty.",
  "1 is high in each suit (above 14). Rook is the lowest trump in the trump color.",
  "Counters: 1 = 15, 14 = 10, 10 = 10, 5 = 5, Rook = 20 (180 per hand).",
  "Last trick wins the kitty. Take all 180 counters for a +20 sweep bonus (200 total).",
  "Bid in steps of 5 (50–180). Make bid or lose the bid; other team always keeps their counters.",
  "First team to 500 wins.",
];

/**
 * @typedef {{ fives: number, tens: number, fourteens: number, ones: number, rook: boolean }} TeamCaptureCounts
 * @typedef {{
 *   hand: number,
 *   bid: number,
 *   biddingTeam: 0 | 1,
 *   trickPoints: [number, number],
 *   kittyTeam: 0 | 1,
 *   kittyPoints: number,
 *   teamCardPoints: [number, number],
 *   teamScores: [number, number],
 *   madeBid: boolean,
 *   sweepTeam: 0 | 1 | null,
 * }} RookHandResult
 */

export function familyStyleSuitOrder(rank) {
  const r = Number(rank);
  if (r === 1) return SUIT_RANK_ONE_FAMILY;
  return r;
}

/** @param {TeamCaptureCounts} counts */
export function countCardPointsFromCaptures(counts) {
  const fives = Math.max(0, Number(counts.fives) || 0);
  const tens = Math.max(0, Number(counts.tens) || 0);
  const fourteens = Math.max(0, Number(counts.fourteens) || 0);
  const ones = Math.max(0, Number(counts.ones) || 0);
  const rook = counts.rook ? CAPTURE_POINTS.rook : 0;

  return (
    fives * CAPTURE_POINTS.five +
    tens * CAPTURE_POINTS.ten +
    fourteens * CAPTURE_POINTS.fourteen +
    ones * CAPTURE_POINTS.one +
    rook
  );
}

/** @param {TeamCaptureCounts} counts */
export function normalizeTeamCounts(counts) {
  return {
    fives: clampCount(counts?.fives, COUNTER_LIMITS.fives),
    tens: clampCount(counts?.tens, COUNTER_LIMITS.tens),
    fourteens: clampCount(counts?.fourteens, COUNTER_LIMITS.fourteens),
    ones: clampCount(counts?.ones, COUNTER_LIMITS.ones),
    rook: Boolean(counts?.rook),
  };
}

/** @param {unknown} value @param {number} max */
function clampCount(value, max) {
  return Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
}

/**
 * @param {number} playerIndex
 * @param {[number, number][]} teams
 * @returns {0 | 1}
 */
export function getTeamIndexForPlayer(playerIndex, teams) {
  const i = Math.floor(Number(playerIndex) || 0);
  return teams[0]?.includes(i) ? 0 : 1;
}

/** @param {unknown} value */
function clampTrickPoints(value) {
  return Math.max(0, Math.min(COUNTERS_PER_HAND, Math.round(Number(value) || 0)));
}

/** @param {unknown} value */
function clampKittyPoints(value) {
  return Math.max(0, Math.min(COUNTERS_PER_HAND, Math.round(Number(value) || 0)));
}

/**
 * @param {[number, number]} trickPoints
 * @param {number} kittyPoints
 */
export function sumHandCounters(trickPoints, kittyPoints) {
  return (
    clampTrickPoints(trickPoints[0]) +
    clampTrickPoints(trickPoints[1]) +
    clampKittyPoints(kittyPoints)
  );
}

/**
 * @param {[number, number]} trickPoints
 * @param {number} kittyPoints
 */
export function countersTotalIsValid(trickPoints, kittyPoints) {
  return sumHandCounters(trickPoints, kittyPoints) === COUNTERS_PER_HAND;
}

/**
 * @param {[number, number]} trickPoints
 * @param {number} kittyPoints
 * @param {0 | 1} biddingTeam
 * @param {0 | 1 | null} kittyTeam
 */
export function handScoringIsReady(trickPoints, kittyPoints, biddingTeam, kittyTeam) {
  if (!countersTotalIsValid(trickPoints, kittyPoints)) return false;
  if (clampKittyPoints(kittyPoints) > 0 && kittyTeam !== 0 && kittyTeam !== 1) return false;
  return biddingTeam === 0 || biddingTeam === 1;
}

/**
 * @param {[number, number]} trickPoints
 * @param {number} kittyPoints
 */
export function describeCountersTotal(trickPoints, kittyPoints) {
  const total = sumHandCounters(trickPoints, kittyPoints);
  const diff = COUNTERS_PER_HAND - total;
  if (diff === 0) {
    return { valid: true, total, text: `Counters: ${total} / ${COUNTERS_PER_HAND} — ready to score` };
  }
  if (diff > 0) {
    return { valid: false, total, text: `Counters: ${total} / ${COUNTERS_PER_HAND} — need ${diff} more` };
  }
  return { valid: false, total, text: `Counters: ${total} / ${COUNTERS_PER_HAND} — ${-diff} too many` };
}

/**
 * @param {{
 *   bid: number,
 *   biddingTeam: 0 | 1,
 *   trickPoints: [number, number],
 *   kittyTeam?: 0 | 1,
 *   kittyPoints?: number,
 * }} input
 */
export function calculateHandScore(input) {
  const rawBid = Math.round(Number(input.bid) || DEFAULT_BID);
  const bid = Math.max(MIN_BID, Math.min(MAX_BID, rawBid));
  const biddingTeam = input.biddingTeam === 1 ? 1 : 0;
  const kittyTeam = input.kittyTeam === 1 ? 1 : 0;
  const kittyPoints = clampKittyPoints(input.kittyPoints);

  const trickPoints = /** @type {[number, number]} */ ([
    clampTrickPoints(input.trickPoints[0]),
    clampTrickPoints(input.trickPoints[1]),
  ]);

  let sweepTeam = null;
  if (trickPoints[0] === COUNTERS_PER_HAND && trickPoints[1] === 0) sweepTeam = 0;
  if (trickPoints[1] === COUNTERS_PER_HAND && trickPoints[0] === 0) sweepTeam = 1;

  const teamCardPoints = /** @type {[number, number]} */ ([...trickPoints]);
  teamCardPoints[kittyTeam] += kittyPoints;
  if (sweepTeam !== null) {
    teamCardPoints[sweepTeam] += SWEEP_BONUS;
  }

  const madeBid = teamCardPoints[biddingTeam] >= bid;
  const teamScores = [0, 0];

  if (madeBid) {
    teamScores[0] = teamCardPoints[0];
    teamScores[1] = teamCardPoints[1];
  } else {
    teamScores[biddingTeam] = -bid;
    teamScores[1 - biddingTeam] = teamCardPoints[1 - biddingTeam];
  }

  return {
    trickPoints,
    kittyTeam,
    kittyPoints,
    sweepTeam,
    teamCardPoints,
    teamScores,
    madeBid,
    breakdown: formatHandBreakdown({
      bid,
      biddingTeam,
      trickPoints,
      kittyTeam,
      kittyPoints,
      sweepTeam,
      teamCardPoints,
      teamScores,
      madeBid,
    }),
  };
}

/**
 * @param {{
 *   bid: number,
 *   biddingTeam: 0 | 1,
 *   trickPoints: [number, number],
 *   kittyTeam: 0 | 1,
 *   kittyPoints: number,
 *   sweepTeam: 0 | 1 | null,
 *   teamCardPoints: [number, number],
 *   teamScores: [number, number],
 *   madeBid: boolean,
 * }} data
 */
export function formatHandBreakdown(data) {
  const bidderLabel = data.biddingTeam === 0 ? "Team 1" : "Team 2";
  const kittyLabel = data.kittyTeam === 0 ? "Team 1" : "Team 2";
  const lines = [
    `Bid: ${data.bid} (${bidderLabel})`,
    `Tricks — Team 1: ${data.trickPoints[0]}, Team 2: ${data.trickPoints[1]}`,
  ];
  if (data.kittyPoints > 0) {
    lines.push(`Kitty (${kittyLabel}): +${data.kittyPoints}`);
  }
  if (data.sweepTeam !== null) {
    const sweepLabel = data.sweepTeam === 0 ? "Team 1" : "Team 2";
    lines.push(`Sweep — ${sweepLabel}: +${SWEEP_BONUS} (all ${COUNTERS_PER_HAND} counters)`);
  }
  lines.push(`Hand totals — Team 1: ${data.teamCardPoints[0]}, Team 2: ${data.teamCardPoints[1]}`);
  if (data.madeBid) {
    lines.push("Bid made — both teams score their hand totals.");
  } else {
    lines.push(`Set — ${bidderLabel} loses ${data.bid} (no counter points); other team keeps theirs.`);
  }
  lines.push(`Scoreboard — Team 1: ${formatScore(data.teamScores[0])}, Team 2: ${formatScore(data.teamScores[1])}`);
  return lines;
}

/** @param {number} score */
export function formatScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return "0";
  return n > 0 ? `+${n}` : String(n);
}

/** @param {{ rounds?: RookHandResult[], targetScore?: number }} game */
export function getTeamTotals(game) {
  const totals = [0, 0];
  for (const round of game.rounds ?? []) {
    totals[0] += round.teamScores?.[0] ?? 0;
    totals[1] += round.teamScores?.[1] ?? 0;
  }
  return totals;
}

/** @param {{ rounds?: RookHandResult[], targetScore?: number }} game */
export function hasReachedTarget(game) {
  const target = game.targetScore ?? DEFAULT_TARGET_SCORE;
  const totals = getTeamTotals(game);
  return totals.some((t) => t >= target);
}

/** @param {string[]} playerNames @param {[number, number][]} teamPlayerIndices */
export function buildTeamLabels(playerNames, teamPlayerIndices) {
  return teamPlayerIndices.map((indices) =>
    indices.map((i) => playerNames[i]).filter(Boolean).join(" & ")
  );
}

export function emptyTeamCounts() {
  return { fives: 0, tens: 0, fourteens: 0, ones: 0, rook: false };
}
