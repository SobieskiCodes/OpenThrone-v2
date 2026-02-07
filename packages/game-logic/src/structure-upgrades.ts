import type {
  EconomyUpgradeDefinition,
  OffensiveUpgradeDefinition,
  SpyUpgradeDefinition,
  SentryUpgradeDefinition,
  ArmoryUpgradeDefinition,
  HouseUpgradeDefinition,
} from '@openthrone/shared';

// ─── Economy Upgrades ─────────────────────────────────────────────────

export const EconomyUpgrades: EconomyUpgradeDefinition[] = [
  { name: 'Farm', fortLevel: 0, goldPerWorker: 50, depositsPerDay: 3, goldTransferRec: 0, goldTransferTx: 0, cost: 0, level: 1 },
  { name: 'Produce Market', fortLevel: 3, goldPerWorker: 55, depositsPerDay: 4, goldTransferRec: 0, goldTransferTx: 0, cost: 500000, level: 2 },
  { name: 'Livestock Market', fortLevel: 7, goldPerWorker: 60, depositsPerDay: 5, goldTransferRec: 0, goldTransferTx: 0, cost: 2000000, level: 3 },
  { name: 'Coal Mine', fortLevel: 11, goldPerWorker: 65, depositsPerDay: 6, goldTransferRec: 50000, goldTransferTx: 150000, cost: 5000000, level: 4 },
  { name: 'Tavern', fortLevel: 15, goldPerWorker: 70, depositsPerDay: 7, goldTransferRec: 100000, goldTransferTx: 300000, cost: 15000000, level: 5 },
  { name: 'Copper Mine', fortLevel: 19, goldPerWorker: 75, depositsPerDay: 8, goldTransferRec: 250000, goldTransferTx: 600000, cost: 37500000, level: 6 },
  { name: 'Meat Market', fortLevel: 23, goldPerWorker: 80, depositsPerDay: 9, goldTransferRec: 500000, goldTransferTx: 1250000, cost: 100000000, level: 7 },
];

// ─── Offensive Upgrades ───────────────────────────────────────────────

export const OffensiveUpgrades: OffensiveUpgradeDefinition[] = [
  { name: 'Dagger Training', fortLevelRequirement: 1, offenseBonusPercentage: 0, cost: 0, level: 1 },
  { name: 'Hand To Hand Combat', fortLevelRequirement: 2, offenseBonusPercentage: 5, cost: 100000, level: 2 },
  { name: 'Mastery', fortLevelRequirement: 3, offenseBonusPercentage: 10, cost: 250000, level: 3 },
  { name: 'Ladders', fortLevelRequirement: 4, offenseBonusPercentage: 15, cost: 500000, level: 4 },
  { name: 'Hatchet Training', fortLevelRequirement: 5, offenseBonusPercentage: 20, cost: 1000000, level: 5 },
  { name: 'Battle Upgrades Level 1', fortLevelRequirement: 6, offenseBonusPercentage: 25, cost: 2000000, level: 6 },
  { name: 'Hatchet Mastery', fortLevelRequirement: 7, offenseBonusPercentage: 30, cost: 3000000, level: 7 },
  { name: 'Mounted Combat Training', fortLevelRequirement: 8, offenseBonusPercentage: 35, cost: 4000000, level: 8 },
  { name: 'Quarterstaff Training', fortLevelRequirement: 9, offenseBonusPercentage: 40, cost: 5000000, level: 9 },
  { name: 'Sapping', fortLevelRequirement: 10, offenseBonusPercentage: 45, cost: 7500000, level: 10 },
  { name: 'Quarterstaff Mastery', fortLevelRequirement: 11, offenseBonusPercentage: 50, cost: 10000000, level: 11 },
  { name: 'Battering Rams', fortLevelRequirement: 12, offenseBonusPercentage: 55, cost: 15000000, level: 12 },
  { name: 'Mace Training', fortLevelRequirement: 13, offenseBonusPercentage: 60, cost: 20000000, level: 13 },
  { name: 'Pole Mace', fortLevelRequirement: 14, offenseBonusPercentage: 65, cost: 30000000, level: 14 },
  { name: 'Mace Mastery', fortLevelRequirement: 15, offenseBonusPercentage: 70, cost: 40000000, level: 15 },
  { name: 'Battle Upgrades Level 2', fortLevelRequirement: 16, offenseBonusPercentage: 75, cost: 50000000, level: 16 },
  { name: 'Short Sword Training', fortLevelRequirement: 17, offenseBonusPercentage: 80, cost: 75000000, level: 17 },
  { name: 'War Commanders', fortLevelRequirement: 18, offenseBonusPercentage: 85, cost: 100000000, level: 18 },
  { name: 'Short Sword Mastery', fortLevelRequirement: 19, offenseBonusPercentage: 90, cost: 150000000, level: 19 },
  { name: 'Wyrm', fortLevelRequirement: 20, offenseBonusPercentage: 95, cost: 200000000, level: 20 },
  { name: 'Morning Star Training', fortLevelRequirement: 21, offenseBonusPercentage: 100, cost: 250000000, level: 21 },
  { name: 'Ballistas', fortLevelRequirement: 22, offenseBonusPercentage: 105, cost: 300000000, level: 22 },
];

