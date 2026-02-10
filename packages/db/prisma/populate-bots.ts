/**
 * populate-bots.ts — Generate ~30 bot players with varied progression.
 *
 * Run:  pnpm db:populate-bots
 *
 * Creates bot players with BotConfig records, varied levels, units,
 * items, and strategies. Safe to run multiple times (deletes old bots first).
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// ─── Constants ──────────────────────────────────────────────────────────────

const RACES = ['HUMAN', 'ELF', 'GOBLIN', 'UNDEAD'] as const;
const CLASSES = ['FIGHTER', 'CLERIC', 'ASSASSIN', 'THIEF'] as const;
const BONUS_TYPES = ['OFFENSE', 'DEFENSE', 'INTEL', 'PRICES', 'INCOME'] as const;
const ITEM_USAGES = ['OFFENSE', 'DEFENSE', 'SPY', 'SENTRY'] as const;
const ITEM_TYPES = ['WEAPON', 'ARMOR'] as const;
const BATTLE_UPGRADE_TYPES = ['OFFENSE', 'DEFENSE', 'SPY', 'SENTRY'] as const;

const BOT_COUNT = 30;
const STRATEGIES = ['WARRIOR', 'TURTLE', 'ECONOMIST', 'SPYMASTER', 'BALANCED'] as const;

// Archetype → Strategy mapping
const ARCHETYPE_STRATEGY: Record<string, string> = {
  attacker: 'WARRIOR',
  defender: 'TURTLE',
  spy: 'SPYMASTER',
  economy: 'ECONOMIST',
  balanced: 'BALANCED',
  newbie: 'BALANCED',
};

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

const LEVEL_XP: Record<number, number> = {
  1: 4000, 2: 8000, 3: 13000, 4: 19000, 5: 26000, 6: 34000, 7: 43000,
  8: 53000, 9: 64000, 10: 76000, 11: 89000, 12: 103000, 13: 118000,
  14: 134000, 15: 151000, 16: 169000, 17: 188000, 18: 208000, 19: 229000,
  20: 251000, 25: 376000, 30: 526000, 35: 701000, 40: 901000, 45: 1126000,
  50: 1376000, 55: 1651000, 60: 1951000, 65: 2276000, 70: 2626000,
  75: 3001000, 80: 3401000, 85: 3826000, 90: 4276000, 95: 4751000, 100: 5251000,
};

const ARMORY_FORT_REQS = [0, 5, 10, 13, 17, 21];
const HOUSE_FORT_REQS = [0, 2, 6, 10, 14, 18, 22];
const ECONOMY_FORT_REQS = [0, 3, 7, 11, 15, 19, 23];
const MERC_CAMP_FORT_REQS = [0, 3, 7, 11, 15, 19];
const OFFENSE_UPGRADE_MAX = 22;
const SPY_UPGRADE_MAX = 22;
const SENTRY_UPGRADE_MAX = 22;

// Bot name parts — themed for bots
const PREFIXES = [
  'Auto', 'Mech', 'Iron', 'Steel', 'Cyber', 'Proto', 'Sentinel',
  'Dread', 'Warden', 'Phantom', 'Wraith', 'Ghost', 'Shadow', 'Storm',
  'Titan', 'Colossus', 'Vanguard', 'Reaper', 'Forge', 'Bastion',
  'Crimson', 'Azure', 'Obsidian', 'Ember', 'Frost', 'Thunder', 'Void',
  'Apex', 'Prime', 'Nova', 'Nexus', 'Rune', 'Glyph', 'Sigil',
];

const SUFFIXES = [
  'Knight', 'Guard', 'Hunter', 'Striker', 'Watcher', 'Keeper',
  'Blade', 'Shield', 'Fang', 'Claw', 'Horn', 'Wing',
  'Core', 'Node', 'Link', 'Spark', 'Pulse', 'Wave',
  'Lord', 'King', 'Duke', 'Baron', 'Marshal', 'Captain',
  'Bane', 'Doom', 'Fury', 'Rage', 'Storm', 'Bolt',
];

// Skew toward mid-high levels — bots should be competitive
interface TierConfig { playerLevelRange: [number, number]; weight: number; }
const TIERS: TierConfig[] = [
  { playerLevelRange: [3, 10],   weight: 15 },  // low
  { playerLevelRange: [10, 25],  weight: 30 },  // mid
  { playerLevelRange: [25, 45],  weight: 30 },  // mid-high
  { playerLevelRange: [45, 70],  weight: 20 },  // high
  { playerLevelRange: [70, 90],  weight: 5 },   // endgame
];

type Archetype = 'attacker' | 'defender' | 'spy' | 'balanced' | 'economy';
const ARCHETYPES: Archetype[] = ['attacker', 'defender', 'spy', 'balanced', 'economy'];
const ARCHETYPE_WEIGHTS = [25, 20, 15, 25, 15];

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

function xpForPlayerLevel(level: number): number {
  const levels = Object.keys(LEVEL_XP).map(Number).sort((a, b) => a - b);
  for (let i = levels.length - 1; i >= 0; i--) {
    if (levels[i]! <= level) {
      return LEVEL_XP[levels[i]!]! + rand(0, 3000);
    }
  }
  return rand(0, 3999);
}

function maxFortForLevel(playerLevel: number): number {
  let maxFort = 1;
  for (const [fort, req] of Object.entries(FORT_LEVEL_REQUIREMENTS)) {
    if (playerLevel >= req) maxFort = Math.max(maxFort, Number(fort));
  }
  return maxFort;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Generating ${BOT_COUNT} bot players...\n`);

  // Clean up existing bot_ email bots (from previous runs of this script)
  const existingBots = await prisma.player.findMany({
    where: { email: { startsWith: 'bot_' } },
    select: { id: true },
  });
  const botIds = existingBots.map((p) => p.id);

  if (botIds.length > 0) {
    console.log(`Found ${botIds.length} existing bot players. Cleaning up...`);
    // Delete in dependency order
    await prisma.botActionLog.deleteMany({ where: { bot_config: { player_id: { in: botIds } } } });
    await prisma.botConfig.deleteMany({ where: { player_id: { in: botIds } } });
    await prisma.activityLog.deleteMany({ where: { player_id: { in: botIds } } }).catch(() => {});
    await prisma.mercenaryDailyPurchase.deleteMany({ where: { player_id: { in: botIds } } });
    await prisma.bankHistory.deleteMany({ where: { from_user_id: { in: botIds } } });
    await prisma.playerCumulativeStats.deleteMany({ where: { player_id: { in: botIds } } });
    await prisma.playerBonusPoint.deleteMany({ where: { player_id: { in: botIds } } });
    await prisma.playerBattleUpgrade.deleteMany({ where: { player_id: { in: botIds } } });
    await prisma.playerStructureUpgrade.deleteMany({ where: { player_id: { in: botIds } } });
    await prisma.playerItem.deleteMany({ where: { player_id: { in: botIds } } });
    await prisma.playerUnit.deleteMany({ where: { player_id: { in: botIds } } });
    await prisma.playerFortification.deleteMany({ where: { player_id: { in: botIds } } });
    await prisma.playerStats.deleteMany({ where: { player_id: { in: botIds } } });
    await prisma.playerEconomy.deleteMany({ where: { player_id: { in: botIds } } });
    await prisma.player.deleteMany({ where: { id: { in: botIds } } });
    console.log('Cleaned up.\n');
  }

  const usedNames = new Set<string>();
  const passwordHash = await argon2.hash(randomUUID()); // bots can't login
  let created = 0;

  for (let i = 1; i <= BOT_COUNT; i++) {
    const tier = pickWeighted(TIERS, TIERS.map((t) => t.weight));
    const archetype = pickWeighted(ARCHETYPES, ARCHETYPE_WEIGHTS);
    const strategy = ARCHETYPE_STRATEGY[archetype] ?? 'BALANCED';

    const playerLevel = rand(tier.playerLevelRange[0], tier.playerLevelRange[1]);
    const experience = xpForPlayerLevel(playerLevel);
    const maxFort = maxFortForLevel(playerLevel);
    const fortLevel = Math.max(1, rand(Math.max(1, maxFort - 3), maxFort));

    // Unique name
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

    const goldMultiplier = 1 + playerLevel * 0.5 + Math.pow(playerLevel, 1.5) * 0.1;
    const baseGold = rand(5000, 100000) * goldMultiplier;
    const gold = BigInt(Math.floor(baseGold));
    const goldInBank = BigInt(Math.floor(rand(0, 5) * baseGold));
    const attackTurns = rand(10, 200);

    const houseLevel = rand(1, maxHouseLevel(fortLevel));
    const economyLevel = rand(1, maxEconomyLevel(fortLevel));

    // ─── Units ────────────────────────────────────────────────
    const units: Array<{ unitType: string; level: number; quantity: number }> = [];
    const population = rand(
      50 + playerLevel * 10,
      100 + playerLevel * 40 + Math.floor(Math.pow(playerLevel, 1.8)),
    );

    const citizenRatio = rand(5, 25) / 100;
    const workerRatio = rand(10, 30) / 100;
    const citizens = Math.max(5, Math.floor(population * citizenRatio));
    const workers = Math.floor(population * workerRatio);

    units.push({ unitType: 'CITIZEN', level: 1, quantity: citizens });

    const maxWorkerLevel = fortLevel >= 7 ? 3 : fortLevel >= 3 ? 2 : 1;
    if (workers > 0) {
      if (maxWorkerLevel === 1) {
        units.push({ unitType: 'WORKER', level: 1, quantity: workers });
      } else {
        const perLevel = Math.ceil(workers / maxWorkerLevel);
        for (let l = 1; l <= maxWorkerLevel; l++) {
          const qty = Math.min(perLevel, workers - (l - 1) * perLevel);
          if (qty > 0) units.push({ unitType: 'WORKER', level: l, quantity: qty });
        }
      }
    }

    const combatBudget = population - citizens - workers;
    if (combatBudget > 0) {
      let offPct: number, defPct: number, spyPct: number, senPct: number;
      switch (archetype) {
        case 'attacker':
          offPct = rand(50, 70); defPct = rand(10, 25); spyPct = rand(5, 15); senPct = 100 - offPct - defPct - spyPct; break;
        case 'defender':
          defPct = rand(50, 70); offPct = rand(10, 25); senPct = rand(5, 15); spyPct = 100 - offPct - defPct - senPct; break;
        case 'spy':
          spyPct = rand(40, 60); senPct = rand(15, 25); offPct = rand(5, 15); defPct = 100 - offPct - spyPct - senPct; break;
        case 'economy':
          offPct = rand(15, 25); defPct = rand(15, 25); spyPct = rand(10, 20); senPct = 100 - offPct - defPct - spyPct; break;
        case 'balanced':
        default:
          offPct = rand(20, 30); defPct = rand(20, 30); spyPct = rand(15, 25); senPct = 100 - offPct - defPct - spyPct; break;
      }
      senPct = Math.max(0, senPct);
      spyPct = Math.max(0, spyPct);

      const offCount = Math.floor(combatBudget * offPct / 100);
      const defCount = Math.floor(combatBudget * defPct / 100);
      const spyCount = Math.floor(combatBudget * spyPct / 100);
      const senCount = Math.max(0, combatBudget - offCount - defCount - spyCount);

      const maxOffLevel = fortLevel >= 10 ? 4 : fortLevel >= 7 ? 3 : fortLevel >= 4 ? 2 : 1;
      const maxDefLevel = fortLevel >= 10 ? 4 : fortLevel >= 7 ? 3 : fortLevel >= 4 ? 2 : 1;
      const maxSpyLevel = fortLevel >= 12 ? 3 : fortLevel >= 8 ? 2 : 1;
      const maxSenLevel = fortLevel >= 12 ? 3 : fortLevel >= 8 ? 2 : 1;

      const distributeUnits = (type: string, total: number, maxLvl: number) => {
        if (total <= 0) return;
        if (maxLvl === 1) { units.push({ unitType: type, level: 1, quantity: total }); return; }
        let remaining = total;
        for (let l = maxLvl; l >= 1; l--) {
          const fraction = l === 1 ? 1.0 : 1 / (l * 1.5);
          const qty = l === 1 ? remaining : Math.min(remaining, Math.max(1, Math.floor(total * fraction)));
          if (qty > 0) { units.push({ unitType: type, level: l, quantity: qty }); remaining -= qty; }
        }
      };

      distributeUnits('OFFENSE', offCount, maxOffLevel);
      distributeUnits('DEFENSE', defCount, maxDefLevel);
      distributeUnits('SPY', spyCount, maxSpyLevel);
      distributeUnits('SENTRY', senCount, maxSenLevel);
    }

    // ─── Items ────────────────────────────────────────────────
    const items: Array<{ itemType: string; usage: string; level: number; quantity: number }> = [];
    const armoryLevel = rand(1, maxArmoryLevel(fortLevel));
    const maxItemLevel = Math.min(10, armoryLevel * 2);

    if (armoryLevel > 1 && playerLevel >= 3) {
      for (const usage of ITEM_USAGES) {
        const unitCount = units.filter((u) => u.unitType === usage).reduce((s, u) => s + u.quantity, 0);
        if (unitCount === 0) continue;
        for (const itemType of ITEM_TYPES) {
          const level = rand(1, maxItemLevel);
          const qty = Math.max(1, Math.floor(unitCount * rand(30, 100) / 100));
          items.push({ itemType, usage, level, quantity: qty });
        }
      }
    }

    // ─── Structure Upgrades ───────────────────────────────────
    const structureUpgrades: Array<{ upgradeType: string; level: number }> = [];
    const offUpgrade = rand(1, Math.min(OFFENSE_UPGRADE_MAX, fortLevel));
    const spyUpgrade = rand(1, Math.min(SPY_UPGRADE_MAX, fortLevel));
    const senUpgrade = rand(1, Math.min(SENTRY_UPGRADE_MAX, fortLevel));
    if (offUpgrade > 1) structureUpgrades.push({ upgradeType: 'OFFENSE', level: offUpgrade });
    if (spyUpgrade > 1) structureUpgrades.push({ upgradeType: 'SPY', level: spyUpgrade });
    if (senUpgrade > 1) structureUpgrades.push({ upgradeType: 'SENTRY', level: senUpgrade });
    if (armoryLevel > 1) structureUpgrades.push({ upgradeType: 'ARMORY', level: armoryLevel });
    const mercCampLevel = rand(1, maxMercCampLevel(fortLevel));
    if (mercCampLevel > 1) structureUpgrades.push({ upgradeType: 'MERCENARY_CAMP', level: mercCampLevel });

    // ─── Battle Upgrades ──────────────────────────────────────
    const battleUpgrades: Array<{ upgradeType: string; level: number; quantity: number }> = [];
    if (playerLevel >= 10) {
      for (const type of BATTLE_UPGRADE_TYPES) {
        const maxUnitLvl = units.filter((u) => u.unitType === type).reduce((m, u) => Math.max(m, u.level), 0);
        const maxBULevel = maxUnitLvl >= 4 ? 3 : maxUnitLvl >= 3 ? 2 : maxUnitLvl >= 2 ? 1 : 0;
        for (let l = 1; l <= maxBULevel; l++) {
          const unitCount = units.filter((u) => u.unitType === type && u.level >= l + 1).reduce((s, u) => s + u.quantity, 0);
          if (unitCount > 0) {
            battleUpgrades.push({ upgradeType: type, level: l, quantity: rand(1, Math.min(unitCount, 20)) });
          }
        }
      }
    }

    // ─── Bonus Points ─────────────────────────────────────────
    const bonusPoints: Array<{ bonusType: string; level: number }> = [];
    const totalBonusPoints = Math.floor(playerLevel / 5);
    let bpRemaining = totalBonusPoints;
    const bonusPriority: Record<string, string[]> = {
      attacker: ['OFFENSE', 'INCOME', 'DEFENSE', 'INTEL', 'PRICES'],
      defender: ['DEFENSE', 'INCOME', 'OFFENSE', 'PRICES', 'INTEL'],
      spy: ['INTEL', 'OFFENSE', 'INCOME', 'DEFENSE', 'PRICES'],
      balanced: ['OFFENSE', 'DEFENSE', 'INCOME', 'INTEL', 'PRICES'],
      economy: ['INCOME', 'PRICES', 'DEFENSE', 'OFFENSE', 'INTEL'],
    };
    const bpAlloc: Record<string, number> = {};
    for (const bt of BONUS_TYPES) bpAlloc[bt] = 0;
    const priority = bonusPriority[archetype] ?? bonusPriority.balanced!;
    while (bpRemaining > 0) {
      const bt = priority[rand(0, Math.min(2, priority.length - 1))]!;
      bpAlloc[bt] = (bpAlloc[bt] ?? 0) + 1;
      bpRemaining--;
    }
    for (const bt of BONUS_TYPES) {
      bonusPoints.push({ bonusType: bt, level: bpAlloc[bt] ?? 0 });
    }

    // ─── Create in DB ─────────────────────────────────────────
    try {
      const player = await prisma.player.create({
        data: {
          email: `bot_${String(i).padStart(3, '0')}@bot.openthrone.local`,
          display_name: displayName,
          password_hash: passwordHash,
          race,
          player_class: playerClass,
          is_bot: true,
          bio: `[BOT] ${strategy} strategy — ${archetype} archetype`,
          last_active: new Date(),
        },
      });

      await prisma.botConfig.create({
        data: {
          player_id: player.id,
          strategy,
          is_active: true,
          sessions_per_day: rand(2, 5),
          personality_seed: rand(0, 1000000),
          notes: `Auto-generated: level ${playerLevel} ${archetype} (${race} ${playerClass})`,
        },
      });

      await prisma.playerEconomy.create({
        data: {
          player_id: player.id,
          gold,
          gold_in_bank: goldInBank,
          attack_turns: attackTurns,
          house_level: houseLevel,
          economy_level: economyLevel,
        },
      });

      await prisma.playerFortification.create({
        data: {
          player_id: player.id,
          fort_level: fortLevel,
          hitpoints: rand(
            Math.floor((FORT_HITPOINTS[fortLevel] ?? 50) * 0.3),
            FORT_HITPOINTS[fortLevel] ?? 50,
          ),
        },
      });

      // Compute approximate stats
      const totalOff = units.filter((u) => u.unitType === 'OFFENSE').reduce((s, u) => s + u.quantity * (u.level * 3), 0)
        + items.filter((it) => it.usage === 'OFFENSE').reduce((s, it) => s + it.quantity * (it.level * 25), 0);
      const totalDef = units.filter((u) => u.unitType === 'DEFENSE').reduce((s, u) => s + u.quantity * (u.level * 3), 0)
        + items.filter((it) => it.usage === 'DEFENSE').reduce((s, it) => s + it.quantity * (it.level * 25), 0);
      const totalSpy = units.filter((u) => u.unitType === 'SPY').reduce((s, u) => s + u.quantity * (u.level * 5), 0)
        + items.filter((it) => it.usage === 'SPY').reduce((s, it) => s + it.quantity * (it.level * 12), 0);
      const totalSen = units.filter((u) => u.unitType === 'SENTRY').reduce((s, u) => s + u.quantity * (u.level * 5), 0)
        + items.filter((it) => it.usage === 'SENTRY').reduce((s, it) => s + it.quantity * (it.level * 12), 0);

      await prisma.playerStats.create({
        data: {
          player_id: player.id,
          experience,
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

      for (const u of units) {
        await prisma.playerUnit.create({ data: { player_id: player.id, unit_type: u.unitType, level: u.level, quantity: u.quantity } });
      }
      for (const it of items) {
        await prisma.playerItem.create({ data: { player_id: player.id, item_type: it.itemType, usage: it.usage, level: it.level, quantity: it.quantity } });
      }
      for (const su of structureUpgrades) {
        await prisma.playerStructureUpgrade.create({ data: { player_id: player.id, upgrade_type: su.upgradeType, level: su.level } });
      }
      for (const bu of battleUpgrades) {
        await prisma.playerBattleUpgrade.create({ data: { player_id: player.id, upgrade_type: bu.upgradeType, level: bu.level, quantity: bu.quantity } });
      }
      for (const bp of bonusPoints) {
        await prisma.playerBonusPoint.create({ data: { player_id: player.id, bonus_type: bp.bonusType, level: bp.level } });
      }

      // Cumulative stats
      const lvlSq = playerLevel * playerLevel;
      await prisma.playerCumulativeStats.create({
        data: {
          player_id: player.id,
          attack_wins: Math.floor(rand(0, playerLevel * 15 + lvlSq) * rand(30, 70) / 100),
          defense_wins: Math.floor(rand(0, playerLevel * 10 + Math.floor(lvlSq * 0.5)) * rand(30, 70) / 100),
          total_attacks: rand(0, playerLevel * 15 + lvlSq),
          total_defends: rand(0, playerLevel * 10 + Math.floor(lvlSq * 0.5)),
          gold_stolen: BigInt(rand(0, playerLevel * 200000 + lvlSq * 1000)),
          units_killed: rand(0, playerLevel * 50 + lvlSq * 2),
          units_lost: rand(0, playerLevel * 25 + lvlSq),
          spy_wins: rand(0, playerLevel * 5 + Math.floor(lvlSq * 0.3)),
          counter_spy_wins: rand(0, playerLevel * 3),
          total_spy_ops: rand(0, playerLevel * 8),
          gold_spent: BigInt(rand(0, playerLevel * 500000 + lvlSq * 5000)),
          units_trained: rand(0, playerLevel * 80 + lvlSq * 3),
          messages_sent: 0,
        },
      });

      created++;
      console.log(`  [${created}/${BOT_COUNT}] ${displayName} — Lv${playerLevel} ${race} ${playerClass} (${strategy})`);
    } catch (err: any) {
      console.error(`Failed to create bot ${displayName}: ${err.message}`);
    }
  }

  // Summary
  console.log(`\nDone! Created ${created} bots.`);
  console.log('Emails: bot_001@bot.openthrone.local through bot_030@bot.openthrone.local');
  console.log('Bots cannot login — they are controlled by the bot scheduler.\n');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error('Populate-bots error:', e); await prisma.$disconnect(); process.exit(1); });
