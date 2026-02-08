import { UnitType, BonusType, ItemUsage, BattleUpgradeType } from '@openthrone/shared';
import { getFortificationByLevel } from './fortifications';
import { getOffensiveUpgradeByLevel, getSpyUpgradeByLevel, getSentryUpgradeByLevel, getHouseUpgradeByLevel } from './structure-upgrades';
import { Bonuses } from './bonuses';
import { UnitTypes } from './units';
import { ItemTypes } from './items';
import { BattleUpgrades } from './battle-upgrades';

// ─── Detailed Breakdown Types ───────────────────────────────────────────

export interface LineItem {
  name: string;        // "Soldier", "Dagger"
  quantity: number;
  bonusEach: number;   // per-unit bonus
  total: number;       // bonusEach * quantity
}

export interface BonusLine {
  label: string;       // "Race (Human)", "Class (Fighter)", "Proficiency (3 pts)"
  percent: number;     // e.g. 5
}

export interface DetailedStatBreakdown {
  statType: string;
  unitLines: LineItem[];
  unitTotal: number;
  itemLines: LineItem[];
  itemTotal: number;
  upgradeLines: LineItem[];
  upgradeTotal: number;
  subtotal: number;           // units + items + upgrades
  bonusLines: BonusLine[];    // each modifier source
  bonusPercent: number;       // total additive %
  bonusAmount: number;        // Math.round(bonusPercent/100 * subtotal)
  total: number;              // ceil(subtotal + bonusAmount)
}

export interface FullDetailedBreakdown {
  offense: DetailedStatBreakdown;
  defense: DetailedStatBreakdown;
  spy: DetailedStatBreakdown;
  sentry: DetailedStatBreakdown;
}

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

// ─── Detailed single-stat calculation (itemized) ────────────────────────

