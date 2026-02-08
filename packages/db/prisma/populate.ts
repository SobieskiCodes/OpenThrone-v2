/**
 * populate.ts — Generate ~200 randomized players for testing.
 *
 * Run:  pnpm db:populate
 *
 * Does NOT touch existing players — safe to run multiple times
 * (uses unique emails like pop_001@openthrone.dev).
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// ─── Constants ──────────────────────────────────────────────────────────────

const RACES = ['HUMAN', 'ELF', 'GOBLIN', 'UNDEAD'] as const;
const CLASSES = ['FIGHTER', 'CLERIC', 'ASSASSIN', 'THIEF'] as const;
const BONUS_TYPES = ['OFFENSE', 'DEFENSE', 'INTEL', 'PRICES', 'INCOME'] as const;
const UNIT_TYPES = ['OFFENSE', 'DEFENSE', 'SPY', 'SENTRY'] as const;
const ITEM_USAGES = ['OFFENSE', 'DEFENSE', 'SPY', 'SENTRY'] as const;
const ITEM_TYPES = ['WEAPON', 'ARMOR'] as const;
const BATTLE_UPGRADE_TYPES = ['OFFENSE', 'DEFENSE', 'SPY', 'SENTRY'] as const;
const STRUCTURE_UPGRADE_TYPES = ['OFFENSE', 'SPY', 'SENTRY', 'ARMORY'] as const;

const PLAYER_COUNT = 200;
const PASSWORD = 'password123';

// Fort levels → level requirements from fortifications.ts
const FORT_LEVEL_REQUIREMENTS: Record<number, number> = {
  1: 0, 2: 5, 3: 10, 4: 15, 5: 20, 6: 25, 7: 30, 8: 35, 9: 40, 10: 45,
  11: 50, 12: 55, 13: 60, 14: 65, 15: 70, 16: 75, 17: 80, 18: 85, 19: 90,
  20: 95, 21: 100, 22: 105, 23: 110, 24: 115,
};

const FORT_HITPOINTS: Record<number, number> = {
  1: 50, 2: 100, 3: 200, 4: 300, 5: 500, 6: 750, 7: 1000, 8: 1500, 9: 2000,
  10: 2500, 11: 3000, 12: 3500, 13: 4000, 14: 4500, 15: 5000, 16: 5500,
  17: 6000, 18: 6500, 19: 7000, 20: 7500, 21: 8000, 22: 8500, 23: 9000, 24: 9500,
};

// XP thresholds from xp.ts (level → cumulative xp)
const LEVEL_XP: Record<number, number> = {
  1: 4000, 2: 8000, 3: 13000, 4: 19000, 5: 26000, 6: 34000, 7: 43000,
  8: 53000, 9: 64000, 10: 76000, 11: 89000, 12: 103000, 13: 118000,
  14: 134000, 15: 151000, 16: 169000, 17: 188000, 18: 208000, 19: 229000,
  20: 251000, 25: 376000, 30: 526000, 35: 701000, 40: 901000, 45: 1126000,
  50: 1376000, 55: 1651000, 60: 1951000, 65: 2276000, 70: 2626000,
  75: 3001000, 80: 3401000, 85: 3826000, 90: 4276000, 95: 4751000, 100: 5251000,
};

// Max structure upgrade levels per fort level
const OFFENSE_UPGRADE_MAX = 22;   // fortReq 1–22
const SPY_UPGRADE_MAX = 22;       // fortReq 1–22
const SENTRY_UPGRADE_MAX = 22;    // fortReq 1–22
const ARMORY_UPGRADE_MAX = 6;     // fortLevels: 0,5,10,13,17,21
const ARMORY_FORT_REQS = [0, 5, 10, 13, 17, 21];
const HOUSE_MAX = 7;              // fortLevels: 0,2,6,10,14,18,22
const HOUSE_FORT_REQS = [0, 2, 6, 10, 14, 18, 22];
const ECONOMY_MAX = 7;            // fortLevels: 0,3,7,11,15,19,23
const ECONOMY_FORT_REQS = [0, 3, 7, 11, 15, 19, 23];
const MERC_CAMP_MAX = 6;
const MERC_CAMP_FORT_REQS = [0, 3, 7, 11, 15, 19];

// ─── Name generators ────────────────────────────────────────────────────────

const PREFIXES = [
  'Shadow', 'Iron', 'Storm', 'Dark', 'Blood', 'Fire', 'Frost', 'Night',
  'Thunder', 'Silver', 'Gold', 'Steel', 'Stone', 'Bone', 'Ash', 'Doom',
  'War', 'Moon', 'Sun', 'Star', 'Ice', 'Flame', 'Wolf', 'Raven',
  'Dragon', 'Viper', 'Eagle', 'Bear', 'Lion', 'Hawk', 'Thorn', 'Grim',
  'Swift', 'Dire', 'Fell', 'Black', 'Red', 'White', 'Grey', 'Dread',
  'Pale', 'Crimson', 'Azure', 'Jade', 'Onyx', 'Amber', 'Scarlet', 'Cobalt',
];

const SUFFIXES = [
  'blade', 'fang', 'claw', 'heart', 'bane', 'strike', 'guard', 'shield',
  'fury', 'rage', 'walker', 'runner', 'slayer', 'hunter', 'seeker', 'weaver',
  'forge', 'hammer', 'axe', 'sword', 'spear', 'arrow', 'bolt', 'storm',
  'wind', 'flame', 'frost', 'thorn', 'wood', 'stone', 'bone', 'skull',
  'wing', 'eye', 'hand', 'fist', 'mask', 'helm', 'crown', 'lord',
  'keep', 'tower', 'gate', 'wall', 'fall', 'rise', 'song', 'oath',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

/** Get max achievable armory level for a given fort level */
function maxArmoryLevel(fortLevel: number): number {
  let lvl = 1;
  for (let i = 0; i < ARMORY_FORT_REQS.length; i++) {
    if (fortLevel >= ARMORY_FORT_REQS[i]!) lvl = i + 1;
  }
  return lvl;
}

