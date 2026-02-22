/**
 * Bot Strategy Engine — Pure functions for bot decision-making.
 * No framework or DB dependencies.
 */

import { ItemType, ItemUsage, UnitType, BuildingType } from '@openthrone/shared';
import { getUnitByTypeAndLevel } from './units';
import { getItemDefinition } from './items';
import { getFortificationByLevel } from './fortifications';
import {
  getEconomyUpgradeByLevel,
  getOffensiveUpgradeByLevel,
  getSpyUpgradeByLevel,
  getSentryUpgradeByLevel,
  getArmoryUpgradeByLevel,
  getHouseUpgradeByLevel,
} from './structure-upgrades';
import { getNextBuildingLevel, getMaxBuildingLevel } from './buildings';

// ─── Types ──────────────────────────────────────────────────────────────

export interface BotGameState {
  playerId: string;
  gold: number;
  goldInBank: number;
  attackTurns: number;
  citizens: number;
  workers: number;
  offenseUnits: number;
  defenseUnits: number;
  spyUnits: number;
  sentryUnits: number;

  // Buildings (new system)
  buildings: {
    FORTIFICATION: number;
    ARMORY: number;
    MINE: number;
    SPY_ACADEMY: number;
    HOUSING: number;
    MERCENARY_CAMP: number;
  };

  // Fortification details
  fortification: {
    level: number;
    hitpoints: number;
    maxHitpoints: number;
  };

  // Proficiency upgrades (old system, still in use)
  offenseUpgradeLevel: number;
  spyUpgradeLevel: number;
  sentryUpgradeLevel: number;

  // Proficiency points (Phase 0: Bot Intelligence)
  availablePoints: number;
  bonusPoints: {
    OFFENSE: number;
    DEFENSE: number;
    RECRUITING: number;
    CASUALTY: number;
    INTEL: number;
    INCOME: number;
    PRICES: number;
  };

  // Player stats
  level: number;
  experience: number;
  offense: number;
  defense: number;
  spy: number;
  sentry: number;

  // Intelligence tracking (Phase 1: Bot Intelligence)
  intelReports: {
    targetId: string;
    targetName: string;
    targetLevel: number;
    goldAmount: number | null; // Null if not revealed
    offenseStrength: number;
    defenseStrength: number;
    spiedAt: Date;
    revealPercent: number;
  }[];

  battleHistory: {
    targetId: string;
    targetName: string;
    isWin: boolean;
    goldStolen: number;
    unitsLost: number;
    timestamp: Date;
  }[];

  recentAttackers: {
    attackerId: string;
    attackerName: string;
    attackerLevel: number;
    timestamp: Date;
    goldLost: number;
  }[];

  // Alliance (Phase 4: Alliance System)
  allianceId: number | null;
  allianceName: string | null;

  // Flags
  canAutoRecruit: boolean;
  /** True if bot already recruited during a prior session today */
  recruitedToday: boolean;
  /** True if bot already trained units during a prior session today */
  trainedToday: boolean;
}

export interface BotTarget {
  id: string;
  displayName: string;
  level: number;
  rank: number;
  offense: number;
  defense: number;
  fortLevel: number;
  population: number;
  allianceId: number | null; // Phase 4: For alliance-aware targeting
}

export interface PrioritizedAction {
  type: string; // BotActionType
  weight: number;
  reasoning: string;
  params?: Record<string, any>;
}

type Strategy = 'WARRIOR' | 'TURTLE' | 'ECONOMIST' | 'SPYMASTER' | 'BALANCED';

// ─── Strategy Weight Tables ─────────────────────────────────────────────

interface StrategyWeights {
  autoRecruit: number;
  bankDeposit: number;
  trainOffense: number;
  trainDefense: number;
  trainSpy: number;
  trainSentry: number;
  trainWorkers: number;
  equipOffense: number;
  equipDefense: number;
  equipSpy: number;
  equipSentry: number;
  // Building upgrades
  upgradeFortification: number;
  upgradeArmory: number;
  upgradeMine: number;
  upgradeSpyAcademy: number;
  upgradeHousing: number;
  upgradeMercCamp: number;
  // Proficiency upgrades
  upgradeOffense: number;
  upgradeSpy: number;
  upgradeSentry: number;
  // Other actions
  repairFort: number;
  attackPlayer: number;
  spyMission: number;
  // Cosmetics & Mercenaries
  purchaseCosmetic: number;
  hireMercenaries: number;
  // Proficiency point allocation (Phase 0: Bot Intelligence)
  allocateOffense: number;
  allocateDefense: number;
  allocateRecruiting: number;
  allocateCasualty: number;
  allocateIntel: number;
  allocateIncome: number;
  allocatePrices: number;
  // Alliance (Phase 4: Alliance System)
  joinAlliance: number;
  createAlliance: number;
}

/**
 * Worker Target Percentages — Phase 3: Economic Strategy
 * Defines what % of total population should be workers for each strategy.
 * This scales naturally with level (more pop = more workers).
 */
const WORKER_TARGET_PERCENTAGES: Record<Strategy, number> = {
  WARRIOR: 20,      // 20% workers (low income, focus on military)
  TURTLE: 35,       // 35% workers (moderate income for fort repairs)
  ECONOMIST: 65,    // 65% workers (HIGH income maximization)
  SPYMASTER: 40,    // 40% workers (need income for spy missions)
  BALANCED: 45,     // 45% workers (balanced approach)
};

