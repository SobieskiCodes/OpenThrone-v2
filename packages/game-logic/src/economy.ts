import { UnitType } from '@openthrone/shared';
import { getFortificationByLevel } from './fortifications';
import { UnitTypes } from './units';

interface WorkerEntry {
  level: number;
  quantity: number;
}

/**
 * Calculate gold earned per turn tick for a player.
 * Each worker tier has its own gold rate from the unit definition's bonus field.
 * @param fortLevel - player's fortification level
 * @param workers - array of worker entries with level and quantity
 * @param incomeBonusLevel - player's INCOME bonus point level (percentage boost)
 * @returns total gold to award this turn
 */
export function calculateGoldPerTurn(
  fortLevel: number,
  workers: WorkerEntry[],
  incomeBonusLevel: number,
): number {
  const fort = getFortificationByLevel(fortLevel);
  const goldPerTurn = fort?.goldPerTurn ?? 1000;

  let workerGold = 0;
  for (const w of workers) {
    const def = UnitTypes.find(
      (u) => u.type === UnitType.WORKER && u.level === w.level,
    );
    workerGold += (def?.bonus ?? 50) * w.quantity;
  }

  const base = goldPerTurn + workerGold;
  const bonus = Math.round((incomeBonusLevel / 100) * base);
  return base + bonus;
}
