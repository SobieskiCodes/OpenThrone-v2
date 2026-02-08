import { getFortificationByLevel } from './fortifications';
import { getEconomyUpgradeByLevel } from './structure-upgrades';

/**
 * Calculate gold earned per turn tick for a player.
 * @param fortLevel - player's fortification level
 * @param economyLevel - player's economy upgrade level (1-based)
 * @param workerCount - total workers across all levels
 * @param incomeBonusLevel - player's INCOME bonus point level (percentage boost)
 * @returns total gold to award this turn
 */
export function calculateGoldPerTurn(
  fortLevel: number,
  economyLevel: number,
  workerCount: number,
  incomeBonusLevel: number,
): number {
  const fort = getFortificationByLevel(fortLevel);
  const eco = getEconomyUpgradeByLevel(economyLevel);

  const goldPerTurn = fort?.goldPerTurn ?? 1000;
  const goldPerWorker = eco?.goldPerWorker ?? 50;

  const base = goldPerTurn + workerCount * goldPerWorker;
  const bonus = Math.round((incomeBonusLevel / 100) * base);
  return base + bonus;
}