const STRATEGY_WEIGHTS: Record<Strategy, StrategyWeights> = {
  WARRIOR: {
    autoRecruit: 10,
    bankDeposit: 2,
    trainOffense: 10,
    trainDefense: 3,
    trainSpy: 2,
    trainSentry: 2,
    trainWorkers: 6,
    equipOffense: 9,
    equipDefense: 2,
    equipSpy: 1,
    equipSentry: 1,
    // Building upgrades
    upgradeFortification: 5,
    upgradeArmory: 4,
    upgradeMine: 3,
    upgradeSpyAcademy: 1,
    upgradeHousing: 3,
    upgradeMercCamp: 6,
    // Proficiency upgrades
    upgradeOffense: 8,
    upgradeSpy: 1,
    upgradeSentry: 1,
    // Other actions
    repairFort: 4,
    attackPlayer: 10,
    spyMission: 2,
    // Cosmetics & Mercenaries
    purchaseCosmetic: 1,
    hireMercenaries: 7, // Warriors love mercenaries for offense
    // Proficiency point allocation
    allocateOffense: 10,
    allocateDefense: 3,
    allocateRecruiting: 2,
    allocateCasualty: 5,
    allocateIntel: 1,
    allocateIncome: 2,
    allocatePrices: 1,
    // Alliance
    joinAlliance: 6, // Warriors value alliances for coordinated attacks
    createAlliance: 4, // Moderate interest in leading alliances
  },
  TURTLE: {
    autoRecruit: 10,
    bankDeposit: 4,
    trainOffense: 3,
    trainDefense: 10,
    trainSpy: 2,
    trainSentry: 7,
    trainWorkers: 8,
    equipOffense: 2,
    equipDefense: 9,
    equipSpy: 1,
    equipSentry: 6,
    // Building upgrades
    upgradeFortification: 10,
    upgradeArmory: 4,
    upgradeMine: 6,
    upgradeSpyAcademy: 2,
    upgradeHousing: 5,
    upgradeMercCamp: 2,
    // Proficiency upgrades
    upgradeOffense: 2,
    upgradeSpy: 2,
    upgradeSentry: 7,
    // Other actions
    repairFort: 10,
    attackPlayer: 2,
    spyMission: 1,
    // Cosmetics & Mercenaries
    purchaseCosmetic: 1,
    hireMercenaries: 3, // Some defense mercs, low priority
    // Proficiency point allocation
    allocateOffense: 2,
    allocateDefense: 10,
    allocateRecruiting: 4,
    allocateCasualty: 3,
    allocateIntel: 2,
    allocateIncome: 5,
    allocatePrices: 2,
    // Alliance
    joinAlliance: 8, // Turtles value alliances for protection
    createAlliance: 2, // Low interest in leading (prefer to follow)
  },
  ECONOMIST: {
    autoRecruit: 10,
    bankDeposit: 6,
    trainOffense: 2,
    trainDefense: 4,
    trainSpy: 1,
    trainSentry: 3,
    trainWorkers: 12,
    equipOffense: 1,
    equipDefense: 3,
    equipSpy: 1,
    equipSentry: 2,
    // Building upgrades
    upgradeFortification: 4,
    upgradeArmory: 2,
    upgradeMine: 10,
    upgradeSpyAcademy: 1,
    upgradeHousing: 10,
    upgradeMercCamp: 1,
    // Proficiency upgrades
    upgradeOffense: 1,
    upgradeSpy: 1,
    upgradeSentry: 2,
    // Other actions
    repairFort: 5,
    attackPlayer: 1,
    spyMission: 1,
    // Cosmetics & Mercenaries
    purchaseCosmetic: 2, // Economists have gold to spare
    hireMercenaries: 1, // Very low priority for economists
    // Proficiency point allocation
    allocateOffense: 1,
    allocateDefense: 2,
    allocateRecruiting: 4,
    allocateCasualty: 1,
    allocateIntel: 2,
    allocateIncome: 10,
    allocatePrices: 6,
    // Alliance
    joinAlliance: 4, // Economists less interested (prefer solo play)
    createAlliance: 1, // Very low - prefer lone wolf approach
  },
  SPYMASTER: {
    autoRecruit: 10,
    bankDeposit: 2,
    trainOffense: 2,
    trainDefense: 3,
    trainSpy: 10,
    trainSentry: 6,
    trainWorkers: 6,
    equipOffense: 1,
    equipDefense: 2,
    equipSpy: 10,
    equipSentry: 5,
    // Building upgrades
    upgradeFortification: 3,
    upgradeArmory: 3,
    upgradeMine: 4,
    upgradeSpyAcademy: 10,
    upgradeHousing: 4,
    upgradeMercCamp: 2,
    // Proficiency upgrades
    upgradeOffense: 1,
    upgradeSpy: 10,
    upgradeSentry: 6,
    // Other actions
    repairFort: 4,
    attackPlayer: 3,
    spyMission: 10,
    // Cosmetics & Mercenaries
    purchaseCosmetic: 1,
    hireMercenaries: 2, // Low priority for spymasters
    // Proficiency point allocation
    allocateOffense: 2,
    allocateDefense: 3,
    allocateRecruiting: 3,
    allocateCasualty: 2,
    allocateIntel: 10,
    allocateIncome: 4,
    allocatePrices: 3,
    // Alliance
    joinAlliance: 7, // Spymasters value alliances for intel sharing
    createAlliance: 5, // Moderate-high interest in building intel networks
  },
  BALANCED: {
    autoRecruit: 10,
    bankDeposit: 3,
    trainOffense: 6,
    trainDefense: 6,
    trainSpy: 4,
    trainSentry: 4,
    trainWorkers: 7,
    equipOffense: 5,
    equipDefense: 5,
    equipSpy: 3,
    equipSentry: 3,
    // Building upgrades
    upgradeFortification: 5,
    upgradeArmory: 4,
    upgradeMine: 5,
    upgradeSpyAcademy: 4,
    upgradeHousing: 5,
    upgradeMercCamp: 4,
    // Proficiency upgrades
    upgradeOffense: 5,
    upgradeSpy: 3,
    upgradeSentry: 3,
    // Other actions
    repairFort: 6,
    attackPlayer: 5,
    spyMission: 4,
    // Cosmetics & Mercenaries
    purchaseCosmetic: 1,
    hireMercenaries: 4, // Balanced approach to mercenaries
    // Proficiency point allocation
    allocateOffense: 5,
    allocateDefense: 5,
    allocateCasualty: 3,
    allocateRecruiting: 3,
    allocateIntel: 3,
    allocateIncome: 5,
    allocatePrices: 3,
    // Alliance
    joinAlliance: 5, // Balanced approach to alliances
    createAlliance: 3, // Moderate interest in creating alliances
  },
};

