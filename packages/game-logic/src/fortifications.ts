import type { FortificationDefinition } from '@openthrone/shared';

export const Fortifications: FortificationDefinition[] = [
  { name: 'Encampment', level: 0, levelRequirement: 0, hitpoints: 50, costPerRepairPoint: 5, goldPerTurn: 0, defenseBonusPercentage: 0, cost: 0 },
  { name: 'Wooden Palisade', level: 1, levelRequirement: 10, hitpoints: 1000, costPerRepairPoint: 50, goldPerTurn: 0, defenseBonusPercentage: 0, cost: 500000 },
  { name: 'Fortified Outpost', level: 2, levelRequirement: 20, hitpoints: 3000, costPerRepairPoint: 150, goldPerTurn: 0, defenseBonusPercentage: 0, cost: 3000000 },
  { name: 'Fortified Stronghold', level: 3, levelRequirement: 40, hitpoints: 6000, costPerRepairPoint: 300, goldPerTurn: 0, defenseBonusPercentage: 0, cost: 80000000 },
  { name: 'Fortified Fortress', level: 4, levelRequirement: 60, hitpoints: 10000, costPerRepairPoint: 500, goldPerTurn: 0, defenseBonusPercentage: 0, cost: 500000000 },
  { name: 'Citadel', level: 5, levelRequirement: 80, hitpoints: 15000, costPerRepairPoint: 750, goldPerTurn: 0, defenseBonusPercentage: 0, cost: 1000000000 },
];

/**
 * Returns the fortification definition for the given level.
 */
export function getFortificationByLevel(
  level: number,
): FortificationDefinition | undefined {
  return Fortifications.find((f) => f.level === level);
}

/**
 * Returns the next fortification after the given level, or undefined if at max.
 */
export function getNextFortification(
  currentLevel: number,
): FortificationDefinition | undefined {
  return Fortifications.find((f) => f.level === currentLevel + 1);
}
