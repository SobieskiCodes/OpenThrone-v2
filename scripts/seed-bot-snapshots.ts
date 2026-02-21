#!/usr/bin/env tsx
/**
 * Seed Bot Snapshots — Generate fake historical data for testing analytics
 *
 * Creates realistic snapshot progression over the past N days for all bots.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ProgressionConfig {
  days: number;
  goldGrowthPerDay: number;
  xpGrowthPerDay: number;
  citizensPerDay: number;
  combatWinRate: number;
}

const STRATEGY_CONFIGS: Record<string, ProgressionConfig> = {
  WARRIOR: {
    days: 30,
    goldGrowthPerDay: 15000,
    xpGrowthPerDay: 500,
    citizensPerDay: 250,
    combatWinRate: 0.72,
  },
  TURTLE: {
    days: 30,
    goldGrowthPerDay: 12000,
    xpGrowthPerDay: 300,
    citizensPerDay: 250,
    combatWinRate: 0.55,
  },
  ECONOMIST: {
    days: 30,
    goldGrowthPerDay: 22000,
    xpGrowthPerDay: 200,
    citizensPerDay: 250,
    combatWinRate: 0.35,
  },
  SPYMASTER: {
    days: 30,
    goldGrowthPerDay: 14000,
    xpGrowthPerDay: 400,
    citizensPerDay: 250,
    combatWinRate: 0.50,
  },
  BALANCED: {
    days: 30,
    goldGrowthPerDay: 16000,
    xpGrowthPerDay: 450,
    citizensPerDay: 250,
    combatWinRate: 0.60,
  },
};

async function seedSnapshots() {
  console.log('🤖 Seeding bot snapshots...\n');

  const bots = await prisma.botConfig.findMany({
    where: { is_active: true },
    include: {
      player: {
        include: {
          economy: true,
          stats: true,
          units: true,
          items: true,
          fortification: true,
        },
      },
    },
  });

  for (const bot of bots) {
    const config = STRATEGY_CONFIGS[bot.strategy] || STRATEGY_CONFIGS.BALANCED;

    console.log(`📊 ${bot.player.display_name} (${bot.strategy})`);

    // Get current state
    const currentGold = Number(bot.player.economy?.gold ?? 0);
    const currentXP = bot.player.stats?.experience ?? 0;
    const currentLevel = bot.player.stats?.rank ?? 0;
    const currentCitizens = bot.player.units.find(u => u.unit_type === 'CITIZEN')?.quantity ?? 0;
    const currentWorkers = bot.player.units.find(u => u.unit_type === 'WORKER')?.quantity ?? 0;

    // Generate snapshots for past N days
    for (let daysAgo = config.days; daysAgo >= 0; daysAgo--) {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      date.setHours(1, 0, 0, 0); // Set to 1:00 AM (when snapshots are captured)

      // Calculate progression (earlier = lower values)
      const progress = (config.days - daysAgo) / config.days;
      const gold = Math.max(10000, Math.floor(currentGold - (daysAgo * config.goldGrowthPerDay)));
      const goldInBank = Math.floor(gold * 0.4); // Bank ~40%
      const xp = Math.max(0, Math.floor(currentXP - (daysAgo * config.xpGrowthPerDay)));
      const level = Math.max(0, Math.floor(currentLevel - (daysAgo * 0.1))); // Slow level growth

      const citizens = Math.max(50, Math.floor(currentCitizens - (daysAgo * config.citizensPerDay * 0.2)));
      const workers = Math.max(0, Math.floor(currentWorkers * progress));

      // Military units grow over time
      const offenseUnits = Math.floor((currentCitizens * 0.3) * progress);
      const defenseUnits = Math.floor((currentCitizens * 0.2) * progress);
      const spyUnits = Math.floor((currentCitizens * 0.1) * progress);
      const sentryUnits = Math.floor((currentCitizens * 0.1) * progress);

      // Combat metrics (simulated daily activity)
      const dailyAttacks = Math.floor(Math.random() * 5); // 0-5 attacks per day
      const attacksWon = Math.floor(dailyAttacks * config.combatWinRate);
      const attacksLost = dailyAttacks - attacksWon;
      const goldStolen = BigInt(attacksWon * 5000); // ~5k per win
      const goldLost = BigInt(attacksLost * 3000); // ~3k per loss

      // Equipment (grows with population)
      const weaponsT1 = Math.floor(offenseUnits * 0.5);
      const weaponsT2 = Math.floor(offenseUnits * 0.3);
      const weaponsT3 = Math.floor(offenseUnits * 0.1);
      const armorT1 = Math.floor(defenseUnits * 0.5);
      const armorT2 = Math.floor(defenseUnits * 0.3);
      const armorT3 = Math.floor(defenseUnits * 0.1);

      // Session metrics
      const sessionsRun = 1; // Assume 1 session per day for historical data
      const actionsPerformed = Math.floor(5 + Math.random() * 5); // 5-10 actions
      const actionsFailed = Math.floor(actionsPerformed * 0.15); // ~15% failure rate

      await prisma.botSnapshot.create({
        data: {
          bot_config_id: bot.id,
          snapshot_date: date,

          // Economy
          gold: BigInt(gold),
          gold_in_bank: BigInt(goldInBank),
          attack_turns: 50,

          // Stats
          level,
          experience: BigInt(xp),
          offense: bot.player.stats?.offense ?? 0,
          defense: bot.player.stats?.defense ?? 0,
          spy: bot.player.stats?.spy ?? 0,
          sentry: bot.player.stats?.sentry ?? 0,

          // Population
          citizens,
          workers,
          offense_units: offenseUnits,
          defense_units: defenseUnits,
          spy_units: spyUnits,
          sentry_units: sentryUnits,
          total_population: citizens + workers + offenseUnits + defenseUnits + spyUnits + sentryUnits,

          // Fort
          fort_level: bot.player.fortification?.fort_level ?? 0,
          fort_hp: bot.player.fortification?.hitpoints ?? 50,
          fort_max_hp: (bot.player.fortification?.fort_level ?? 0) * 100 || 50,

          // Combat metrics
          attacks_won: attacksWon,
          attacks_lost: attacksLost,
          gold_stolen: goldStolen,
          gold_lost: goldLost,

          // Equipment
          weapons_t1: weaponsT1,
          weapons_t2: weaponsT2,
          weapons_t3: weaponsT3,
          armor_t1: armorT1,
          armor_t2: armorT2,
          armor_t3: armorT3,

          // Session metrics
          sessions_run: sessionsRun,
          actions_performed: actionsPerformed,
          actions_failed: actionsFailed,
        },
      });
    }

    console.log(`   ✓ Generated ${config.days + 1} snapshots\n`);
  }

  console.log('✅ Done! Snapshots seeded for all bots.');
}

seedSnapshots()
  .catch((err) => {
    console.error('Error seeding snapshots:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