function calculateDetailedSingleStat(
  statType: 'OFFENSE' | 'DEFENSE' | 'SPY' | 'SENTRY',
  input: StatCalcInput,
): DetailedStatBreakdown {
  const mapping = STAT_TYPE_MAP[statType]!;

  // 1. Units
  const unitLines: LineItem[] = [];
  let unitTotal = 0;
  for (const pu of input.units) {
    if (pu.unitType !== mapping.unitType) continue;
    const def = UnitTypes.find((u) => u.type === pu.unitType && u.level === pu.level);
    if (def && pu.quantity > 0) {
      const total = def.bonus * pu.quantity;
      unitLines.push({ name: def.name, quantity: pu.quantity, bonusEach: def.bonus, total });
      unitTotal += total;
    }
  }

  // 2. Items
  const itemLines: LineItem[] = [];
  let itemTotal = 0;
  for (const pi of input.items) {
    if (pi.usage !== mapping.itemUsage) continue;
    const def = ItemTypes.find(
      (i) => i.type === pi.itemType && i.usage === pi.usage && i.level === pi.level,
    );
    if (def && pi.quantity > 0) {
      const total = def.bonus * pi.quantity;
      itemLines.push({ name: def.name, quantity: pi.quantity, bonusEach: def.bonus, total });
      itemTotal += total;
    }
  }

  // 3. Battle upgrades
  const upgradeLines: LineItem[] = [];
  let upgradeTotal = 0;
  for (const pbu of input.battleUpgrades) {
    if (pbu.upgradeType !== mapping.battleType) continue;
    const def = BattleUpgrades.find(
      (b) => b.type === pbu.upgradeType && b.level === pbu.level,
    );
    if (def && pbu.quantity > 0) {
      const covered = pbu.quantity * def.unitsCovered;
      const total = def.bonus * covered;
      upgradeLines.push({ name: def.name, quantity: covered, bonusEach: def.bonus, total });
      upgradeTotal += total;
    }
  }

  // 4. Bonus percentage
  const bonusLines: BonusLine[] = [];
  let bonusPercent = 0;

  const bonusType = statType === 'OFFENSE' ? BonusType.OFFENSE
    : statType === 'DEFENSE' ? BonusType.DEFENSE
    : BonusType.INTEL;

  for (const b of Bonuses) {
    if (b.bonusType !== bonusType) continue;
    if (b.race === input.race) {
      bonusLines.push({ label: `Race (${input.race})`, percent: b.bonusAmount });
      bonusPercent += b.bonusAmount;
    }
    if (b.race === input.playerClass) {
      bonusLines.push({ label: `Class (${input.playerClass})`, percent: b.bonusAmount });
      bonusPercent += b.bonusAmount;
    }
  }

  // Proficiency points
  const profBonusType = statType === 'SPY' || statType === 'SENTRY' ? BonusType.INTEL : bonusType;
  const profPoints = input.bonusPoints.find((bp) => bp.bonusType === profBonusType);
  if (profPoints && profPoints.level > 0) {
    bonusLines.push({ label: `Proficiency (${profPoints.level} pts)`, percent: profPoints.level });
    bonusPercent += profPoints.level;
  }

  // Structure upgrade bonus percentage
  if (statType === 'OFFENSE') {
    const offUpgrade = input.structureUpgrades.find((su) => su.upgradeType === 'OFFENSE');
    const offDef = getOffensiveUpgradeByLevel(offUpgrade?.level ?? 1);
    if (offDef && offDef.offenseBonusPercentage > 0) {
      bonusLines.push({ label: `Siege (${offDef.name})`, percent: offDef.offenseBonusPercentage });
      bonusPercent += offDef.offenseBonusPercentage;
    }
  } else if (statType === 'DEFENSE') {
    const fort = getFortificationByLevel(input.fortLevel);
    if (fort && fort.defenseBonusPercentage > 0) {
      bonusLines.push({ label: `Fort (${fort.name})`, percent: fort.defenseBonusPercentage });
      bonusPercent += fort.defenseBonusPercentage;
    }
  } else if (statType === 'SPY') {
    const spyUpgrade = input.structureUpgrades.find((su) => su.upgradeType === 'SPY');
    const spyDef = getSpyUpgradeByLevel(spyUpgrade?.level ?? 1);
    if (spyDef && spyDef.offenseBonusPercentage > 0) {
      bonusLines.push({ label: `Spy Upgrade (${spyDef.name})`, percent: spyDef.offenseBonusPercentage });
      bonusPercent += spyDef.offenseBonusPercentage;
    }
  } else if (statType === 'SENTRY') {
    const senUpgrade = input.structureUpgrades.find((su) => su.upgradeType === 'SENTRY');
    const senDef = getSentryUpgradeByLevel(senUpgrade?.level ?? 1);
    if (senDef && senDef.defenseBonusPercentage > 0) {
      bonusLines.push({ label: `Sentry Upgrade (${senDef.name})`, percent: senDef.defenseBonusPercentage });
      bonusPercent += senDef.defenseBonusPercentage;
    }
  }

  const subtotal = unitTotal + itemTotal + upgradeTotal;
  const bonusAmount = Math.round((bonusPercent / 100) * subtotal);
  const total = Math.ceil(subtotal + bonusAmount);

  return {
    statType,
    unitLines, unitTotal,
    itemLines, itemTotal,
    upgradeLines, upgradeTotal,
    subtotal,
    bonusLines, bonusPercent, bonusAmount,
    total,
  };
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

export function calculateFullDetailedBreakdown(input: StatCalcInput): FullDetailedBreakdown {
  return {
    offense: calculateDetailedSingleStat('OFFENSE', input),
    defense: calculateDetailedSingleStat('DEFENSE', input),
    spy: calculateDetailedSingleStat('SPY', input),
    sentry: calculateDetailedSingleStat('SENTRY', input),
  };
}

export function calculateGoldPerTurnBreakdown(
  fortLevel: number,
  workers: Array<{ level: number; quantity: number }>,
  incomeBonusLevel: number,
): GoldPerTurnBreakdown {
  const fort = getFortificationByLevel(fortLevel);
  const fortGold = fort?.goldPerTurn ?? 1000;

  let workerGold = 0;
  for (const w of workers) {
    const def = UnitTypes.find(
      (u) => u.type === UnitType.WORKER && u.level === w.level,
    );
    workerGold += (def?.bonus ?? 50) * w.quantity;
  }

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
