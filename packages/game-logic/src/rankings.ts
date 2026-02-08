export interface RankScoreInput {
  offense: number;
  defense: number;
  spy: number;
  sentry: number;
  fortLevel: number;
  experience: number;
  /** gold + bank + armory value */
  netWorth: number;
}

/**
 * Overall power score — composite of combat, progression, and economy.
 *
 * Combat is the backbone (~70%):
 *   - Offense & defense carry the most weight (direct PvP stats)
 *   - Spy & sentry are scaled up since their raw numbers are lower
 *
 * Progression (~20%):
 *   - Fort level grants a meaningful chunk (higher forts unlock everything)
 *   - XP/level as a small additional factor
 *
 * Economy (~10%):
 *   - Net worth (gold + bank + armory) adds a resource component
 *   - Logarithmic so hoarding gold alone doesn't dominate
 */
export function calculateRankScore(input: RankScoreInput): number {
  // ── Combat (raw stat values already include units + items + upgrades + bonuses)
  const combatScore =
    input.offense * 1.0 +
    input.defense * 1.0 +
    input.spy * 1.25 +
    input.sentry * 1.25;

  // ── Progression
  //    Fort level is exponentially valuable (unlocks units, upgrades, everything)
  const fortBonus = Math.pow(input.fortLevel, 1.5) * 200;
  //    XP gives a gentle nudge — veteran players rank slightly higher at equal combat
  const xpBonus = Math.sqrt(input.experience) * 2;

  // ── Economy (logarithmic — diminishing returns on pure gold hoarding)
  const econBonus = input.netWorth > 0 ? Math.log10(input.netWorth + 1) * 500 : 0;

  return Math.round(combatScore + fortBonus + xpBonus + econBonus);
}