// ─── Deterministic Noise ────────────────────────────────────────────────

/**
 * Simple seeded pseudo-random number generator (mulberry32).
 * Returns a function that produces numbers in [0, 1).
 */
function seededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Add deterministic "human-like" imperfection to a value.
 * Returns value ± variance%, seeded for reproducibility.
 */
export function addHumanNoise(value: number, seed: number, variance: number = 0.15): number {
  const rng = seededRng(seed);
  const factor = 1 + (rng() * 2 - 1) * variance;
  return Math.max(0, Math.round(value * factor));
}

// ─── Core Decision Engine ───────────────────────────────────────────────

/**
 * Compute the total population (citizens + all military + workers).
 */
function getTotalPopulation(state: BotGameState): number {
  return state.citizens + state.workers + state.offenseUnits +
    state.defenseUnits + state.spyUnits + state.sentryUnits;
}

/**
 * Estimate the gold cost of a planned action (for budget tracking).
 */
function estimateActionCost(action: PrioritizedAction): number {
  switch (action.type) {
    case 'BANK_DEPOSIT':
      return Number(action.params?.amount ?? 0);
    case 'TRAIN_UNITS': {
      const units = action.params?.units as { unitType: string; level: number; quantity: number }[] | undefined;
      if (!units) return 0;
      return units.reduce((sum, u) => {
        const def = getUnitByTypeAndLevel(u.unitType as UnitType, u.level);
        return sum + (def ? def.cost * u.quantity : 0);
      }, 0);
    }
    case 'EQUIP_ITEMS': {
      const def = getItemDefinition(
        action.params?.itemType as ItemType,
        action.params?.usage as ItemUsage,
        action.params?.level ?? 1,
      );
      return def ? def.cost * (action.params?.quantity ?? 1) : 0;
    }
    case 'UPGRADE_STRUCTURE': {
      // Already checked affordability when generating, hard to re-lookup here
      // but the budget pass will still cap total spend correctly
      return 0;
    }
    case 'REPAIR_FORT': {
      const fortDef = getFortificationByLevel(1); // rough estimate
      return (action.params?.points ?? 0) * (fortDef?.costPerRepairPoint ?? 5);
    }
    case 'SPY_MISSION':
      return 3000; // Intel mission costs 3,000 gold
    default:
      return 0;
  }
}

/**
 * Given a strategy and current game state, produce a prioritized list of actions
 * the bot should attempt this session. Each action includes a reasoning string
 * for logging/debugging.
 */
