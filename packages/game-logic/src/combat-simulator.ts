/**
 * Combat Simulator - Pure game logic for battle simulation
 * Supports both single-run detailed analysis and batch Monte Carlo simulations
 */

import { UnitTypes } from './units';
import { ItemTypes } from './items';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SimulatorUnit {
  type: string; // Unit type slug (OFFENSE/DEFENSE/SPY/SENTRY/WORKER)
  level: number; // 1-4 for combat units, 1-3 for workers
  quantity: number;
}

export interface SimulatorItem {
  id: string; // Item ID from ItemTypes (e.g., 'OFF-WPN-1')
  quantity: number;
}

export interface SimulatorProfile {
  // Basic stats
  level: number;
  race: string; // HUMAN/GOBLIN/UNDEAD/ELF
  class: string; // FIGHTER/CLERIC/ASSASSIN/THIEF

  // Proficiencies
  offenseProficiency: number; // 0-100 (Strength for attacker)
  defenseProficiency: number; // 0-100 (Constitution for defender)
  spyProficiency: number;
  sentryProficiency: number;

  // Military composition
  units: SimulatorUnit[];
  items: SimulatorItem[];

  // Fort & economy (defender only)
  fortHealth?: number;
  fortMaxHealth?: number;
  gold?: number;
  goldInBank?: number;
}

export interface SimulatorConfig {
  // Casualty rates
  attackerCasualtyBase: number; // 0.006
  defenderCasualtyBase: number; // 0.01
  attackerWinCasualtyRate: number; // 0.003
  defenderWinCasualtyRate: number; // 0.003
  maxCasualtyPercent: number; // 0.05

  // Fort damage
  fortDamagePerTurn: number; // 10

  // Gold theft
  goldTheftBasePercent: number; // 0.1
  goldTheftPerExtraTurn: number; // 0.045
  goldTheftMaxPercent: number; // 0.5

  // XP
  xpPerWin: number; // 100
  xpPerLoss: number; // 10

  // Turn bonus
  turnBonusPerTurn: number; // 0.01 (1% per turn)

  // Fort protection
  fortProtectionMultiplier: number; // 0.9 at full HP

  // Dominance
  maxDominanceRatio: number; // 5.0
}

export interface UnitCasualty {
  type: string;
  level: number;
  name: string;
  quantity: number; // Had before battle
  lost: number; // Lost in battle
  remaining: number; // After battle
}

export interface StatBreakdown {
  units: { type: string; level: number; name: string; quantity: number; bonusEach: number; total: number }[];
  items: {
    weapons: { equipped: any[]; unused: any[]; totalBonus: number };
    armor: { equipped: any[]; unused: any[]; totalBonus: number };
  };
  upgrades: { id: number; name: string; quantity: number; bonusEach: number; total: number }[];

  unitCount: number;
  unitTotal: number;
  itemTotal: number;
  upgradeTotal: number;
  baseTotal: number;

  raceBonus: number;
  classBonus: number;
  profBonus: number;
  multiplier: number;

  total: number;
  totalBeforeTurns?: number; // offense only
  totalAfterTurns?: number; // offense only (effective offense)
}

export interface SingleSimResult {
  attackerWins: boolean;
  effectiveOffense: number;
  totalDefense: number;

  goldStolen: number;
  goldStolenPercent: number;
  goldStealRange: { min: number; max: number };

  fortDamage: number;
  fortHealthPercent: number;
  fortProtection: number;

  attackerXP: number;
  defenderXP: number;

  turnsUsed: number;
  turnBonus: number;
  battleCloseness: number; // 0-1 (ratio of weaker/stronger)
  dominanceRatio: number;

  attackerCasualties: UnitCasualty[];
  defenderCasualties: UnitCasualty[];
  attackerCasualtyRate: number;
  defenderCasualtyRate: number;
  attackerTotalUnitsLost: number;
  defenderTotalUnitsLost: number;

  attackerBreakdown: StatBreakdown;
  defenderBreakdown: StatBreakdown;
}

export interface BatchSimResult {
  runs: number;
  winRate: number;

  avgGoldStolen: number;
  avgFortDamage: number;
  avgAttackerXP: number;
  avgDefenderXP: number;
  avgAttackerCasualties: number;
  avgDefenderCasualties: number;

  goldStolenBuckets: { label: string; count: number }[];
  attackerCasualtyBuckets: { label: string; count: number }[];
  defenderCasualtyBuckets: { label: string; count: number }[];
  fortDamageBuckets: { label: string; count: number }[];
}

// ─── Default Config ─────────────────────────────────────────────────────────

