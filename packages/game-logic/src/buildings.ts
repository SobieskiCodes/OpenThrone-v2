import { BuildingType } from '@openthrone/shared';
import type { BuildingDefinition, BuildingLevelDefinition, BuildingRequirement } from '@openthrone/shared';

// ─── Building Definitions ────────────────────────────────────────────────

export const Buildings: BuildingDefinition[] = [
  {
    type: BuildingType.FORTIFICATION,
    description: 'Protects your kingdom with fortified walls. Gates military unit tiers.',
    levels: [
      { level: 1, name: 'Wooden Palisade', cost: 500000, playerLevelRequirement: 10, fortHitpoints: 1000 },
      { level: 2, name: 'Fortified Outpost', cost: 3000000, playerLevelRequirement: 20, fortHitpoints: 3000 },
      { level: 3, name: 'Fortified Stronghold', cost: 80000000, playerLevelRequirement: 40, fortHitpoints: 6000 },
      { level: 4, name: 'Fortified Fortress', cost: 500000000, playerLevelRequirement: 60, fortHitpoints: 10000 },
      { level: 5, name: 'Citadel', cost: 1000000000, playerLevelRequirement: 80, fortHitpoints: 15000 },
    ],
  },
  {
    type: BuildingType.ARMORY,
    description: 'Unlocks higher-tier weapons and armor for your troops.',
    levels: [
      { level: 1, name: 'Chainmail Armory I', cost: 750000, playerLevelRequirement: 10 },
      { level: 2, name: 'Chainmail Armory II', cost: 7000000, playerLevelRequirement: 30 },
      { level: 3, name: 'Chainmail Armory III', cost: 35000000, playerLevelRequirement: 50 },
      { level: 4, name: 'Plate Armory I', cost: 650000000, playerLevelRequirement: 70 },
      { level: 5, name: 'Plate Armory II', cost: 2000000000, playerLevelRequirement: 90 },
    ],
  },
  {
    type: BuildingType.MINE,
    description: 'Boosts gold income from workers and unlocks higher-tier miners.',
    levels: [
      { level: 1, name: 'Basic Mine', cost: 150000, playerLevelRequirement: 3, incomeBonusPercent: 10 },
      { level: 2, name: 'Improved Mine', cost: 3500000, playerLevelRequirement: 12, incomeBonusPercent: 20 },
      { level: 3, name: 'Advanced Mine', cost: 60000000, playerLevelRequirement: 24, incomeBonusPercent: 30 },
      { level: 4, name: 'Deep Mine', cost: 800000000, playerLevelRequirement: 36, incomeBonusPercent: 40 },
      { level: 5, name: 'Mithril Mine', cost: 2000000000, playerLevelRequirement: 48, incomeBonusPercent: 50 },
    ],
  },
  {
    type: BuildingType.SPY_ACADEMY,
    description: 'Trains elite spies and sentries. Boosts spy offense.',
    levels: [
      { level: 1, name: 'Spy School', cost: 250000, playerLevelRequirement: 5, spyOffenseBonus: 5 },
      { level: 2, name: 'Spy Academy', cost: 4000000, playerLevelRequirement: 15, spyOffenseBonus: 10 },
      { level: 3, name: 'Intelligence Bureau', cost: 70000000, playerLevelRequirement: 30, spyOffenseBonus: 15 },
      { level: 4, name: 'Secret Service HQ', cost: 250000000, playerLevelRequirement: 45, spyOffenseBonus: 20 },
      { level: 5, name: 'Shadow Council', cost: 4500000000, playerLevelRequirement: 60, spyOffenseBonus: 25 },
    ],
  },
  {
    type: BuildingType.HOUSING,
    description: 'Generates citizens daily to grow your population.',
    levels: [
      { level: 1, name: 'Huts', cost: 100000, playerLevelRequirement: 3, citizensPerDay: 10 },
      { level: 2, name: 'Cottages', cost: 3000000, playerLevelRequirement: 13, citizensPerDay: 20 },
      { level: 3, name: 'Houses', cost: 75000000, playerLevelRequirement: 33, citizensPerDay: 30 },
      { level: 4, name: 'Estates', cost: 550000000, playerLevelRequirement: 63, citizensPerDay: 40 },
      { level: 5, name: 'Mansions', cost: 1750000000, playerLevelRequirement: 93, citizensPerDay: 50 },
    ],
  },
  {
    type: BuildingType.MERCENARY_CAMP,
    description: 'Hire mercenaries daily to bolster your forces.',
    levels: [
      { level: 1, name: 'Mercenary Camp I', cost: 200000, playerLevelRequirement: 7, dailyMercStock: 20 },
      { level: 2, name: 'Mercenary Camp II', cost: 4500000, playerLevelRequirement: 14, dailyMercStock: 30 },
      { level: 3, name: 'Mercenary Camp III', cost: 55000000, playerLevelRequirement: 21, dailyMercStock: 40 },
    ],
  },
];