export function prioritizeActions(
  strategy: Strategy,
  state: BotGameState,
  seed: number,
): PrioritizedAction[] {
  // Phase 5: Use performance-based adaptive weights instead of static base weights
  const weights = getAdaptedWeights(STRATEGY_WEIGHTS[strategy], state);
  const rng = seededRng(seed);
  const actions: PrioritizedAction[] = [];

  const totalPop = getTotalPopulation(state);
  const isEarlyGame = totalPop < 1000;

  // ── Early-Game Weight Adjustments ──────────────────────────────────
  // When population is low, every strategy should prioritize economic
  // foundation: workers (for gold income) and defense (to protect gold).
  // Attacking and expensive equips are de-prioritized.
  if (isEarlyGame) {
    // Boost economic foundation
    weights.trainWorkers = Math.max(weights.trainWorkers, 10);
    weights.trainDefense = Math.max(weights.trainDefense, 7);
    weights.upgradeMine = Math.max(weights.upgradeMine, 7);
    weights.upgradeHousing = Math.max(weights.upgradeHousing, 7);
    weights.bankDeposit = Math.max(weights.bankDeposit, 6);
    // Cap aggressive training below workers so budget goes to economy first
    weights.trainOffense = Math.min(weights.trainOffense, 5);
    weights.trainSpy = Math.min(weights.trainSpy, 4);
    weights.trainSentry = Math.min(weights.trainSentry, 4);
    // Suppress expensive/aggressive actions early
    weights.attackPlayer = Math.min(weights.attackPlayer, 2);
    weights.spyMission = Math.min(weights.spyMission, 2);
    weights.equipOffense = Math.min(weights.equipOffense, 2);
    weights.equipDefense = Math.min(weights.equipDefense, 2);
    weights.equipSpy = Math.min(weights.equipSpy, 1);
    weights.equipSentry = Math.min(weights.equipSentry, 1);
  }

  // ── Allocate Proficiency Points (HIGHEST PRIORITY — Phase 0: Bot Intelligence) ──
  if (state.availablePoints > 0) {
    // Determine best bonus type based on strategy weights
    const bonusOptions: { type: string; weight: number }[] = [
      { type: 'OFFENSE', weight: weights.allocateOffense },
      { type: 'DEFENSE', weight: weights.allocateDefense },
      { type: 'RECRUITING', weight: weights.allocateRecruiting },
      { type: 'CASUALTY', weight: weights.allocateCasualty },
      { type: 'INTEL', weight: weights.allocateIntel },
      { type: 'INCOME', weight: weights.allocateIncome },
      { type: 'PRICES', weight: weights.allocatePrices },
    ];

    // Sort by weight descending
    bonusOptions.sort((a, b) => b.weight - a.weight);

    // Pick top 3 options and randomize slightly to add variety
    const topOptions = bonusOptions.slice(0, 3);
    const selected = topOptions[Math.floor(rng() * topOptions.length)]!;

    actions.push({
      type: 'ALLOCATE_BONUS_POINTS',
      weight: 1000, // VERY HIGH PRIORITY (always spend points immediately)
      reasoning: `Has ${state.availablePoints} unspent proficiency point${state.availablePoints > 1 ? 's' : ''} — allocate to ${selected.type} (strategy: ${strategy}).`,
      params: { bonusType: selected.type },
    });
  }

  // ── Auto-Recruit (critical for growth — always top priority if not done today) ──
  if (state.canAutoRecruit && !state.recruitedToday) {
    actions.push({
      type: 'AUTO_RECRUIT',
      weight: 20 + rng() * 2, // Always highest priority — free citizens are essential for growth
      reasoning: 'Daily auto-recruit not yet done — free citizens are critical for growth.',
    });
  }

  // ── Bank Deposit ──
  if (state.gold > 1000) {
    const depositPct = 0.4 + rng() * 0.3; // 40-70% of gold
    const amount = Math.floor(state.gold * depositPct * 0.8); // stay under 80% cap
    if (amount > 0) {
      actions.push({
        type: 'BANK_DEPOSIT',
        weight: weights.bankDeposit + rng() * 2,
        reasoning: `Banking ${amount.toLocaleString()} gold (${Math.round(depositPct * 100)}% of on-hand).`,
        params: { amount: String(amount) },
      });
    }
  }

  // ── Train Units (critical for growth — boosted if not trained today) ──
  if (state.citizens >= 1) {
    const trainBoost = state.trainedToday ? 0 : 5; // Big boost if haven't trained today

    // Phase 3: Economic Strategy — Enforce worker percentage targets
    const workerTargetPercent = WORKER_TARGET_PERCENTAGES[strategy];
    const workerTarget = Math.floor(totalPop * (workerTargetPercent / 100));
    const workerDeficit = Math.max(0, workerTarget - state.workers);

    if (workerDeficit > 0 && state.citizens >= 10) {
      // Train workers to hit percentage target (high priority)
      const trainCount = Math.min(workerDeficit, state.citizens, 50);
      const workerDef = getUnitByTypeAndLevel(UnitType.WORKER, 1);
      if (workerDef) {
        const costPer = workerDef.cost;
        const affordable = Math.min(trainCount, Math.floor(state.gold / costPer));
        if (affordable > 0) {
          actions.push({
            type: 'TRAIN_UNITS',
            weight: weights.trainWorkers + rng() * 2 + trainBoost + 3, // +3 bonus for hitting target
            reasoning: `Need ${workerDeficit} more workers to hit ${workerTargetPercent}% target (${state.workers}/${workerTarget}) — train ${affordable} at ${costPer.toLocaleString()}/ea.${!state.trainedToday ? ' (Priority: haven\'t trained today)' : ''}`,
            params: { units: [{ unitType: 'WORKER', level: 1, quantity: affordable }] },
          });
        }
      }
    }

    // Train other unit types using standard allocation
    const allocation = calculateTrainingAllocation(strategy, state, seed, isEarlyGame);
    for (const [unitType, qty] of Object.entries(allocation)) {
      if (qty <= 0 || unitType === 'WORKER') continue; // Skip workers (handled above)
      const unitDef = getUnitByTypeAndLevel(unitType as UnitType, 1);
      if (!unitDef) continue;
      const costPer = unitDef.cost;
      const affordable = Math.min(qty, Math.floor(state.gold / costPer));
      if (affordable <= 0) continue;
      const wKey = unitType === 'OFFENSE' ? 'trainOffense' :
        unitType === 'DEFENSE' ? 'trainDefense' :
        unitType === 'SPY' ? 'trainSpy' : 'trainSentry';
      actions.push({
        type: 'TRAIN_UNITS',
        weight: weights[wKey] + rng() * 2 + trainBoost,
        reasoning: `Train ${affordable} ${unitType} units at ${costPer.toLocaleString()}/ea (${(affordable * costPer).toLocaleString()} gold).${!state.trainedToday ? ' (Priority: haven\'t trained today)' : ''}${isEarlyGame ? ' [Early-game]' : ''}`,
        params: { units: [{ unitType, level: 1, quantity: affordable }] },
      });
    }
  }

  // ── Equip Items ──
  {
    const equipActions = getEquipActions(strategy, state, seed, weights);
    for (const eq of equipActions) {
      actions.push(eq);
    }
  }

  // ── Structure Upgrades ──
  {
    const upgrades = getStructureUpgradeActions(strategy, state, weights, rng);
    for (const u of upgrades) {
      actions.push(u);
    }
  }

  // ── Repair Fort (high priority when damaged) ──
  if (state.fortification.hitpoints < state.fortification.maxHitpoints) {
    const fortDef = getFortificationByLevel(state.fortification.level);
    const costPerHP = fortDef?.costPerRepairPoint ?? 5;
    const needed = state.fortification.maxHitpoints - state.fortification.hitpoints;
    const affordable = Math.floor(state.gold / costPerHP);
    const repairPoints = Math.min(needed, affordable);
    if (repairPoints > 0) {
      const totalCost = repairPoints * costPerHP;
      const hpPct = state.fortification.hitpoints / state.fortification.maxHitpoints;
      // Scale urgency: <30% HP = +10 (critical), <60% = +5, <100% = +2
      const urgencyBoost = hpPct < 0.3 ? 10 : hpPct < 0.6 ? 5 : 2;
      actions.push({
        type: 'REPAIR_FORT',
        weight: weights.repairFort + rng() * 2 + urgencyBoost,
        reasoning: `Fort at ${state.fortification.hitpoints}/${state.fortification.maxHitpoints} HP (${Math.round(hpPct * 100)}%) — repair ${repairPoints} pts (${totalCost.toLocaleString()} gold at ${costPerHP}/HP).${hpPct < 0.3 ? ' CRITICAL!' : ''}`,
        params: { points: repairPoints },
      });
    }
  }

  // ── Attack Player (skip in early game — focus on growing) ──
  if (!isEarlyGame && state.attackTurns >= 1 && state.offenseUnits > 0) {
    const turns = Math.min(
      Math.max(1, Math.floor(1 + rng() * 3)),
      state.attackTurns,
    );
    actions.push({
      type: 'ATTACK_PLAYER',
      weight: weights.attackPlayer + rng() * 3,
      reasoning: `Has ${state.attackTurns} attack turns and ${state.offenseUnits} offense units — attack with ${turns} turns.`,
      params: { turns },
    });
  }

  // ── Spy Mission (skip in early game; costs 3,000 gold + 2 turns) ──
  if (!isEarlyGame && state.attackTurns >= 2 && state.spyUnits >= 1 && state.gold >= 3000) {
    actions.push({
      type: 'SPY_MISSION',
      weight: weights.spyMission + rng() * 3,
      reasoning: `Has ${state.spyUnits} spy units and ${state.gold.toLocaleString()} gold — run intel mission (3,000 gold).`,
      params: { type: 'INTEL', spiesSent: Math.min(state.spyUnits, 3) },
    });
  }

  // ── Create Alliance (Phase 4: Alliance System) ──
  if (!state.allianceId && state.level >= 10) {
    // Not in an alliance and level 10+ — consider creating one
    actions.push({
      type: 'CREATE_ALLIANCE',
      weight: weights.createAlliance + rng() * 1.5,
      reasoning: `Level ${state.level}, no alliance — consider founding a new alliance.`,
      params: {},
    });
  }

  // ── Join Alliance (Phase 4: Alliance System) ──
  if (!state.allianceId && state.level >= 5) {
    // Not in an alliance and level 5+ — consider joining
    actions.push({
      type: 'JOIN_ALLIANCE',
      weight: weights.joinAlliance + rng() * 2,
      reasoning: `Level ${state.level}, not in an alliance — search for one to join.`,
      params: {},
    });
  }

  // ── Purchase Cosmetics (very low priority — wealth flex when rich) ──
  if (!isEarlyGame && state.gold > 100000 && rng() > 0.7) {
    // Only 30% chance to even consider cosmetics per session
    // Pick a random cosmetic type to purchase
    const cosmeticTypes = ['NAME_COLOR', 'AVATAR_ICON'];
    const cosmeticType = cosmeticTypes[Math.floor(rng() * cosmeticTypes.length)];
    actions.push({
      type: 'PURCHASE_COSMETIC',
      weight: weights.purchaseCosmetic + rng(),
      reasoning: `Very wealthy (${state.gold.toLocaleString()} gold) — consider purchasing cosmetics for style.`,
      params: { cosmeticType },
    });
  }

  // ── Hire Mercenaries (if mercenary camp is built and bot has gold) ──
  if (!isEarlyGame && state.buildings.MERCENARY_CAMP > 0 && state.gold > 50000) {
    const campLevel = state.buildings.MERCENARY_CAMP;
    const maxMercs = campLevel * 5; // Level 1: 5 mercs, Level 2: 10, Level 3: 15
    const goldPerMerc = 10000; // Estimated cost per mercenary
    const affordable = Math.floor(state.gold / goldPerMerc);
    const quantity = Math.min(maxMercs, affordable, 10); // Cap at 10 per session
    if (quantity > 0) {
      actions.push({
        type: 'HIRE_MERCENARIES',
        weight: weights.hireMercenaries + rng() * 2,
        reasoning: `Mercenary Camp Lv${campLevel} available — hire ${quantity} mercenaries for upcoming battles (est. ${(quantity * goldPerMerc).toLocaleString()} gold).`,
        params: { quantity },
      });
    }
  }

  // Sort by weight descending
  actions.sort((a, b) => b.weight - a.weight);

  // ── Gold Budget Pass ───────────────────────────────────────────────
  // Walk sorted actions and drop any that would exceed remaining gold.
  // This prevents the executor from hitting "not enough gold" errors
  // when multiple actions compete for the same gold pool.
  let goldBudget = state.gold;
  const budgetedActions: PrioritizedAction[] = [];

  for (const action of actions) {
    const cost = estimateActionCost(action);
    if (cost > 0 && cost > goldBudget) {
      // Skip this action — can't afford it after higher-priority spending
      continue;
    }
    goldBudget -= cost;
    budgetedActions.push(action);
  }

  return budgetedActions;
}