function maxHouseLevel(fortLevel: number): number {
  let lvl = 1;
  for (let i = 0; i < HOUSE_FORT_REQS.length; i++) {
    if (fortLevel >= HOUSE_FORT_REQS[i]!) lvl = i + 1;
  }
  return lvl;
}

function maxEconomyLevel(fortLevel: number): number {
  let lvl = 1;
  for (let i = 0; i < ECONOMY_FORT_REQS.length; i++) {
    if (fortLevel >= ECONOMY_FORT_REQS[i]!) lvl = i + 1;
  }
  return lvl;
}

function maxMercCampLevel(fortLevel: number): number {
  let lvl = 1;
  for (let i = 0; i < MERC_CAMP_FORT_REQS.length; i++) {
    if (fortLevel >= MERC_CAMP_FORT_REQS[i]!) lvl = i + 1;
  }
  return lvl;
}

/** Get XP for a target player level (approximate) */
function xpForPlayerLevel(level: number): number {
  // Find closest defined level
  const levels = Object.keys(LEVEL_XP).map(Number).sort((a, b) => a - b);
  for (let i = levels.length - 1; i >= 0; i--) {
    if (levels[i]! <= level) {
      const base = LEVEL_XP[levels[i]!]!;
      // Add some randomness within the level
      return base + rand(0, 3000);
    }
  }
  return rand(0, 3999); // Below level 1
}

/** Max fort level achievable at a given player level */
function maxFortForLevel(playerLevel: number): number {
  let maxFort = 1;
  for (const [fort, req] of Object.entries(FORT_LEVEL_REQUIREMENTS)) {
    if (playerLevel >= req) maxFort = Math.max(maxFort, Number(fort));
  }
  return maxFort;
}

// ─── Player Archetypes ──────────────────────────────────────────────────────

type Archetype = 'attacker' | 'defender' | 'spy' | 'balanced' | 'economy' | 'newbie';

/** Tier distribution for testing diversity */
interface TierConfig {
  playerLevelRange: [number, number];
  weight: number;  // relative chance
}

const TIERS: TierConfig[] = [
  { playerLevelRange: [0, 0],   weight: 15 },   // brand new
  { playerLevelRange: [1, 5],   weight: 25 },   // low
  { playerLevelRange: [5, 15],  weight: 25 },   // mid-low
  { playerLevelRange: [15, 30], weight: 15 },   // mid
  { playerLevelRange: [30, 50], weight: 10 },   // mid-high
  { playerLevelRange: [50, 75], weight: 7 },    // high
  { playerLevelRange: [75, 100], weight: 3 },   // endgame
];