export const DEFAULT_SIMULATOR_CONFIG: SimulatorConfig = {
  attackerCasualtyBase: 0.006,
  defenderCasualtyBase: 0.01,
  attackerWinCasualtyRate: 0.003,
  defenderWinCasualtyRate: 0.003,
  maxCasualtyPercent: 0.05,
  fortDamagePerTurn: 10,
  goldTheftBasePercent: 0.1,
  goldTheftPerExtraTurn: 0.045,
  goldTheftMaxPercent: 0.5,
  xpPerWin: 100,
  xpPerLoss: 10,
  turnBonusPerTurn: 0.01,
  fortProtectionMultiplier: 0.9,
  maxDominanceRatio: 5.0,
};

// ─── Race/Class Bonuses ─────────────────────────────────────────────────────

function getRaceBonus(race: string, stat: 'offense' | 'defense'): number {
  const bonuses: Record<string, Record<string, number>> = {
    HUMAN: { offense: 0.05, defense: 0 },
    UNDEAD: { offense: 0.05, defense: 0 },
    GOBLIN: { offense: 0, defense: 0.05 },
    ELF: { offense: 0, defense: 0.05 },
  };
  return bonuses[race]?.[stat] || 0;
}

function getClassBonus(playerClass: string, stat: 'offense' | 'defense'): number {
  const bonuses: Record<string, Record<string, number>> = {
    FIGHTER: { offense: 0.05, defense: 0 },
    CLERIC: { offense: 0, defense: 0.05 },
    ASSASSIN: { offense: 0, defense: 0 },
    THIEF: { offense: 0, defense: 0 },
  };
  return bonuses[playerClass]?.[stat] || 0;
}

// ─── Stat Calculation ───────────────────────────────────────────────────────

function calculateStats(
  profile: SimulatorProfile,
  statType: 'offense' | 'defense',
  turnsUsed: number = 1
): StatBreakdown {
  const breakdown: StatBreakdown = {
    units: [],
    items: { weapons: { equipped: [], unused: [], totalBonus: 0 }, armor: { equipped: [], unused: [], totalBonus: 0 } },
    upgrades: [],
    unitCount: 0,
    unitTotal: 0,
    itemTotal: 0,
    upgradeTotal: 0,
    baseTotal: 0,
    raceBonus: getRaceBonus(profile.race, statType),
    classBonus: getClassBonus(profile.class, statType),
    profBonus: statType === 'offense' ? profile.offenseProficiency / 100 * 0.3 : profile.defenseProficiency / 100 * 0.3,
    multiplier: 1,
    total: 0,
  };

  // Units
  profile.units.forEach((unit) => {
    const unitDef = UnitTypes.find((u) => u.type === unit.type && u.level === unit.level);
    if (!unitDef) return;

    const bonusEach = statType === 'offense' ? unitDef.killingStrength : unitDef.defenseStrength;
    const total = bonusEach * unit.quantity;

    breakdown.units.push({
      type: unit.type,
      level: unit.level,
      name: unitDef.name,
      quantity: unit.quantity,
      bonusEach,
      total,
    });

    breakdown.unitCount += unit.quantity;
    breakdown.unitTotal += total;
  });

  // Items (weapons + armor, capped by unit count)
  profile.items.forEach((item) => {
    const itemDef = ItemTypes.find((i) => i.id === item.id);
    if (!itemDef) return;

    // Filter by usage (OFFENSE or DEFENSE)
    const expectedUsage = statType === 'offense' ? 'OFFENSE' : 'DEFENSE';
    if (itemDef.usage !== expectedUsage) return;

    const equipped = Math.min(item.quantity, breakdown.unitCount);
    const unused = item.quantity - equipped;
    const bonusEach = itemDef.bonus;
    const total = bonusEach * equipped;

    const entry = { id: item.id, name: itemDef.name, quantity: equipped, bonusEach, total };

    if (itemDef.type === 'WEAPON') {
      breakdown.items.weapons.equipped.push(entry);
      breakdown.items.weapons.totalBonus += total;
      if (unused > 0) breakdown.items.weapons.unused.push({ ...itemDef, quantity: unused });
    } else if (itemDef.type === 'HELM' || itemDef.type === 'ARMOR' || itemDef.type === 'BOOTS' || itemDef.type === 'BRACERS') {
      breakdown.items.armor.equipped.push(entry);
      breakdown.items.armor.totalBonus += total;
      if (unused > 0) breakdown.items.armor.unused.push({ ...itemDef, quantity: unused });
    }
  });

  breakdown.itemTotal = breakdown.items.weapons.totalBonus + breakdown.items.armor.totalBonus;

  // Battle upgrades (TODO: implement capping logic once we know upgrade structure)
  // For now, assume they're in items as well

  breakdown.baseTotal = breakdown.unitTotal + breakdown.itemTotal + breakdown.upgradeTotal;
  breakdown.multiplier = 1 + breakdown.raceBonus + breakdown.classBonus + breakdown.profBonus;
  breakdown.total = Math.floor(breakdown.baseTotal * breakdown.multiplier);

  // Apply turn bonus for offense
  if (statType === 'offense') {
    breakdown.totalBeforeTurns = breakdown.total;
    const turnBonus = 1 + (turnsUsed - 1) * 0.01;
    breakdown.totalAfterTurns = Math.floor(breakdown.total * turnBonus);
    breakdown.total = breakdown.totalAfterTurns;
  }

  return breakdown;
}

