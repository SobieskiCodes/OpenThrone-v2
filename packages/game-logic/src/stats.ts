import { UnitType, BonusType, ItemUsage, BattleUpgradeType } from '@openthrone/shared';
import type { UnitDefinition, ItemDefinition, BattleUpgradeDefinition } from '@openthrone/shared';
import { getFortificationByLevel } from './fortifications';
import { getOffensiveUpgradeByLevel, getSpyUpgradeByLevel, getSentryUpgradeByLevel, getEconomyUpgradeByLevel, getHouseUpgradeByLevel } from './structure-upgrades';
import { Bonuses } from './bonuses';
import { UnitTypes } from './units';
import { ItemTypes } from './items';
import { BattleUpgrades } from './battle-upgrades';

// ─── Types ──────────────────────────────────────────────────────────────

export interface StatBreakdown {
  units: number;
  items: number;
  battleUpgrades: number;
  bonusPercent: number;
  bonusAmount: number;
  total: number;
}

export interface FullStatBreakdown {
  offense: StatBreakdown;
  defense: StatBreakdown;
  spy: StatBreakdown;
  sentry: StatBreakdown;
}

export interface GoldPerTurnBreakdown {
  fortGold: number;
  workerGold: number;
  incomeBonus: number;
  incomeBonusPercent: number;
  total: number;
}

export interface CitizensPerDayBreakdown {
  houseBase: number;
  recruitBonus: number;
  recruitBonusPercent: number;
  total: number;
}

// ─── Army Stat Types (maps unit types to item usages / upgrade types) ───

const STAT_TYPE_MAP: Record<string, { unitType: UnitType; itemUsage: ItemUsage; battleType: BattleUpgradeType }> = {
  OFFENSE: { unitType: UnitType.OFFENSE, itemUsage: ItemUsage.OFFENSE, battleType: BattleUpgradeType.OFFENSE },
  DEFENSE: { unitType: UnitType.DEFENSE, itemUsage: ItemUsage.DEFENSE, battleType: BattleUpgradeType.DEFENSE },
  SPY: { unitType: UnitType.SPY, itemUsage: ItemUsage.SPY, battleType: BattleUpgradeType.SPY },
  SENTRY: { unitType: UnitType.SENTRY, itemUsage: ItemUsage.SENTRY, battleType: BattleUpgradeType.SENTRY },
};

// ─── Input types ────────────────────────────────────────────────────────

interface PlayerUnitInput {
  unitType: string;
  level: number;
  quantity: number;
}

interface PlayerItemInput {
  itemType: string;
  usage: string;
  level: number;
  quantity: number;
}

interface PlayerBattleUpgradeInput {
  upgradeType: string;
  level: number;
  quantity: number;
}

interface PlayerBonusInput {
  bonusType: string;
  level: number;
}

interface StructureUpgradeInput {
  upgradeType: string;
  level: number;
}

export interface StatCalcInput {
  race: string;
  playerClass: string;
  fortLevel: number;
  units: PlayerUnitInput[];
  items: PlayerItemInput[];
  battleUpgrades: PlayerBattleUpgradeInput[];
  bonusPoints: PlayerBonusInput[];
  structureUpgrades: StructureUpgradeInput[];
}

// ─── Calculate one army stat ────────────────────────────────────────────