const ARCHETYPES: Archetype[] = ['attacker', 'defender', 'spy', 'balanced', 'economy', 'newbie'];
const ARCHETYPE_WEIGHTS = [25, 20, 15, 25, 10, 5];

// ─── Generate a single player ──────────────────────────────────────────────

interface GeneratedPlayer {
  index: number;
  displayName: string;
  email: string;
  race: string;
  playerClass: string;
  playerLevel: number;
  experience: number;
  fortLevel: number;
  archetype: Archetype;
  gold: bigint;
  goldInBank: bigint;
  attackTurns: number;
  houseLevel: number;
  economyLevel: number;
  units: Array<{ unitType: string; level: number; quantity: number }>;
  items: Array<{ itemType: string; usage: string; level: number; quantity: number }>;
  structureUpgrades: Array<{ upgradeType: string; level: number }>;
  battleUpgrades: Array<{ upgradeType: string; level: number; quantity: number }>;
  bonusPoints: Array<{ bonusType: string; level: number }>;
  cumulativeStats: {
    attack_wins: number;
    defense_wins: number;
    total_attacks: number;
    total_defends: number;
    gold_stolen: bigint;
    units_killed: number;
    units_lost: number;
    spy_wins: number;
    counter_spy_wins: number;
    total_spy_ops: number;
    gold_spent: bigint;
    units_trained: number;
    messages_sent: number;
  };
}