// ─── Single Simulation ──────────────────────────────────────────────────────

export function runSingleSimulation(
  attacker: SimulatorProfile,
  defender: SimulatorProfile,
  turnsUsed: number,
  config: SimulatorConfig
): SingleSimResult {
  const atkBreakdown = calculateStats(attacker, 'offense', turnsUsed);
  const defBreakdown = calculateStats(defender, 'defense');

  const effectiveOffense = atkBreakdown.total;
  const totalDefense = defBreakdown.total;
  const attackerWins = effectiveOffense > totalDefense;

  // Turn bonus
  const turnBonus = 1 + (turnsUsed - 1) * config.turnBonusPerTurn;

  // Battle closeness (0-1)
  const battleCloseness = Math.min(effectiveOffense, totalDefense) / Math.max(effectiveOffense, totalDefense);

  // Dominance ratio (capped)
  const dominanceRatio = Math.min(
    Math.max(effectiveOffense, totalDefense) / Math.max(Math.min(effectiveOffense, totalDefense), 1),
    config.maxDominanceRatio
  );

  // Fort protection (0-1, higher = less casualties)
  const fortHealthPercent = Math.min(100, Math.floor((defender.fortHealth || 0) / Math.max(defender.fortMaxHealth || 1, 1) * 100));
  const fortProtection = (defender.fortHealth || 0) / Math.max(defender.fortMaxHealth || 1, 1) * config.fortProtectionMultiplier;

  // Fort damage
  const fortDamage = attackerWins ? turnsUsed * config.fortDamagePerTurn : 0;

  // Gold stolen
  let goldStolen = 0;
  let goldStolenPercent = 0;
  let goldStealRange = { min: 0, max: 0 };

  if (attackerWins) {
    const basePercent = config.goldTheftBasePercent + (turnsUsed - 1) * config.goldTheftPerExtraTurn;
    const cappedPercent = Math.min(basePercent, config.goldTheftMaxPercent);
    const variance = 0.9 + Math.random() * 0.2; // 90%-110%
    const defenderGold = defender.gold || 0;

    goldStolen = Math.floor(defenderGold * cappedPercent * variance);
    goldStolenPercent = Math.round(cappedPercent * 100);
    goldStealRange = {
      min: Math.floor(defenderGold * cappedPercent * 0.9),
      max: Math.floor(defenderGold * cappedPercent * 1.1),
    };
  }

  // XP
  const attackerXP = attackerWins ? config.xpPerWin : config.xpPerLoss;
  const defenderXP = attackerWins ? config.xpPerLoss : config.xpPerWin;

  // Casualties
  let attackerCasualtyRate = 0;
  let defenderCasualtyRate = 0;

  if (attackerWins) {
    attackerCasualtyRate = Math.min(config.attackerWinCasualtyRate * (1 + (1 - battleCloseness)), config.maxCasualtyPercent);
    defenderCasualtyRate = Math.min(config.defenderCasualtyBase * dominanceRatio, config.maxCasualtyPercent);
  } else {
    attackerCasualtyRate = Math.min(config.attackerCasualtyBase * dominanceRatio, config.maxCasualtyPercent);
    defenderCasualtyRate = Math.min(config.defenderWinCasualtyRate * (1 + (1 - battleCloseness)), config.maxCasualtyPercent);
  }

  // Apply fort protection to defender casualties
  defenderCasualtyRate = defenderCasualtyRate * (1 - fortProtection);

  // Calculate unit casualties
  const attackerCasualties: UnitCasualty[] = [];
  let attackerTotalUnitsLost = 0;

  attacker.units.forEach((unit) => {
    const unitDef = UnitTypes.find((u) => u.type === unit.type && u.level === unit.level);
    if (!unitDef) return;

    const lost = Math.floor(unit.quantity * attackerCasualtyRate);
    if (lost > 0) {
      attackerCasualties.push({
        type: unit.type,
        level: unit.level,
        name: unitDef.name,
        quantity: unit.quantity,
        lost,
        remaining: unit.quantity - lost,
      });
      attackerTotalUnitsLost += lost;
    }
  });

  const defenderCasualties: UnitCasualty[] = [];
  let defenderTotalUnitsLost = 0;

  defender.units.forEach((unit) => {
    const unitDef = UnitTypes.find((u) => u.type === unit.type && u.level === unit.level);
    if (!unitDef) return;

    const lost = Math.floor(unit.quantity * defenderCasualtyRate);
    if (lost > 0) {
      defenderCasualties.push({
        type: unit.type,
        level: unit.level,
        name: unitDef.name,
        quantity: unit.quantity,
        lost,
        remaining: unit.quantity - lost,
      });
      defenderTotalUnitsLost += lost;
    }
  });

  return {
    attackerWins,
    effectiveOffense,
    totalDefense,
    goldStolen,
    goldStolenPercent,
    goldStealRange,
    fortDamage,
    fortHealthPercent,
    fortProtection,
    attackerXP,
    defenderXP,
    turnsUsed,
    turnBonus,
    battleCloseness,
    dominanceRatio,
    attackerCasualties,
    defenderCasualties,
    attackerCasualtyRate: Math.round(attackerCasualtyRate * 10000) / 100,
    defenderCasualtyRate: Math.round(defenderCasualtyRate * 10000) / 100,
    attackerTotalUnitsLost,
    defenderTotalUnitsLost,
    attackerBreakdown: atkBreakdown,
    defenderBreakdown: defBreakdown,
  };
}