// ─── Training Allocation ────────────────────────────────────────────────

/**
 * Decide how to distribute available citizens across unit types.
 * In early-game (pop < 1k), heavily favours workers and defense
 * regardless of strategy — bots need income before they can fight.
 */
export function calculateTrainingAllocation(
  strategy: Strategy,
  state: BotGameState,
  seed: number,
  isEarlyGame: boolean = false,
): Record<string, number> {
  const rng = seededRng(seed + 1000);
  const available = Math.floor(state.citizens * (0.5 + rng() * 0.3)); // train 50-80% of citizens
  if (available <= 0) return {};

  // Early-game: 50% workers, 30% defense, 10% offense, 5% spy, 5% sentry
  // This builds an economic base before specializing
  const trainWeights = isEarlyGame
    ? { WORKER: 50, DEFENSE: 30, OFFENSE: 10, SPY: 5, SENTRY: 5 }
    : {
        WORKER: STRATEGY_WEIGHTS[strategy].trainWorkers,
        OFFENSE: STRATEGY_WEIGHTS[strategy].trainOffense,
        DEFENSE: STRATEGY_WEIGHTS[strategy].trainDefense,
        SPY: STRATEGY_WEIGHTS[strategy].trainSpy,
        SENTRY: STRATEGY_WEIGHTS[strategy].trainSentry,
      };

  const totalWeight = Object.values(trainWeights).reduce((a, b) => a + b, 0);

  const result: Record<string, number> = {};
  for (const [unitType, w] of Object.entries(trainWeights)) {
    const qty = Math.floor(available * (w / totalWeight));
    if (qty > 0) result[unitType] = qty;
  }

  return result;
}

// ─── Bank Amount ────────────────────────────────────────────────────────

/**
 * Calculate how much gold to deposit. Bots aren't perfect — they deposit
 * a "reasonable" but imprecise amount.
 */
export function calculateBankAmount(
  strategy: Strategy,
  goldOnHand: number,
  seed: number,
): number {
  if (goldOnHand <= 1000) return 0;
  const rng = seededRng(seed + 2000);

  // Economists bank more aggressively, warriors less
  const basePct = strategy === 'ECONOMIST' ? 0.65 :
    strategy === 'TURTLE' ? 0.55 :
    strategy === 'WARRIOR' ? 0.3 :
    strategy === 'SPYMASTER' ? 0.4 : 0.45;

  const pct = basePct + (rng() * 0.15 - 0.075); // ±7.5%
  const amount = Math.floor(goldOnHand * pct * 0.8); // stay under 80% cap
  return Math.max(0, amount);
}

