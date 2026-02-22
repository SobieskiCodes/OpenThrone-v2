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

  // Player stats
  level: number;
  experience: number;
  offense: number;
  defense: number;
  spy: number;
  sentry: number;

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
}

const STRATEGY_WEIGHTS: Record<Strategy, StrategyWeights> = {
  WARRIOR: {
    autoRecruit: 10,
    bankDeposit: 4,
    trainOffense: 10,
    trainDefense: 3,
    trainSpy: 2,
    trainSentry: 2,
    trainWorkers: 3,
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
  },
  TURTLE: {
    autoRecruit: 10,
    bankDeposit: 8,
    trainOffense: 3,
    trainDefense: 10,
    trainSpy: 2,
    trainSentry: 7,
    trainWorkers: 6,
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
  },
  ECONOMIST: {
    autoRecruit: 10,
    bankDeposit: 10,
    trainOffense: 2,
    trainDefense: 4,
    trainSpy: 1,
    trainSentry: 3,
    trainWorkers: 10,
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
  },
  SPYMASTER: {
    autoRecruit: 10,
    bankDeposit: 5,
    trainOffense: 2,
    trainDefense: 3,
    trainSpy: 10,
    trainSentry: 6,
    trainWorkers: 4,
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
  },
  BALANCED: {
    autoRecruit: 10,
    bankDeposit: 6,
    trainOffense: 6,
    trainDefense: 6,
    trainSpy: 4,
    trainSentry: 4,
    trainWorkers: 5,
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
  const weights = { ...STRATEGY_WEIGHTS[strategy] };
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
    const allocation = calculateTrainingAllocation(strategy, state, seed, isEarlyGame);
    for (const [unitType, qty] of Object.entries(allocation)) {
      if (qty <= 0) continue;
      const unitDef = getUnitByTypeAndLevel(unitType as UnitType, 1);
      if (!unitDef) continue;
      const costPer = unitDef.cost;
      const affordable = Math.min(qty, Math.floor(state.gold / costPer));
      if (affordable <= 0) continue;
      const wKey = unitType === 'WORKER' ? 'trainWorkers' :
        unitType === 'OFFENSE' ? 'trainOffense' :
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
