export interface RankScoreInput {
  offense: number;
  defense: number;
  /** gold + bank + armory resale value + battle upgrade resale value */
  netWorth: number;
}

/**
 * Overall power score — combat + economy.
 *
 * Combat (~85%):
 *   - Offense & defense are the direct measures of PvP power
 *   - Spy/sentry excluded (support stats, not core combat strength)
 *
 * Economy (~15%):
 *   - Net worth = gold + bank + armory resale + battle upgrade resale (all at 75% sell value)
 *   - Logarithmic scaling to prevent pure gold hoarding from dominating
 *   - Rewards well-rounded economic players
 *
 * Removed:
 *   - Fort level (infrastructure, not combat power)
 *   - XP (time played ≠ strength)
 *   - Spy/sentry (support stats)
 */
export function calculateRankScore(input: RankScoreInput): number {
  // ── Combat (raw stat values already include units + items + upgrades + bonuses)
  const combatScore = input.offense * 1.0 + input.defense * 1.0;

  // ── Economy (logarithmic — diminishing returns, doubled weight from old formula)
  const econBonus = input.netWorth > 0 ? Math.log10(input.netWorth + 1) * 1000 : 0;

  return Math.round(combatScore + econBonus);
}