// ─── Target Scoring ─────────────────────────────────────────────────────

/**
 * Score a potential attack target. Higher = more desirable.
 * Basic scoring without intelligence data.
 */
export function scoreTarget(
  strategy: Strategy,
  attacker: { offense: number; level: number },
  target: BotTarget,
): number {
  // Level difference penalty (prefer targets near our level)
  const levelDiff = Math.abs(attacker.level - target.level);
  const levelPenalty = levelDiff * 5;

  // Offense vs defense advantage
  const advantageRatio = target.defense > 0 ? attacker.offense / target.defense : 10;
  const advantageScore = Math.min(advantageRatio * 20, 60);

  // Strategy-specific bonuses
  let strategyBonus = 0;
  if (strategy === 'WARRIOR') {
    // Warriors prefer weaker targets for easy wins
    strategyBonus = advantageRatio > 1.5 ? 15 : 0;
  } else if (strategy === 'TURTLE' || strategy === 'ECONOMIST') {
    // These rarely attack, so prefer very easy targets
    strategyBonus = advantageRatio > 2 ? 10 : -20;
  }

  // Lower fort = easier target
  const fortPenalty = target.fortLevel * 2;

  return advantageScore + strategyBonus - levelPenalty - fortPenalty;
}

/**
 * Phase 1: Intelligence-based target scoring.
 * Uses intel reports, battle history, and threat tracking to make smarter decisions.
 */