// ─── Spy Upgrades ─────────────────────────────────────────────────────

export const SpyUpgrades: SpyUpgradeDefinition[] = [
  { name: 'Sling Training', fortLevelRequirement: 1, offenseBonusPercentage: 0, maxInfiltrations: 0, maxInfiltratorsPerMission: 0, maxInfiltratorsPerUser: 0, maxAssassinsPerMission: 0, maxAssassinationsPerUser: 0, maxAssassinations: 0, cost: 0, level: 1 },
  { name: 'Rope Training', fortLevelRequirement: 2, offenseBonusPercentage: 5, maxInfiltrations: 0, maxInfiltratorsPerMission: 0, maxInfiltratorsPerUser: 0, maxAssassinsPerMission: 0, maxAssassinationsPerUser: 0, maxAssassinations: 0, cost: 50000, level: 2 },
  { name: 'Basic Stealth Training', fortLevelRequirement: 3, offenseBonusPercentage: 10, maxInfiltrations: 0, maxInfiltratorsPerMission: 0, maxInfiltratorsPerUser: 0, maxAssassinsPerMission: 0, maxAssassinationsPerUser: 0, maxAssassinations: 0, cost: 125000, level: 3 },
  { name: 'Basic Disguise Kit Usage', fortLevelRequirement: 4, offenseBonusPercentage: 15, maxInfiltrations: 0, maxInfiltratorsPerMission: 0, maxInfiltratorsPerUser: 0, maxAssassinsPerMission: 0, maxAssassinationsPerUser: 0, maxAssassinations: 0, cost: 250000, level: 4 },
  { name: 'Brass Knuckles Training', fortLevelRequirement: 5, offenseBonusPercentage: 20, maxInfiltrations: 0, maxInfiltratorsPerMission: 0, maxInfiltratorsPerUser: 0, maxAssassinsPerMission: 0, maxAssassinationsPerUser: 0, maxAssassinations: 0, cost: 500000, level: 5 },
  { name: 'Informants', fortLevelRequirement: 6, offenseBonusPercentage: 25, maxInfiltrations: 0, maxInfiltratorsPerMission: 0, maxInfiltratorsPerUser: 0, maxAssassinsPerMission: 0, maxAssassinationsPerUser: 0, maxAssassinations: 0, cost: 1000000, level: 6 },
  { name: 'Infiltration Training', fortLevelRequirement: 7, offenseBonusPercentage: 30, maxInfiltrations: 1, maxInfiltratorsPerMission: 3, maxInfiltratorsPerUser: 1, maxAssassinsPerMission: 0, maxAssassinationsPerUser: 0, maxAssassinations: 0, cost: 1500000, level: 7 },
  { name: 'Grappling Hook Training', fortLevelRequirement: 8, offenseBonusPercentage: 35, maxInfiltrations: 2, maxInfiltratorsPerMission: 3, maxInfiltratorsPerUser: 1, maxAssassinsPerMission: 0, maxAssassinationsPerUser: 0, maxAssassinations: 0, cost: 2000000, level: 8 },
  { name: 'Cudgel Training', fortLevelRequirement: 9, offenseBonusPercentage: 40, maxInfiltrations: 3, maxInfiltratorsPerMission: 3, maxInfiltratorsPerUser: 2, maxAssassinsPerMission: 0, maxAssassinationsPerUser: 0, maxAssassinations: 0, cost: 2500000, level: 9 },
  { name: 'Informant Detection', fortLevelRequirement: 10, offenseBonusPercentage: 45, maxInfiltrations: 4, maxInfiltratorsPerMission: 4, maxInfiltratorsPerUser: 2, maxAssassinsPerMission: 0, maxAssassinationsPerUser: 0, maxAssassinations: 0, cost: 3750000, level: 10 },
  { name: 'Stealth Training', fortLevelRequirement: 11, offenseBonusPercentage: 50, maxInfiltrations: 5, maxInfiltratorsPerMission: 5, maxInfiltratorsPerUser: 2, maxAssassinsPerMission: 0, maxAssassinationsPerUser: 0, maxAssassinations: 0, cost: 5000000, level: 11 },
  { name: 'Poison Usage', fortLevelRequirement: 12, offenseBonusPercentage: 55, maxInfiltrations: 6, maxInfiltratorsPerMission: 5, maxInfiltratorsPerUser: 3, maxAssassinsPerMission: 0, maxAssassinationsPerUser: 0, maxAssassinations: 0, cost: 7500000, level: 12 },
  { name: 'Knife Training', fortLevelRequirement: 13, offenseBonusPercentage: 60, maxInfiltrations: 7, maxInfiltratorsPerMission: 6, maxInfiltratorsPerUser: 3, maxAssassinsPerMission: 0, maxAssassinationsPerUser: 0, maxAssassinations: 0, cost: 10000000, level: 13 },
  { name: 'Language Training', fortLevelRequirement: 14, offenseBonusPercentage: 65, maxInfiltrations: 8, maxInfiltratorsPerMission: 6, maxInfiltratorsPerUser: 3, maxAssassinsPerMission: 0, maxAssassinationsPerUser: 0, maxAssassinations: 0, cost: 15000000, level: 14 },
  { name: 'Advanced Language Training', fortLevelRequirement: 15, offenseBonusPercentage: 70, maxInfiltrations: 9, maxInfiltratorsPerMission: 7, maxInfiltratorsPerUser: 4, maxAssassinsPerMission: 0, maxAssassinationsPerUser: 0, maxAssassinations: 0, cost: 20000000, level: 15 },
  { name: 'Lockpicks Usage', fortLevelRequirement: 16, offenseBonusPercentage: 75, maxInfiltrations: 10, maxInfiltratorsPerMission: 7, maxInfiltratorsPerUser: 5, maxAssassinsPerMission: 10, maxAssassinationsPerUser: 1, maxAssassinations: 10, cost: 20000000, level: 16 },
  { name: 'Hatchet Training', fortLevelRequirement: 17, offenseBonusPercentage: 80, maxInfiltrations: 11, maxInfiltratorsPerMission: 7, maxInfiltratorsPerUser: 5, maxAssassinsPerMission: 20, maxAssassinationsPerUser: 1, maxAssassinations: 10, cost: 37500000, level: 17 },
  { name: 'Translation', fortLevelRequirement: 18, offenseBonusPercentage: 85, maxInfiltrations: 12, maxInfiltratorsPerMission: 7, maxInfiltratorsPerUser: 5, maxAssassinsPerMission: 30, maxAssassinationsPerUser: 2, maxAssassinations: 20, cost: 50000000, level: 18 },
  { name: 'Camouflage Training', fortLevelRequirement: 19, offenseBonusPercentage: 90, maxInfiltrations: 13, maxInfiltratorsPerMission: 7, maxInfiltratorsPerUser: 5, maxAssassinsPerMission: 40, maxAssassinationsPerUser: 2, maxAssassinations: 20, cost: 75000000, level: 19 },
  { name: 'Tripwire Setting', fortLevelRequirement: 20, offenseBonusPercentage: 95, maxInfiltrations: 14, maxInfiltratorsPerMission: 7, maxInfiltratorsPerUser: 5, maxAssassinsPerMission: 50, maxAssassinationsPerUser: 2, maxAssassinations: 20, cost: 100000000, level: 20 },
  { name: 'Dart Gun Training', fortLevelRequirement: 21, offenseBonusPercentage: 100, maxInfiltrations: 15, maxInfiltratorsPerMission: 7, maxInfiltratorsPerUser: 5, maxAssassinsPerMission: 60, maxAssassinationsPerUser: 3, maxAssassinations: 30, cost: 125000000, level: 21 },
  { name: 'Forging', fortLevelRequirement: 22, offenseBonusPercentage: 105, maxInfiltrations: 16, maxInfiltratorsPerMission: 7, maxInfiltratorsPerUser: 5, maxAssassinsPerMission: 70, maxAssassinationsPerUser: 4, maxAssassinations: 40, cost: 150000000, level: 22 },
];

