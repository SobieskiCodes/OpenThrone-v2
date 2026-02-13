import { UnitType } from '@openthrone/shared';
import { UnitTypes } from './units';

interface WorkerEntry {
  level: number;
  quantity: number;
}

/**
 * Calculate gold earned per turn tick for a player.
 * Each worker tier has its own gold rate from the unit definition's bonus field.
 * Mine building provides a percentage bonus on worker income.
 * @param workers - array of worker entries with level and quantity
 * @param mineBonusPercent - mine building income bonus (0-50)
 * @param proficiencyPercent - player's INCOME bonus point level (percentage boost)
 * @returns total gold to award this turn
 */
export function calculateGoldPerTurn(
  workers: WorkerEntry[],
  mineBonusPercent: number,
  proficiencyPercent: number,
): number {
  const BASE_INCOME = 1000; // base gold per turn even with no workers
  let workerGold = 0;
  for (const w of workers) {
    const def = UnitTypes.find(
      (u) => u.type === UnitType.WORKER && u.level === w.level,
    );
    workerGold += (def?.bonus ?? 50) * w.quantity;
  }

  const totalBonusPercent = mineBonusPercent + proficiencyPercent;
  const bonus = Math.round((totalBonusPercent / 100) * workerGold);
  return BASE_INCOME + workerGold + bonus;
}