export function calculateTargetScore(
  strategy: Strategy,
  state: BotGameState,
  target: BotTarget,
): number {
  // Phase 4: NEVER attack alliance members
  if (state.allianceId && target.allianceId === state.allianceId) {
    return -9999; // Effectively exclude alliance members from targeting
  }

  let score = 0;

  // Base score from standard scoring
  score += scoreTarget(strategy, { offense: state.offense, level: state.level }, target);

  // ── Intel-based bonuses ──
  const intel = state.intelReports.find((r) => r.targetId === target.id);
  if (intel) {
    // +30 bonus for having recent intel (we know what we're attacking)
    score += 30;

    // Phase 3: Prioritize wealthy targets revealed by intel (SCALED bonuses)
    if (intel.goldAmount !== null) {
      if (intel.goldAmount > 500000) {
        score += 60; // MASSIVE bonus for very wealthy targets (500k+)
      } else if (intel.goldAmount > 200000) {
        score += 40; // Large bonus for wealthy targets (200k+)
      } else if (intel.goldAmount > 100000) {
        score += 30; // Good bonus for targets with 100k+
      } else if (intel.goldAmount > 50000) {
        score += 20; // Moderate bonus for targets with 50k+
      } else if (intel.goldAmount > 10000) {
        score += 10; // Small bonus for targets with 10k+
      }
    }

    // +10 bonus for high reveal percentage (confident intel)
    if (intel.revealPercent >= 70) {
      score += 10;
    }

    // Adjust advantage score based on actual intel data
    if (intel.offenseStrength > 0 && intel.defenseStrength > 0) {
      const intelAdvantage = state.offense / intel.defenseStrength;
      if (intelAdvantage > 1.5) {
        score += 15; // Strong advantage based on intel
      } else if (intelAdvantage < 0.8) {
        score -= 20; // Likely to lose based on intel
      }
    }
  } else {
    // -15 penalty for no intel (attacking blind)
    score -= 15;
  }

  // ── Battle history bonuses/penalties ──
  const pastBattles = state.battleHistory.filter((b) => b.targetId === target.id);
  if (pastBattles.length > 0) {
    const recentBattles = pastBattles.slice(0, 3); // Last 3 battles
    const wins = recentBattles.filter((b) => b.isWin).length;
    const losses = recentBattles.length - wins;

    if (wins > losses) {
      // +10 per win (we've beaten them before)
      score += wins * 10;
    } else {
      // -15 per loss (they beat us before, avoid)
      score -= losses * 15;
    }

    // Penalty for attacking same target too often (diminishing returns)
    if (pastBattles.length > 5) {
      score -= 10;
    }
  }

  // ── Revenge bonus (HIGHEST PRIORITY for recent attacks) ──
  const revengeTarget = state.recentAttackers.find((a) => a.attackerId === target.id);
  if (revengeTarget) {
    const hoursSinceAttack = (Date.now() - revengeTarget.timestamp.getTime()) / (1000 * 60 * 60);

    if (hoursSinceAttack < 24) {
      // +50 MASSIVE bonus for revenge within 24 hours
      score += 50;

      // Extra bonus based on gold lost (more gold lost = higher revenge priority)
      if (revengeTarget.goldLost > 50000) {
        score += 20;
      } else if (revengeTarget.goldLost > 20000) {
        score += 10;
      }
    } else if (hoursSinceAttack < 72) {
      // +20 bonus for revenge within 3 days
      score += 20;
    }
  }

  // ── Strategy-specific intelligence preferences ──
  if (strategy === 'WARRIOR' && intel) {
    // Warriors prefer targets with known gold (profitable raids)
    if (intel.goldAmount !== null && intel.goldAmount > 50000) {
      score += 15; // Extra bonus for warriors attacking wealthy targets
    }
  } else if (strategy === 'ECONOMIST' && intel) {
    // Phase 3: Economists RARELY attack, but when they do, they want BIG payouts
    if (intel.goldAmount !== null && intel.goldAmount > 200000) {
      score += 25; // Extra bonus for economists hitting jackpot targets
    } else if (intel.goldAmount !== null && intel.goldAmount < 50000) {
      score -= 30; // Heavily penalize economists attacking poor targets (not worth the risk)
    }
  } else if (strategy === 'SPYMASTER' && !intel) {
    // Spymasters heavily penalized for attacking without intel
    score -= 30;
  }

  return Math.round(score);
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getEquipActions(
  _strategy: Strategy,
  state: BotGameState,
  seed: number,
  weights: StrategyWeights,
): PrioritizedAction[] {
  const rng = seededRng(seed + 3000);
  const actions: PrioritizedAction[] = [];

  const equipEntries: { units: number; usage: string; wKey: keyof StrategyWeights; seedOff: number }[] = [
    { units: state.offenseUnits, usage: 'OFFENSE', wKey: 'equipOffense', seedOff: 3001 },
    { units: state.defenseUnits, usage: 'DEFENSE', wKey: 'equipDefense', seedOff: 3002 },
    { units: state.spyUnits, usage: 'SPY', wKey: 'equipSpy', seedOff: 3003 },
  ];

  for (const { units, usage, wKey, seedOff } of equipEntries) {
    if (units <= 0) continue;
    const itemDef = getItemDefinition(ItemType.WEAPON, usage as ItemUsage, 1);
    if (!itemDef) continue;
    const costPer = itemDef.cost;
    const desiredQty = Math.max(1, addHumanNoise(Math.min(units, 10), seed + seedOff, 0.2));
    const affordable = Math.min(desiredQty, Math.floor(state.gold / costPer));
    if (affordable <= 0) continue;
    actions.push({
      type: 'EQUIP_ITEMS',
      weight: weights[wKey] + rng() * 2,
      reasoning: `Equip ${affordable} ${usage} weapons at ${costPer.toLocaleString()}/ea (${(affordable * costPer).toLocaleString()} gold).`,
      params: { itemType: 'WEAPON', usage, level: 1, quantity: affordable },
    });
  }

  return actions;
}

function getStructureUpgradeActions(
  _strategy: Strategy,
  state: BotGameState,
  weights: StrategyWeights,
  rng: () => number,
): PrioritizedAction[] {
  const actions: PrioritizedAction[] = [];

  // Proficiency upgrades (old system, still active)
  const proficiencyUpgrades: {
    type: string;
    currentLevel: number;
    maxLevel: number;
    wKey: keyof StrategyWeights;
    lookup: (level: number) => { cost: number; name: string } | undefined;
    label: string;
  }[] = [
    { type: 'OFFENSE', currentLevel: state.offenseUpgradeLevel, maxLevel: 22, wKey: 'upgradeOffense', lookup: getOffensiveUpgradeByLevel, label: 'Offense' },
    { type: 'SPY', currentLevel: state.spyUpgradeLevel, maxLevel: 22, wKey: 'upgradeSpy', lookup: getSpyUpgradeByLevel, label: 'Spy' },
    { type: 'SENTRY', currentLevel: state.sentryUpgradeLevel, maxLevel: 22, wKey: 'upgradeSentry', lookup: getSentryUpgradeByLevel, label: 'Sentry' },
  ];

  for (const u of proficiencyUpgrades) {
    if (u.currentLevel >= u.maxLevel) continue;
    const nextDef = u.lookup(u.currentLevel + 1);
    if (!nextDef || nextDef.cost <= 0) continue;
    if (state.gold < nextDef.cost) continue; // Can't afford
    actions.push({
      type: 'UPGRADE_STRUCTURE',
      weight: weights[u.wKey] + rng() * 2,
      reasoning: `${u.label} Lv${u.currentLevel} → ${nextDef.name} (${nextDef.cost.toLocaleString()} gold).`,
      params: { upgradeType: u.type },
    });
  }

  // Building upgrades (new system)
  const buildingUpgrades: {
    buildingType: BuildingType;
    currentLevel: number;
    wKey: keyof StrategyWeights;
    label: string;
  }[] = [
    { buildingType: BuildingType.FORTIFICATION, currentLevel: state.buildings.FORTIFICATION, wKey: 'upgradeFortification', label: 'Fortification' },
    { buildingType: BuildingType.ARMORY, currentLevel: state.buildings.ARMORY, wKey: 'upgradeArmory', label: 'Armory' },
    { buildingType: BuildingType.MINE, currentLevel: state.buildings.MINE, wKey: 'upgradeMine', label: 'Mine' },
    { buildingType: BuildingType.SPY_ACADEMY, currentLevel: state.buildings.SPY_ACADEMY, wKey: 'upgradeSpyAcademy', label: 'Spy Academy' },
    { buildingType: BuildingType.HOUSING, currentLevel: state.buildings.HOUSING, wKey: 'upgradeHousing', label: 'Housing' },
    { buildingType: BuildingType.MERCENARY_CAMP, currentLevel: state.buildings.MERCENARY_CAMP, wKey: 'upgradeMercCamp', label: 'Mercenary Camp' },
  ];

  for (const b of buildingUpgrades) {
    const maxLevel = getMaxBuildingLevel(b.buildingType);
    if (b.currentLevel >= maxLevel) continue;
    const nextDef = getNextBuildingLevel(b.buildingType, b.currentLevel);
    if (!nextDef || nextDef.cost <= 0) continue;
    if (state.gold < nextDef.cost) continue; // Can't afford
    actions.push({
      type: 'UPGRADE_BUILDING',
      weight: weights[b.wKey] + rng() * 2,
      reasoning: `${b.label} Lv${b.currentLevel} → Lv${nextDef.level} (${nextDef.cost.toLocaleString()} gold).`,
      params: { buildingType: b.buildingType },
    });
  }

  return actions;
}

// ─── Phase 5: Performance Metrics & Adaptive Strategy ──────────────────

/**
 * Performance metrics calculated from battle history and threat tracking.
 * Used to adapt strategy weights dynamically based on bot performance.
 */
export interface BotPerformanceMetrics {
  winRate: number; // 0-1 (Last 50 battles)
  avgGoldStolen: number; // Average gold stolen per attack
  avgGoldLost: number; // Average gold lost to attackers
  netGoldFlow: number; // stolen - lost (positive = gaining gold, negative = losing)
  battlesAnalyzed: number; // How many battles were analyzed
  threatsAnalyzed: number; // How many threat records were analyzed
}

/**
 * Calculate performance metrics from battle history and recent attackers.
 * Returns metrics for the last 50 battles and 50 threat records.
 */
export function calculatePerformanceMetrics(state: BotGameState): BotPerformanceMetrics {
  // Analyze last 50 battles (or fewer if bot is new)
  const battles = state.battleHistory.slice(0, 50);
  const wins = battles.filter((b) => b.isWin).length;
  const winRate = battles.length > 0 ? wins / battles.length : 0.5; // Default 50% for new bots

  const totalGoldStolen = battles.reduce((sum, b) => sum + b.goldStolen, 0);
  const avgGoldStolen = battles.length > 0 ? totalGoldStolen / battles.length : 0;

  // Analyze last 50 threat records (attacks received)
  const threats = state.recentAttackers.slice(0, 50);
  const totalGoldLost = threats.reduce((sum, t) => sum + t.goldLost, 0);
  const avgGoldLost = threats.length > 0 ? totalGoldLost / threats.length : 0;

  const netGoldFlow = avgGoldStolen - avgGoldLost;

  return {
    winRate,
    avgGoldStolen,
    avgGoldLost,
    netGoldFlow,
    battlesAnalyzed: battles.length,
    threatsAnalyzed: threats.length,
  };
}

/**
 * Detect if bot is stuck in a non-productive pattern.
 * Returns true if bot should diversify its strategy.
 */
export function detectStuckPattern(state: BotGameState): boolean {
  // Need at least 10 battles to detect patterns
  if (state.battleHistory.length < 10) {
    return false;
  }

  const recent = state.battleHistory.slice(0, 10);

  // Pattern 1: Attacking same 1-2 targets repeatedly (tunnel vision)
  const uniqueTargets = new Set(recent.map((b) => b.targetId));
  if (uniqueTargets.size <= 2) {
    return true; // Stuck attacking same targets
  }

  // Pattern 2: Very low win rate in recent battles (strategy not working)
  const recentWins = recent.filter((b) => b.isWin).length;
  const recentWinRate = recentWins / recent.length;
  if (recentWinRate < 0.2) {
    return true; // Losing 80%+ of battles
  }

  // Pattern 3: Losing significant units in recent battles (bad target selection)
  const recentLosses = recent.filter((b) => !b.isWin);
  if (recentLosses.length >= 7) {
    // Lost 7+ of last 10 battles
    const avgUnitsLost = recentLosses.reduce((sum, b) => sum + b.unitsLost, 0) / recentLosses.length;
    if (avgUnitsLost > 50) {
      return true; // Losing too many units per battle
    }
  }

  return false;
}

/**
 * Get list of targets to temporarily avoid (attacked recently without success).
 * Bots should diversify and try new targets instead of repeating mistakes.
 */
export function getTemporaryBlacklist(state: BotGameState): string[] {
  if (!detectStuckPattern(state)) {
    return []; // Not stuck, no need to blacklist
  }

  // Blacklist targets from last 10 battles that resulted in losses
  const recentLosses = state.battleHistory
    .slice(0, 10)
    .filter((b) => !b.isWin)
    .map((b) => b.targetId);

  return [...new Set(recentLosses)]; // Return unique target IDs
}

/**
 * Adapt strategy weights based on performance metrics.
 * Returns weight adjustments to apply on top of base strategy weights.
 *
 * Adaptation rules:
 * - Low win rate (<30%) → boost defense training, reduce attack aggression
 * - Losing gold (net negative) → boost fort repairs and fortification upgrades
 * - Stuck in pattern → temporary target blacklist (handled separately)
 */
export function adaptStrategyWeights(
  state: BotGameState,
  metrics: BotPerformanceMetrics,
): Partial<StrategyWeights> {
  const adjustments: Partial<StrategyWeights> = {};

  // Need at least 10 battles for meaningful adaptation
  if (metrics.battlesAnalyzed < 10) {
    return adjustments; // Not enough data yet
  }

  // ── Adaptation Rule 1: Low Win Rate → Boost Defense ──
  if (metrics.winRate < 0.3) {
    adjustments.trainDefense = 5; // Boost defense training
    adjustments.upgradeFortification = 3; // Boost fort upgrades
    adjustments.attackPlayer = -3; // Reduce attack aggression
    adjustments.repairFort = 3; // Prioritize fort repairs
  }

  // ── Adaptation Rule 2: Losing Gold → Boost Fortifications ──
  if (metrics.netGoldFlow < -10000) {
    // Losing 10k+ gold per battle on average
    adjustments.repairFort = 5; // HIGH priority on repairs
    adjustments.upgradeFortification = 4; // Upgrade fort
    adjustments.trainSentry = 3; // Train sentries to prevent gold theft
    adjustments.bankDeposit = 2; // Bank more gold to protect it
  }

  // ── Adaptation Rule 3: High Win Rate but Low Gold → Improve Target Selection ──
  if (metrics.winRate > 0.7 && metrics.avgGoldStolen < 5000) {
    // Winning battles but not getting much gold
    adjustments.spyMission = 4; // Spy more to find wealthy targets
    adjustments.trainSpy = 2; // Train more spies for better intel
  }

  // ── Adaptation Rule 4: Taking Heavy Losses → Train More Units ──
  if (metrics.netGoldFlow < -20000) {
    // Hemorrhaging gold
    adjustments.trainOffense = -2; // Stop wasting units on attacks
    adjustments.trainDefense = 6; // Focus on defense
    adjustments.trainWorkers = 4; // Boost income to recover
  }

  return adjustments;
}

/**
 * Apply performance-based adaptations to base strategy weights.
 * This is called in prioritizeActions() to modify weights dynamically.
 */
export function getAdaptedWeights(
  baseWeights: StrategyWeights,
  state: BotGameState,
): StrategyWeights {
  // Calculate performance metrics
  const metrics = calculatePerformanceMetrics(state);

  // Get weight adaptations based on performance
  const adaptations = adaptStrategyWeights(state, metrics);

  // Merge adaptations into base weights
  const adapted = { ...baseWeights };
  for (const [key, adjustment] of Object.entries(adaptations)) {
    const k = key as keyof StrategyWeights;
    adapted[k] = Math.max(0, adapted[k] + adjustment); // Never go negative
  }

  return adapted;
}
