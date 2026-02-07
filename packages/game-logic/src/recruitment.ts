/** Base citizens awarded when someone uses your recruit link */
export const RECRUIT_LINK_CITIZENS_BONUS = 5;

/** Cooldown in hours between recruit link claims from the same IP */
export const RECRUIT_LINK_IP_COOLDOWN_HOURS = 24;

/** Maximum recruit claims per referrer per day */
export const RECRUIT_LINK_MAX_PER_DAY = 10;

/**
 * Calculate daily auto-recruit citizens based on house level and recruiting bonus.
 * @param citizensDaily - base citizens from HouseUpgrade definition
 * @param recruitingBonusLevel - player's RECRUITING bonus point level (percentage boost)
 * @returns total citizens to award
 */
export function calculateAutoRecruitCitizens(
  citizensDaily: number,
  recruitingBonusLevel: number,
): number {
  const bonus = Math.round((recruitingBonusLevel / 100) * citizensDaily);
  return citizensDaily + bonus;
}

/**
 * Calculate citizens awarded from a recruit link visit.
 * @param baseCitizens - RECRUIT_LINK_CITIZENS_BONUS
 * @param recruitingBonusLevel - player's RECRUITING bonus point level (percentage boost)
 * @returns total citizens to award to the referrer
 */
export function calculateRecruitLinkBonus(
  baseCitizens: number,
  recruitingBonusLevel: number,
): number {
  const bonus = Math.round((recruitingBonusLevel / 100) * baseCitizens);
  return baseCitizens + bonus;
}