function generatePlayer(index: number, usedNames: Set<string>): GeneratedPlayer {
  // Pick tier and archetype
  const tier = pickWeighted(TIERS, TIERS.map((t) => t.weight));
  const archetype: Archetype = tier.playerLevelRange[1] === 0
    ? 'newbie'
    : pickWeighted(ARCHETYPES, ARCHETYPE_WEIGHTS);

  const playerLevel = rand(tier.playerLevelRange[0], tier.playerLevelRange[1]);
  const experience = playerLevel === 0 ? rand(0, 3999) : xpForPlayerLevel(playerLevel);

  // Fort level: up to max for player level, but usually not maxed
  const maxFort = maxFortForLevel(playerLevel);
  const fortLevel = Math.max(1, rand(Math.max(1, maxFort - 3), maxFort));

  // Generate unique name
  let displayName: string;
  let attempts = 0;
  do {
    displayName = `${pick(PREFIXES)}${pick(SUFFIXES)}`;
    if (attempts > 20) displayName += rand(1, 999);
    attempts++;
  } while (usedNames.has(displayName.toLowerCase()));
  usedNames.add(displayName.toLowerCase());

  const race = pick(RACES);
  const playerClass = pick(CLASSES);

  // Gold scales with level
  const goldMultiplier = 1 + playerLevel * 0.5;
  const baseGold = rand(5000, 100000) * goldMultiplier;
  const gold = BigInt(Math.floor(baseGold));
  const goldInBank = BigInt(Math.floor(rand(0, 5) * baseGold));
  const attackTurns = rand(0, 200);

  // Economy & housing
  const houseLevel = rand(1, maxHouseLevel(fortLevel));
  const economyLevel = rand(1, maxEconomyLevel(fortLevel));

  // ─── Units ─────────────────────────────────────────────────
  const units: GeneratedPlayer['units'] = [];
  const population = rand(20, 50 + playerLevel * 15);

  // Citizens & workers
  const citizenRatio = rand(5, 25) / 100;
  const workerRatio = rand(10, 30) / 100;
  const citizens = Math.max(5, Math.floor(population * citizenRatio));
  const workers = Math.floor(population * workerRatio);

  units.push({ unitType: 'CITIZEN', level: 1, quantity: citizens });

  // Worker levels gated by fort
  const maxWorkerLevel = fortLevel >= 7 ? 3 : fortLevel >= 3 ? 2 : 1;
  if (workers > 0) {
    if (maxWorkerLevel === 1) {
      units.push({ unitType: 'WORKER', level: 1, quantity: workers });
    } else {
      // Distribute across available levels
      const perLevel = Math.ceil(workers / maxWorkerLevel);
      for (let l = 1; l <= maxWorkerLevel; l++) {
        const qty = Math.min(perLevel, workers - (l - 1) * perLevel);
        if (qty > 0) units.push({ unitType: 'WORKER', level: l, quantity: qty });
      }
    }
  }

  // Combat units — distributed based on archetype
  const combatBudget = population - citizens - workers;
  if (combatBudget > 0) {
    let offPct: number, defPct: number, spyPct: number, senPct: number;

    switch (archetype) {
      case 'attacker':
        offPct = rand(50, 70); defPct = rand(10, 25); spyPct = rand(5, 15); senPct = 100 - offPct - defPct - spyPct;
        break;
      case 'defender':
        defPct = rand(50, 70); offPct = rand(10, 25); senPct = rand(5, 15); spyPct = 100 - offPct - defPct - senPct;
        break;
      case 'spy':
        spyPct = rand(40, 60); senPct = rand(15, 25); offPct = rand(5, 15); defPct = 100 - offPct - spyPct - senPct;
        break;
      case 'economy':
        offPct = rand(15, 25); defPct = rand(15, 25); spyPct = rand(10, 20); senPct = 100 - offPct - defPct - spyPct;
        break;
      case 'newbie':
        offPct = rand(20, 40); defPct = rand(20, 40); spyPct = rand(5, 15); senPct = 100 - offPct - defPct - spyPct;
        break;
      case 'balanced':
      default:
        offPct = rand(20, 30); defPct = rand(20, 30); spyPct = rand(15, 25); senPct = 100 - offPct - defPct - spyPct;
        break;
    }

    // Ensure non-negative
    senPct = Math.max(0, senPct);
    spyPct = Math.max(0, spyPct);

    const offCount = Math.floor(combatBudget * offPct / 100);
    const defCount = Math.floor(combatBudget * defPct / 100);
    const spyCount = Math.floor(combatBudget * spyPct / 100);
    const senCount = Math.max(0, combatBudget - offCount - defCount - spyCount);

    // Max unit levels gated by fort
    const maxOffLevel = fortLevel >= 10 ? 4 : fortLevel >= 7 ? 3 : fortLevel >= 4 ? 2 : 1;
    const maxDefLevel = fortLevel >= 10 ? 4 : fortLevel >= 7 ? 3 : fortLevel >= 4 ? 2 : 1;
    const maxSpyLevel = fortLevel >= 12 ? 3 : fortLevel >= 8 ? 2 : 1;
    const maxSenLevel = fortLevel >= 12 ? 3 : fortLevel >= 8 ? 2 : 1;

    // Distribute across levels (more at lower levels)
    const distributeUnits = (type: string, total: number, maxLvl: number) => {
      if (total <= 0) return;
      if (maxLvl === 1) {
        units.push({ unitType: type, level: 1, quantity: total });
        return;
      }
      let remaining = total;
      for (let l = maxLvl; l >= 1; l--) {
        // Higher levels get fewer units (pyramid distribution)
        const fraction = l === 1 ? 1.0 : 1 / (l * 1.5);
        const qty = l === 1 ? remaining : Math.min(remaining, Math.max(1, Math.floor(total * fraction)));
        if (qty > 0) {
          units.push({ unitType: type, level: l, quantity: qty });
          remaining -= qty;
        }
      }
    };

    distributeUnits('OFFENSE', offCount, maxOffLevel);
    distributeUnits('DEFENSE', defCount, maxDefLevel);
    distributeUnits('SPY', spyCount, maxSpyLevel);
    distributeUnits('SENTRY', senCount, maxSenLevel);
  }

  // ─── Items ─────────────────────────────────────────────────
  const items: GeneratedPlayer['items'] = [];
  const armoryLevel = rand(1, maxArmoryLevel(fortLevel));
  const maxItemLevel = Math.min(10, armoryLevel * 2); // rough gate

  if (armoryLevel > 1 && playerLevel >= 3) {
    // Equip items for combat unit types
    for (const usage of ITEM_USAGES) {
      const unitCount = units.filter((u) => u.unitType === usage).reduce((s, u) => s + u.quantity, 0);
      if (unitCount === 0) continue;

      for (const itemType of ITEM_TYPES) {
        const level = rand(1, maxItemLevel);
        // Equip between 30% and 100% of unit count
        const qty = Math.max(1, Math.floor(unitCount * rand(30, 100) / 100));
        items.push({ itemType, usage, level, quantity: qty });
      }
    }
  }

  // ─── Structure Upgrades ────────────────────────────────────
  const structureUpgrades: GeneratedPlayer['structureUpgrades'] = [];

  // Offense/Spy/Sentry upgrades capped by fort level
  const offUpgrade = rand(1, Math.min(OFFENSE_UPGRADE_MAX, fortLevel));
  const spyUpgrade = rand(1, Math.min(SPY_UPGRADE_MAX, fortLevel));
  const senUpgrade = rand(1, Math.min(SENTRY_UPGRADE_MAX, fortLevel));

  if (offUpgrade > 1) structureUpgrades.push({ upgradeType: 'OFFENSE', level: offUpgrade });
  if (spyUpgrade > 1) structureUpgrades.push({ upgradeType: 'SPY', level: spyUpgrade });
  if (senUpgrade > 1) structureUpgrades.push({ upgradeType: 'SENTRY', level: senUpgrade });
  if (armoryLevel > 1) structureUpgrades.push({ upgradeType: 'ARMORY', level: armoryLevel });

  // House & economy tracked on PlayerEconomy, not structure upgrades
  // Merc camp
  const mercCampLevel = rand(1, maxMercCampLevel(fortLevel));
  if (mercCampLevel > 1) structureUpgrades.push({ upgradeType: 'MERCENARY_CAMP', level: mercCampLevel });

  // ─── Battle Upgrades ───────────────────────────────────────
  const battleUpgrades: GeneratedPlayer['battleUpgrades'] = [];

  if (playerLevel >= 10) {
    for (const type of BATTLE_UPGRADE_TYPES) {
      // Max battle upgrade level depends on highest unit level for that type
      const maxUnitLvl = units
        .filter((u) => u.unitType === type)
        .reduce((m, u) => Math.max(m, u.level), 0);

      // Battle upgrades require minUnitLevel 2/3/4
      const maxBULevel = maxUnitLvl >= 4 ? 3 : maxUnitLvl >= 3 ? 2 : maxUnitLvl >= 2 ? 1 : 0;

      for (let l = 1; l <= maxBULevel; l++) {
        const unitCount = units
          .filter((u) => u.unitType === type && u.level >= l + 1)
          .reduce((s, u) => s + u.quantity, 0);
        if (unitCount > 0) {
          const qty = rand(1, Math.min(unitCount, 20));
          battleUpgrades.push({ upgradeType: type, level: l, quantity: qty });
        }
      }
    }
  }

  // ─── Bonus Points ─────────────────────────────────────────
  const bonusPoints: GeneratedPlayer['bonusPoints'] = [];
  const totalBonusPoints = Math.floor(playerLevel / 5); // 1 point every 5 levels
  let remaining = totalBonusPoints;

  // Distribute based on archetype
  const bonusPriority: Record<Archetype, string[]> = {
    attacker: ['OFFENSE', 'INCOME', 'DEFENSE', 'INTEL', 'PRICES'],
    defender: ['DEFENSE', 'INCOME', 'OFFENSE', 'PRICES', 'INTEL'],
    spy: ['INTEL', 'OFFENSE', 'INCOME', 'DEFENSE', 'PRICES'],
    balanced: ['OFFENSE', 'DEFENSE', 'INCOME', 'INTEL', 'PRICES'],
    economy: ['INCOME', 'PRICES', 'DEFENSE', 'OFFENSE', 'INTEL'],
    newbie: ['OFFENSE', 'DEFENSE', 'INCOME', 'INTEL', 'PRICES'],
  };

  const bpAlloc: Record<string, number> = {};
  for (const bt of BONUS_TYPES) bpAlloc[bt] = 0;

  const priority = bonusPriority[archetype];
  while (remaining > 0) {
    const bt = priority[rand(0, Math.min(2, priority.length - 1))]!; // favor top 3
    bpAlloc[bt] = (bpAlloc[bt] ?? 0) + 1;
    remaining--;
  }

  for (const bt of BONUS_TYPES) {
    bonusPoints.push({ bonusType: bt, level: bpAlloc[bt] ?? 0 });
  }

  // ─── Cumulative Stats ─────────────────────────────────────
  const totalAttacks = rand(0, playerLevel * 5);
  const attackWins = Math.floor(totalAttacks * rand(30, 70) / 100);
  const totalDefends = rand(0, playerLevel * 3);
  const defenseWins = Math.floor(totalDefends * rand(30, 70) / 100);
  const goldStolen = BigInt(rand(0, playerLevel * 50000));
  const unitsKilled = rand(0, playerLevel * 20);
  const unitsLost = rand(0, playerLevel * 10);
  const spyWins = rand(0, playerLevel * 2);
  const counterSpyWins = rand(0, playerLevel);
  const totalSpyOps = spyWins + rand(0, playerLevel);
  const goldSpent = BigInt(rand(0, playerLevel * 200000));
  const unitsTrained = rand(0, playerLevel * 30);
  const messagesSent = rand(0, playerLevel * 2);

  return {
    index,
    displayName,
    email: `pop_${String(index).padStart(3, '0')}@openthrone.dev`,
    race,
    playerClass,
    playerLevel,
    experience,
    fortLevel,
    archetype,
    gold,
    goldInBank,
    attackTurns,
    houseLevel,
    economyLevel,
    units,
    items,
    structureUpgrades,
    battleUpgrades,
    bonusPoints,
    cumulativeStats: {
      attack_wins: attackWins,
      defense_wins: defenseWins,
      total_attacks: totalAttacks,
      total_defends: totalDefends,
      gold_stolen: goldStolen,
      units_killed: unitsKilled,
      units_lost: unitsLost,
      spy_wins: spyWins,
      counter_spy_wins: counterSpyWins,
      total_spy_ops: totalSpyOps,
      gold_spent: goldSpent,
      units_trained: unitsTrained,
      messages_sent: messagesSent,
    },
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Generating ${PLAYER_COUNT} test players...\n`);

  const passwordHash = await argon2.hash(PASSWORD);
  const usedNames = new Set<string>();

  // Check for existing populated players to skip
  const existing = await prisma.player.count({
    where: { email: { startsWith: 'pop_' } },
  });
  if (existing > 0) {
    console.log(`Found ${existing} existing populated players. Deleting them first...`);
    // Delete in dependency order
    const popPlayers = await prisma.player.findMany({
      where: { email: { startsWith: 'pop_' } },
      select: { id: true },
    });
    const popIds = popPlayers.map((p) => p.id);

    if (popIds.length > 0) {
      await prisma.mercenaryDailyPurchase.deleteMany({ where: { player_id: { in: popIds } } });
      await prisma.bankHistory.deleteMany({ where: { from_user_id: { in: popIds } } });
      await prisma.playerCumulativeStats.deleteMany({ where: { player_id: { in: popIds } } });
      await prisma.playerBonusPoint.deleteMany({ where: { player_id: { in: popIds } } });
      await prisma.playerBattleUpgrade.deleteMany({ where: { player_id: { in: popIds } } });
      await prisma.playerStructureUpgrade.deleteMany({ where: { player_id: { in: popIds } } });
      await prisma.playerItem.deleteMany({ where: { player_id: { in: popIds } } });
      await prisma.playerUnit.deleteMany({ where: { player_id: { in: popIds } } });
      await prisma.playerFortification.deleteMany({ where: { player_id: { in: popIds } } });
      await prisma.playerStats.deleteMany({ where: { player_id: { in: popIds } } });
      await prisma.playerEconomy.deleteMany({ where: { player_id: { in: popIds } } });
      await prisma.player.deleteMany({ where: { id: { in: popIds } } });
    }
    console.log('Cleaned up old populated players.\n');
  }

  // Generate all players
  const players: GeneratedPlayer[] = [];
  for (let i = 1; i <= PLAYER_COUNT; i++) {
    players.push(generatePlayer(i, usedNames));
  }

  // Stats summary
  const tierCounts: Record<string, number> = {};
  const archetypeCounts: Record<string, number> = {};
  for (const p of players) {
    const tier = p.playerLevel === 0 ? 'newbie'
      : p.playerLevel <= 5 ? 'low'
      : p.playerLevel <= 15 ? 'mid-low'
      : p.playerLevel <= 30 ? 'mid'
      : p.playerLevel <= 50 ? 'mid-high'
      : p.playerLevel <= 75 ? 'high'
      : 'endgame';
    tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
    archetypeCounts[p.archetype] = (archetypeCounts[p.archetype] ?? 0) + 1;
  }

  console.log('Tier distribution:');
  for (const [tier, count] of Object.entries(tierCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tier}: ${count}`);
  }
  console.log('\nArchetype distribution:');
  for (const [arch, count] of Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${arch}: ${count}`);
  }

  // Insert in batches
  console.log('\nInserting players...');
  let created = 0;

  for (const p of players) {
    try {
      const player = await prisma.player.create({
        data: {
          email: p.email,
          display_name: p.displayName,
          password_hash: passwordHash,
          race: p.race,
          player_class: p.playerClass,
          bio: `A ${p.race.toLowerCase()} ${p.playerClass.toLowerCase()} — ${p.archetype} build.`,
          last_active: new Date(Date.now() - rand(0, 30 * 24 * 60 * 60 * 1000)),
        },
      });

      // Economy
      await prisma.playerEconomy.create({
        data: {
          player_id: player.id,
          gold: p.gold,
          gold_in_bank: p.goldInBank,
          attack_turns: p.attackTurns,
          house_level: p.houseLevel,
          economy_level: p.economyLevel,
        },
      });

      // Fortification
      await prisma.playerFortification.create({
        data: {
          player_id: player.id,
          fort_level: p.fortLevel,
          hitpoints: rand(
            Math.floor((FORT_HITPOINTS[p.fortLevel] ?? 50) * 0.3),
            FORT_HITPOINTS[p.fortLevel] ?? 50,
          ),
        },
      });

      // Stats (we'll compute offense/defense/spy/sentry from units+items later,
      // but for now set approximate values)
      const totalOff = p.units.filter((u) => u.unitType === 'OFFENSE').reduce((s, u) => s + u.quantity * (u.level * 3), 0)
        + p.items.filter((i) => i.usage === 'OFFENSE').reduce((s, i) => s + i.quantity * (i.level * 25), 0);
      const totalDef = p.units.filter((u) => u.unitType === 'DEFENSE').reduce((s, u) => s + u.quantity * (u.level * 3), 0)
        + p.items.filter((i) => i.usage === 'DEFENSE').reduce((s, i) => s + i.quantity * (i.level * 25), 0);
      const totalSpy = p.units.filter((u) => u.unitType === 'SPY').reduce((s, u) => s + u.quantity * (u.level * 5), 0)
        + p.items.filter((i) => i.usage === 'SPY').reduce((s, i) => s + i.quantity * (i.level * 12), 0);
      const totalSen = p.units.filter((u) => u.unitType === 'SENTRY').reduce((s, u) => s + u.quantity * (u.level * 5), 0)
        + p.items.filter((i) => i.usage === 'SENTRY').reduce((s, i) => s + i.quantity * (i.level * 12), 0);

      await prisma.playerStats.create({
        data: {
          player_id: player.id,
          experience: p.experience,
          rank: 0,
          offense: totalOff,
          defense: totalDef,
          spy: totalSpy,
          sentry: totalSen,
          killing_str: 1,
          defense_str: 1,
          spying_str: 1,
          sentry_str: 1,
        },
      });

      // Units
      for (const u of p.units) {
        await prisma.playerUnit.create({
          data: {
            player_id: player.id,
            unit_type: u.unitType,
            level: u.level,
            quantity: u.quantity,
          },
        });
      }

      // Items
      for (const i of p.items) {
        await prisma.playerItem.create({
          data: {
            player_id: player.id,
            item_type: i.itemType,
            usage: i.usage,
            level: i.level,
            quantity: i.quantity,
          },
        });
      }

      // Structure upgrades
      for (const su of p.structureUpgrades) {
        await prisma.playerStructureUpgrade.create({
          data: {
            player_id: player.id,
            upgrade_type: su.upgradeType,
            level: su.level,
          },
        });
      }

      // Battle upgrades
      for (const bu of p.battleUpgrades) {
        await prisma.playerBattleUpgrade.create({
          data: {
            player_id: player.id,
            upgrade_type: bu.upgradeType,
            level: bu.level,
            quantity: bu.quantity,
          },
        });
      }

      // Bonus points
      for (const bp of p.bonusPoints) {
        await prisma.playerBonusPoint.create({
          data: {
            player_id: player.id,
            bonus_type: bp.bonusType,
            level: bp.level,
          },
        });
      }

      // Cumulative stats
      await prisma.playerCumulativeStats.create({
        data: {
          player_id: player.id,
          ...p.cumulativeStats,
        },
      });

      created++;
      if (created % 25 === 0) {
        console.log(`  ${created}/${PLAYER_COUNT} created...`);
      }
    } catch (err: any) {
      console.error(`Failed to create player ${p.displayName}: ${err.message}`);
    }
  }

  console.log(`\nDone! Created ${created} test players.`);
  console.log(`All passwords: ${PASSWORD}`);
  console.log(`Emails: pop_001@openthrone.dev through pop_${String(PLAYER_COUNT).padStart(3, '0')}@openthrone.dev`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Populate error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