// ─── Helper Functions ────────────────────────────────────────────────

export function getBuildingDefinition(type: BuildingType): BuildingDefinition | undefined {
  return Buildings.find((b) => b.type === type);
}

export function getBuildingLevel(type: BuildingType, level: number): BuildingLevelDefinition | undefined {
  const building = getBuildingDefinition(type);
  return building?.levels.find((l) => l.level === level);
}

export function getNextBuildingLevel(type: BuildingType, currentLevel: number): BuildingLevelDefinition | undefined {
  const building = getBuildingDefinition(type);
  return building?.levels.find((l) => l.level === currentLevel + 1);
}

export function getMaxBuildingLevel(type: BuildingType): number {
  const building = getBuildingDefinition(type);
  return building?.levels.length ?? 0;
}

export function canUpgradeBuilding(
  type: BuildingType,
  currentLevel: number,
  playerLevel: number,
  gold: bigint,
): { canUpgrade: boolean; reason?: string } {
  const nextLevel = getNextBuildingLevel(type, currentLevel);
  if (!nextLevel) {
    return { canUpgrade: false, reason: 'Already at maximum level' };
  }
  if (playerLevel < nextLevel.playerLevelRequirement) {
    return {
      canUpgrade: false,
      reason: `Requires player level ${nextLevel.playerLevelRequirement} (you are level ${playerLevel})`,
    };
  }
  if (gold < BigInt(nextLevel.cost)) {
    return {
      canUpgrade: false,
      reason: `Not enough gold. Required: ${nextLevel.cost}`,
    };
  }
  return { canUpgrade: true };
}

/**
 * Check if a player meets all building requirements for a unit or item.
 */
export function meetsBuildingRequirements(
  requirements: BuildingRequirement[],
  playerBuildings: Map<string, number>,
): { met: boolean; unmet: BuildingRequirement[] } {
  const unmet: BuildingRequirement[] = [];
  for (const req of requirements) {
    const playerLevel = playerBuildings.get(req.buildingType) ?? 0;
    if (playerLevel < req.level) {
      unmet.push(req);
    }
  }
  return { met: unmet.length === 0, unmet };
}

/**
 * Returns building level unlocks that became newly available
 * when a player levels from oldLevel to newLevel.
 */
export function getBuildingUnlocksForLevelRange(
  oldLevel: number,
  newLevel: number,
): { buildingType: BuildingType; level: number; name: string }[] {
  const unlocks: { buildingType: BuildingType; level: number; name: string }[] = [];
  for (const building of Buildings) {
    for (const lvl of building.levels) {
      if (lvl.playerLevelRequirement > oldLevel && lvl.playerLevelRequirement <= newLevel) {
        unlocks.push({
          buildingType: building.type,
          level: lvl.level,
          name: lvl.name,
        });
      }
    }
  }
  return unlocks;
}

// ─── Mercenary helpers (moved from structure-upgrades.ts) ────────────

export const MERCENARY_PRICE_MULTIPLIER = 1.5;

/**
 * Distributes daily stock across unit types: 30% offense, 30% defense, 20% spy, 20% sentry.
 */
export function getMercenaryStockDistribution(
  dailyStock: number,
): { OFFENSE: number; DEFENSE: number; SPY: number; SENTRY: number } {
  if (dailyStock <= 0) return { OFFENSE: 0, DEFENSE: 0, SPY: 0, SENTRY: 0 };

  const offense = Math.round(dailyStock * 0.3);
  const defense = Math.round(dailyStock * 0.3);
  const spy = Math.round(dailyStock * 0.2);
  const sentry = dailyStock - offense - defense - spy;

  return { OFFENSE: offense, DEFENSE: defense, SPY: spy, SENTRY: sentry };
}