// ─── Sentry Upgrades ──────────────────────────────────────────────────

export const SentryUpgrades: SentryUpgradeDefinition[] = [
  { name: 'Sling Training', fortLevelRequirement: 1, defenseBonusPercentage: 0, cost: 0, level: 1 },
  { name: 'Observation Training', fortLevelRequirement: 2, defenseBonusPercentage: 5, cost: 50000, level: 2 },
  { name: 'Sling Mastery', fortLevelRequirement: 3, defenseBonusPercentage: 10, cost: 125000, level: 3 },
  { name: 'Detection Training', fortLevelRequirement: 4, defenseBonusPercentage: 15, cost: 250000, level: 4 },
  { name: 'Dagger Training', fortLevelRequirement: 5, defenseBonusPercentage: 20, cost: 500000, level: 5 },
  { name: 'Informants', fortLevelRequirement: 6, defenseBonusPercentage: 25, cost: 1000000, level: 6 },
  { name: 'Dagger Mastery', fortLevelRequirement: 7, defenseBonusPercentage: 30, cost: 1500000, level: 7 },
  { name: 'Stealth Training', fortLevelRequirement: 8, defenseBonusPercentage: 35, cost: 2000000, level: 8 },
  { name: 'Hatchet Training', fortLevelRequirement: 9, defenseBonusPercentage: 40, cost: 2500000, level: 9 },
  { name: 'Informant Detection', fortLevelRequirement: 10, defenseBonusPercentage: 45, cost: 3750000, level: 10 },
  { name: 'Hatchet Mastery', fortLevelRequirement: 11, defenseBonusPercentage: 50, cost: 5000000, level: 11 },
  { name: 'Poison Detection', fortLevelRequirement: 12, defenseBonusPercentage: 55, cost: 7500000, level: 12 },
  { name: 'Quarterstaff Training', fortLevelRequirement: 13, defenseBonusPercentage: 60, cost: 10000000, level: 13 },
  { name: 'Languages', fortLevelRequirement: 14, defenseBonusPercentage: 65, cost: 15000000, level: 14 },
  { name: 'Quarterstaff Mastery', fortLevelRequirement: 15, defenseBonusPercentage: 70, cost: 20000000, level: 15 },
  { name: 'Stealth Detection', fortLevelRequirement: 16, defenseBonusPercentage: 75, cost: 25000000, level: 16 },
  { name: 'Spear Training', fortLevelRequirement: 17, defenseBonusPercentage: 80, cost: 37500000, level: 17 },
  { name: 'Translation', fortLevelRequirement: 18, defenseBonusPercentage: 85, cost: 50000000, level: 18 },
  { name: 'Spear Mastery', fortLevelRequirement: 19, defenseBonusPercentage: 90, cost: 75000000, level: 19 },
  { name: 'Tripwire Detection', fortLevelRequirement: 20, defenseBonusPercentage: 95, cost: 100000000, level: 20 },
  { name: 'Mace Training', fortLevelRequirement: 21, defenseBonusPercentage: 100, cost: 125000000, level: 21 },
  { name: 'Forgery Detection', fortLevelRequirement: 22, defenseBonusPercentage: 105, cost: 150000000, level: 22 },
];