function calculateSingleStat(
  statType: 'OFFENSE' | 'DEFENSE' | 'SPY' | 'SENTRY',
  input: StatCalcInput,
): StatBreakdown {
  const mapping = STAT_TYPE_MAP[statType]!;

  // 1. Unit contribution: sum(unit.bonus * quantity) for matching type
  let unitStat = 0;
  for (const pu of input.units) {
    if (pu.unitType !== mapping.unitType) continue;
    const def = UnitTypes.find((u) => u.type === pu.unitType && u.level === pu.level);
    if (def) {
      unitStat += def.bonus * pu.quantity;
    }
  }

  // 2. Item contribution: sum(item.bonus * quantity) for matching usage
  let itemStat = 0;
  for (const pi of input.items) {
    if (pi.usage !== mapping.itemUsage) continue;
    const def = ItemTypes.find(
      (i) => i.type === pi.itemType && i.usage === pi.usage && i.level === pi.level,
    );
    if (def) {
      itemStat += def.bonus * pi.quantity;
    }
  }

  // 3. Battle upgrade contribution: sum(upgrade.bonus * min(quantity * unitsCovered, eligibleUnits))
  let battleUpgradeStat = 0;
  for (const pbu of input.battleUpgrades) {
    if (pbu.upgradeType !== mapping.battleType) continue;
    const def = BattleUpgrades.find(
      (b) => b.type === pbu.upgradeType && b.level === pbu.level,
    );
    if (def) {
      // Each upgrade covers N units; total covered = quantity * unitsCovered
      const covered = pbu.quantity * def.unitsCovered;
      battleUpgradeStat += def.bonus * covered;
    }
  }

  // 4. Bonus percentage (additive): race/class bonuses + proficiency points + structure upgrades
  let bonusPercent = 0;

  // Race/class bonuses
  const bonusType = statType === 'OFFENSE' ? BonusType.OFFENSE
    : statType === 'DEFENSE' ? BonusType.DEFENSE
    : BonusType.INTEL; // SPY and SENTRY both use INTEL

  for (const b of Bonuses) {
    if (b.bonusType !== bonusType) continue;
    if (b.race === input.race || b.race === input.playerClass) {
      bonusPercent += b.bonusAmount;
    }
  }

  // Proficiency points for this stat type
  const profBonusType = statType === 'SPY' || statType === 'SENTRY' ? BonusType.INTEL : bonusType;
  const profPoints = input.bonusPoints.find((bp) => bp.bonusType === profBonusType);
  if (profPoints) {
    bonusPercent += profPoints.level;
  }

  // Structure upgrade bonus percentage
  if (statType === 'OFFENSE') {
    const offUpgrade = input.structureUpgrades.find((su) => su.upgradeType === 'OFFENSE');
    const offDef = getOffensiveUpgradeByLevel(offUpgrade?.level ?? 1);
    bonusPercent += offDef?.offenseBonusPercentage ?? 0;
  } else if (statType === 'DEFENSE') {
    // Fort defense bonus
    const fort = getFortificationByLevel(input.fortLevel);
    bonusPercent += fort?.defenseBonusPercentage ?? 0;
  } else if (statType === 'SPY') {
    const spyUpgrade = input.structureUpgrades.find((su) => su.upgradeType === 'SPY');
    const spyDef = getSpyUpgradeByLevel(spyUpgrade?.level ?? 1);
    bonusPercent += spyDef?.offenseBonusPercentage ?? 0;
  } else if (statType === 'SENTRY') {
    const senUpgrade = input.structureUpgrades.find((su) => su.upgradeType === 'SENTRY');
    const senDef = getSentryUpgradeByLevel(senUpgrade?.level ?? 1);
    bonusPercent += senDef?.defenseBonusPercentage ?? 0;
  }

  const subtotal = unitStat + itemStat + battleUpgradeStat;
  const bonusAmount = Math.round((bonusPercent / 100) * subtotal);
  const total = Math.ceil(subtotal + bonusAmount);

  return { units: unitStat, items: itemStat, battleUpgrades: battleUpgradeStat, bonusPercent, bonusAmount, total };
}

// ─── Public API ─────────────────────────────────────────────────────────

export function calculateFullStats(input: StatCalcInput): FullStatBreakdown {
  return {
    offense: calculateSingleStat('OFFENSE', input),
    defense: calculateSingleStat('DEFENSE', input),
    spy: calculateSingleStat('SPY', input),
    sentry: calculateSingleStat('SENTRY', input),
  };
}

export function calculateGoldPerTurnBreakdown(
  fortLevel: number,
  economyLevel: number,
  workerCount: number,
  incomeBonusLevel: number,
): GoldPerTurnBreakdown {
  const fort = getFortificationByLevel(fortLevel);
  const eco = getEconomyUpgradeByLevel(economyLevel);
  const fortGold = fort?.goldPerTurn ?? 1000;
  const goldPerWorker = eco?.goldPerWorker ?? 50;
  const workerGold = workerCount * goldPerWorker;
  const base = fortGold + workerGold;
  const incomeBonus = Math.round((incomeBonusLevel / 100) * base);

  return {
    fortGold,
    workerGold,
    incomeBonus,
    incomeBonusPercent: incomeBonusLevel,
    total: base + incomeBonus,
  };
}

export function calculateCitizensPerDayBreakdown(
  houseLevel: number,
  recruitBonusLevel: number,
): CitizensPerDayBreakdown {
  const house = getHouseUpgradeByLevel(houseLevel);
  const houseBase = house?.citizensDaily ?? 1;
  const recruitBonusPercent = recruitBonusLevel * 5; // each level = 5% more citizens
  const recruitBonus = Math.round((recruitBonusPercent / 100) * houseBase);

  return {
    houseBase,
    recruitBonus,
    recruitBonusPercent,
    total: houseBase + recruitBonus,
  };
}
