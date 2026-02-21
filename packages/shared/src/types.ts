import type {
  PlayerRace,
  PlayerClass,
  UnitType,
  ItemType,
  ItemUsage,
  BonusType,
  BattleUpgradeType,
  BuildingType,
  AccountStatus,
  PermissionType,
  Locale,
} from './enums';

// ─── Building Definitions ───────────────────────────────────────────

export interface BuildingRequirement {
  buildingType: BuildingType;
  level: number;
}

export interface BuildingLevelDefinition {
  level: number;
  name: string;
  cost: number;
  playerLevelRequirement: number;
  fortHitpoints?: number;
  incomeBonusPercent?: number;
  spyOffenseBonus?: number;
  citizensPerDay?: number;
  dailyMercStock?: number;
}

export interface BuildingDefinition {
  type: BuildingType;
  description: string;
  levels: BuildingLevelDefinition[];
}

// ─── Unit Definitions ────────────────────────────────────────────────

export interface UnitDefinition {
  name: string;
  type: UnitType;
  level: number;
  bonus: number;
  cost: number;
  fortLevel: number;
  hp: number;
  killingStrength: number;
  defenseStrength: number;
  buildingRequirements: BuildingRequirement[];
}

// ─── Item Definitions ────────────────────────────────────────────────

export interface ItemDefinition {
  id: string;
  name: string;
  usage: ItemUsage;
  type: ItemType;
  level: number;
  bonus: number;
  cost: number;
  race: PlayerRace | 'ALL';
  armoryLevel: number;
  killingStrength: number;
  defenseStrength: number;
}

// ─── Fortification Definitions ───────────────────────────────────────

export interface FortificationDefinition {
  name: string;
  level: number;
  levelRequirement: number;
  hitpoints: number;
  costPerRepairPoint: number;
  goldPerTurn: number;
  defenseBonusPercentage: number;
  cost: number;
}

// ─── Upgrade Definitions ─────────────────────────────────────────────

export interface BattleUpgradeDefinition {
  type: BattleUpgradeType;
  name: string;
  siegeUpgradeLevel: number;
  level: number;
  bonus: number;
  cost: number;
  unitsCovered: number;
  minUnitLevel: number;
  killingStrength: number;
  defenseStrength: number;
}

export interface OffensiveUpgradeDefinition {
  name: string;
  fortLevelRequirement: number;
  offenseBonusPercentage: number;
  cost: number;
  level: number;
}

export interface SpyUpgradeDefinition {
  name: string;
  fortLevelRequirement: number;
  offenseBonusPercentage: number;
  maxInfiltrations: number;
  maxInfiltratorsPerMission: number;
  maxInfiltratorsPerUser: number;
  maxAssassinsPerMission: number;
  maxAssassinationsPerUser: number;
  maxAssassinations: number;
  cost: number;
  level: number;
}

export interface SentryUpgradeDefinition {
  name: string;
  fortLevelRequirement: number;
  defenseBonusPercentage: number;
  cost: number;
  level: number;
}

export interface EconomyUpgradeDefinition {
  name: string;
  fortLevel: number;
  goldPerWorker: number;
  depositsPerDay: number;
  goldTransferRec: number;
  goldTransferTx: number;
  cost: number;
  level: number;
}

export interface ArmoryUpgradeDefinition {
  name: string;
  fortLevel: number;
  cost: number;
  level: number;
}

export interface HouseUpgradeDefinition {
  name: string;
  fortLevel: number;
  citizensDaily: number;
  cost: number;
  level: number;
}

// ─── Bonus Definitions ───────────────────────────────────────────────

export interface PlayerBonusDefinition {
  race: PlayerRace | PlayerClass;
  bonusType: BonusType;
  bonusAmount: number;
}

// ─── XP Definitions ──────────────────────────────────────────────────

export interface LevelXP {
  level: number;
  xp: number;
}

// ─── Player Data Types (API responses) ───────────────────────────────

export interface PlayerProfile {
  id: string;
  displayName: string;
  race: PlayerRace;
  class: PlayerClass;
  locale: Locale;
  avatar: string | null;
  bio: string;
  colorScheme: string | null;
  status: AccountStatus;
  lastActive: string;
  createdAt: string;
}

export interface PlayerEconomy {
  gold: string;
  goldInBank: string;
  attackTurns: number;
  houseLevel: number;
  economyLevel: number;
}

export interface PlayerStats {
  experience: number;
  rank: number;
  offense: number;
  defense: number;
  spy: number;
  sentry: number;
  level: number;
}

export interface PlayerUnitEntry {
  unitType: UnitType;
  level: number;
  quantity: number;
}

export interface PlayerItemEntry {
  itemType: ItemType;
  usage: ItemUsage;
  level: number;
  quantity: number;
}

export interface PlayerSession {
  id: string;
  displayName: string;
  race: PlayerRace;
  class: PlayerClass;
  colorScheme: string | null;
  permissions: PermissionType[];
}

// ─── Fortification State ─────────────────────────────────────────────

export interface FortHealth {
  current: number;
  max: number;
  percentage: number;
}

// ─── Sidebar Data ────────────────────────────────────────────────────

export interface SidebarData {
  gold: string;
  citizens: string;
  level: string;
  experience: string;
  xpToNextLevel: string;
  attackTurns: string;
}

// ─── Page Alert ──────────────────────────────────────────────────────

export interface PageAlert {
  type: 'SUCCESS' | 'DANGER' | 'INFO';
  message: string;
}

// ─── Cache Sync: Player State Snapshot ──────────────────────────────
// Returned by mutations to update frontend cache without refetching

export interface PlayerStateSnapshot {
  // Economy
  gold: string; // BigInt as string
  goldInBank: string; // BigInt as string

  // Stats
  experience: number;
  level: number;
  offense: number;
  defense: number;
  spy: number;
  sentry: number;

  // Resources
  attackTurns: number;
  citizens: number;

  // Units (only when changed)
  updatedUnits?: Array<{
    unitType: UnitType;
    level: number;
    quantity: number;
  }>;
}