// ─── Armory Upgrades ──────────────────────────────────────────────────

export const ArmoryUpgrades: ArmoryUpgradeDefinition[] = [
  { name: 'No Armory', fortLevel: 0, cost: 0, level: 1 },
  { name: 'Leather Armory 1', fortLevel: 5, cost: 500000, level: 2 },
  { name: 'Leather Armory 2', fortLevel: 10, cost: 2000000, level: 3 },
  { name: 'Chainmail Armory 1', fortLevel: 13, cost: 5000000, level: 4 },
  { name: 'Chainmail Armory 2', fortLevel: 17, cost: 15000000, level: 5 },
  { name: 'Chainmail Armory 3', fortLevel: 21, cost: 37500000, level: 6 },
];

// ─── House Upgrades ───────────────────────────────────────────────────

export const HouseUpgrades: HouseUpgradeDefinition[] = [
  { name: 'Housing Level 0', fortLevel: 0, citizensDaily: 1, cost: 0, level: 1 },
  { name: 'Housing Level 1', fortLevel: 2, citizensDaily: 10, cost: 500000, level: 2 },
  { name: 'Housing Level 2', fortLevel: 6, citizensDaily: 20, cost: 1000000, level: 3 },
  { name: 'Housing Level 3', fortLevel: 10, citizensDaily: 30, cost: 1500000, level: 4 },
  { name: 'Housing Level 4', fortLevel: 14, citizensDaily: 40, cost: 2500000, level: 5 },
  { name: 'Housing Level 5', fortLevel: 18, citizensDaily: 50, cost: 3500000, level: 6 },
  { name: 'Housing Level 6', fortLevel: 22, citizensDaily: 60, cost: 5000000, level: 7 },
];