// ─── Batch Simulation ───────────────────────────────────────────────────────

export function runBatchSimulation(
  attacker: SimulatorProfile,
  defender: SimulatorProfile,
  turnsUsed: number,
  config: SimulatorConfig,
  runs: number
): BatchSimResult {
  let wins = 0;
  let totalGoldStolen = 0;
  let totalFortDamage = 0;
  let totalAttackerXP = 0;
  let totalDefenderXP = 0;
  let totalAttackerCasualties = 0;
  let totalDefenderCasualties = 0;

  const goldBuckets: number[] = [];
  const atkCasBuckets: number[] = [];
  const defCasBuckets: number[] = [];
  const fortDmgBuckets: number[] = [];

  for (let i = 0; i < runs; i++) {
    const result = runSingleSimulation(attacker, defender, turnsUsed, config);

    if (result.attackerWins) wins++;
    totalGoldStolen += result.goldStolen;
    totalFortDamage += result.fortDamage;
    totalAttackerXP += result.attackerXP;
    totalDefenderXP += result.defenderXP;
    totalAttackerCasualties += result.attackerTotalUnitsLost;
    totalDefenderCasualties += result.defenderTotalUnitsLost;

    goldBuckets.push(result.goldStolen);
    atkCasBuckets.push(result.attackerTotalUnitsLost);
    defCasBuckets.push(result.defenderTotalUnitsLost);
    fortDmgBuckets.push(result.fortDamage);
  }

  // Create histograms
  const createBuckets = (data: number[], bucketCount: number = 10): { label: string; count: number }[] => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;
    const bucketSize = range / bucketCount;

    const buckets: { label: string; count: number }[] = [];
    for (let i = 0; i < bucketCount; i++) {
      const bucketMin = min + i * bucketSize;
      const bucketMax = min + (i + 1) * bucketSize;
      const count = data.filter((v) => v >= bucketMin && v < bucketMax).length;
      buckets.push({
        label: `${Math.floor(bucketMin)}-${Math.floor(bucketMax)}`,
        count,
      });
    }
    return buckets;
  };

  return {
    runs,
    winRate: wins / runs,
    avgGoldStolen: Math.floor(totalGoldStolen / runs),
    avgFortDamage: Math.floor(totalFortDamage / runs),
    avgAttackerXP: Math.floor(totalAttackerXP / runs),
    avgDefenderXP: Math.floor(totalDefenderXP / runs),
    avgAttackerCasualties: Math.floor(totalAttackerCasualties / runs),
    avgDefenderCasualties: Math.floor(totalDefenderCasualties / runs),
    goldStolenBuckets: createBuckets(goldBuckets),
    attackerCasualtyBuckets: createBuckets(atkCasBuckets),
    defenderCasualtyBuckets: createBuckets(defCasBuckets),
    fortDamageBuckets: createBuckets(fortDmgBuckets),
  };
}