// ─── Helper Functions ─────────────────────────────────────────────────

/**
 * Returns the economy upgrade definition for the given level.
 */
export function getEconomyUpgradeByLevel(
  level: number,
): EconomyUpgradeDefinition | undefined {
  return EconomyUpgrades.find((e) => e.level === level);
}

/**
 * Returns the offensive upgrade definition for the given level.
 */
export function getOffensiveUpgradeByLevel(
  level: number,
): OffensiveUpgradeDefinition | undefined {
  return OffensiveUpgrades.find((o) => o.level === level);
}

/**
 * Returns the spy upgrade definition for the given level.
 */
export function getSpyUpgradeByLevel(
  level: number,
): SpyUpgradeDefinition | undefined {
  return SpyUpgrades.find((s) => s.level === level);
}

/**
 * Returns the sentry upgrade definition for the given level.
 */
export function getSentryUpgradeByLevel(
  level: number,
): SentryUpgradeDefinition | undefined {
  return SentryUpgrades.find((s) => s.level === level);
}

/**
 * Returns the armory upgrade definition for the given level.
 */
export function getArmoryUpgradeByLevel(
  level: number,
): ArmoryUpgradeDefinition | undefined {
  return ArmoryUpgrades.find((a) => a.level === level);
}

/**
 * Returns the house upgrade definition for the given level.
 */
export function getHouseUpgradeByLevel(
  level: number,
): HouseUpgradeDefinition | undefined {
  return HouseUpgrades.find((h) => h.level === level);
}
