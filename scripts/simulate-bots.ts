#!/usr/bin/env tsx
/**
 * Bot Simulator — Run bot sessions locally to observe and test behavior
 *
 * Usage:
 *   pnpm tsx scripts/simulate-bots.ts [options]
 *
 * Options:
 *   --bot <name>       Run specific bot by display name (e.g., "IronGuard")
 *   --strategy <type>  Filter bots by strategy (WARRIOR, TURTLE, ECONOMIST, SPYMASTER, BALANCED)
 *   --sessions <n>     Number of sessions to simulate per bot (default: 1)
 *   --all              Run all bots
 *   --verbose          Show detailed action logs
 *
 * Examples:
 *   pnpm tsx scripts/simulate-bots.ts --bot IronGuard --sessions 5 --verbose
 *   pnpm tsx scripts/simulate-bots.ts --strategy WARRIOR --sessions 3
 *   pnpm tsx scripts/simulate-bots.ts --all --sessions 10
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/api/src/app.module';
import { PrismaService } from '../apps/api/src/prisma/prisma.service';
import { BotSchedulerService } from '../apps/api/src/bot/bot-scheduler.service';
import { BotService } from '../apps/api/src/bot/bot.service';

interface SimulationOptions {
  botName?: string;
  strategy?: string;
  sessions: number;
  all: boolean;
  verbose: boolean;
}

interface BotSnapshot {
  displayName: string;
  strategy: string;
  gold: string;
  goldInBank: string;
  attackTurns: number;
  citizens: number;
  workers: number;
  offense: number;
  defense: number;
  spy: number;
  sentry: number;
  level: number;
  experience: number;
  fortLevel: number;
  fortHP: number;
}

function parseArgs(): SimulationOptions {
  const args = process.argv.slice(2);
  const options: SimulationOptions = {
    sessions: 1,
    all: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--bot':
        options.botName = args[++i];
        break;
      case '--strategy':
        options.strategy = args[++i];
        break;
      case '--sessions':
        options.sessions = parseInt(args[++i], 10);
        break;
      case '--all':
        options.all = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        console.log(`
Bot Simulator — Run bot sessions locally to observe and test behavior

Usage:
  pnpm tsx scripts/simulate-bots.ts [options]

Options:
  --bot <name>       Run specific bot by display name (e.g., "IronGuard")
  --strategy <type>  Filter bots by strategy (WARRIOR, TURTLE, ECONOMIST, SPYMASTER, BALANCED)
  --sessions <n>     Number of sessions to simulate per bot (default: 1)
  --all              Run all bots
  --verbose          Show detailed action logs

Examples:
  pnpm tsx scripts/simulate-bots.ts --bot IronGuard --sessions 5 --verbose
  pnpm tsx scripts/simulate-bots.ts --strategy WARRIOR --sessions 3
  pnpm tsx scripts/simulate-bots.ts --all --sessions 10
        `);
        process.exit(0);
    }
  }

  return options;
}

async function getBotSnapshot(prisma: PrismaService, playerId: string): Promise<BotSnapshot> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      economy: true,
      stats: true,
      units: true,
      fortification: true,
    },
  });

  if (!player) throw new Error(`Player ${playerId} not found`);

  const citizens = player.units.find(u => u.unit_type === 'CITIZEN' && u.level === 1)?.quantity ?? 0;
  const workers = player.units.find(u => u.unit_type === 'WORKER' && u.level === 1)?.quantity ?? 0;
  const offenseUnits = player.units.filter(u => u.unit_type === 'OFFENSE').reduce((sum, u) => sum + u.quantity, 0);
  const defenseUnits = player.units.filter(u => u.unit_type === 'DEFENSE').reduce((sum, u) => sum + u.quantity, 0);
  const spyUnits = player.units.filter(u => u.unit_type === 'SPY').reduce((sum, u) => sum + u.quantity, 0);
  const sentryUnits = player.units.filter(u => u.unit_type === 'SENTRY').reduce((sum, u) => sum + u.quantity, 0);

  return {
    displayName: player.display_name,
    strategy: '', // Will be filled by caller
    gold: player.economy?.gold.toString() ?? '0',
    goldInBank: player.economy?.gold_in_bank.toString() ?? '0',
    attackTurns: player.economy?.attack_turns ?? 0,
    citizens,
    workers,
    offense: offenseUnits,
    defense: defenseUnits,
    spy: spyUnits,
    sentry: sentryUnits,
    level: player.stats?.rank ?? 0,
    experience: player.stats?.experience ?? 0,
    fortLevel: player.fortification?.fort_level ?? 0,
    fortHP: player.fortification?.hitpoints ?? 0,
  };
}

function printSnapshot(label: string, snapshot: BotSnapshot) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${label}: ${snapshot.displayName} (${snapshot.strategy})`);
  console.log(`${'='.repeat(80)}`);
  console.log(`💰 Gold: ${BigInt(snapshot.gold).toLocaleString()} | Bank: ${BigInt(snapshot.goldInBank).toLocaleString()} | Turns: ${snapshot.attackTurns}`);
  console.log(`👥 Citizens: ${snapshot.citizens} | Workers: ${snapshot.workers}`);
  console.log(`⚔️  Offense: ${snapshot.offense} | Defense: ${snapshot.defense} | Spy: ${snapshot.spy} | Sentry: ${snapshot.sentry}`);
  console.log(`🏰 Fort Lv${snapshot.fortLevel} (${snapshot.fortHP} HP) | Level: ${snapshot.level} | XP: ${snapshot.experience}`);
}

function printDiff(before: BotSnapshot, after: BotSnapshot) {
  const goldDiff = BigInt(after.gold) - BigInt(before.gold);
  const bankDiff = BigInt(after.goldInBank) - BigInt(before.goldInBank);
  const citizensDiff = after.citizens - before.citizens;
  const workersDiff = after.workers - before.workers;
  const offenseDiff = after.offense - before.offense;
  const defenseDiff = after.defense - before.defense;
  const spyDiff = after.spy - before.spy;
  const sentryDiff = after.sentry - before.sentry;

  console.log(`\n📊 Session Changes:`);
  console.log(`   Gold: ${goldDiff >= 0 ? '+' : ''}${goldDiff.toLocaleString()} | Bank: ${bankDiff >= 0 ? '+' : ''}${bankDiff.toLocaleString()}`);
  console.log(`   Citizens: ${citizensDiff >= 0 ? '+' : ''}${citizensDiff} | Workers: ${workersDiff >= 0 ? '+' : ''}${workersDiff}`);
  console.log(`   Offense: ${offenseDiff >= 0 ? '+' : ''}${offenseDiff} | Defense: ${defenseDiff >= 0 ? '+' : ''}${defenseDiff}`);
  console.log(`   Spy: ${spyDiff >= 0 ? '+' : ''}${spyDiff} | Sentry: ${sentryDiff >= 0 ? '+' : ''}${sentryDiff}`);
}

async function showActionLogs(prisma: PrismaService, sessionId: string) {
  const logs = await prisma.botActionLog.findMany({
    where: { session_id: sessionId },
    orderBy: { created_at: 'asc' },
  });

  console.log(`\n📝 Actions Performed (${logs.length}):`);
  for (const log of logs) {
    if (log.action_type === 'SESSION_START' || log.action_type === 'SESSION_END') continue;
    const status = log.success ? '✓' : '✗';
    console.log(`   ${status} ${log.action_type}`);
    console.log(`      ${log.reasoning}`);
    if (!log.success && log.error_message) {
      console.log(`      ❌ Error: ${log.error_message}`);
    }
  }
}

async function main() {
  const options = parseArgs();

  console.log('\n🤖 Bot Simulator Starting...\n');

  // Bootstrap NestJS app
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: options.verbose ? ['error', 'warn', 'log'] : ['error'],
  });

  const prisma = app.get(PrismaService);
  const botService = app.get(BotService);
  const botScheduler = app.get(BotSchedulerService);

  // Get bots to simulate
  const allBots = await prisma.botConfig.findMany({
    where: { is_active: true },
    include: { player: true },
  });

  let botsToRun = allBots;

  if (options.botName) {
    botsToRun = allBots.filter(b =>
      b.player.display_name.toLowerCase() === options.botName.toLowerCase()
    );
    if (botsToRun.length === 0) {
      console.error(`❌ Bot "${options.botName}" not found`);
      console.log(`\nAvailable bots:`);
      for (const bot of allBots) {
        console.log(`   - ${bot.player.display_name} (${bot.strategy})`);
      }
      process.exit(1);
    }
  } else if (options.strategy) {
    botsToRun = allBots.filter(b => b.strategy === options.strategy.toUpperCase());
    if (botsToRun.length === 0) {
      console.error(`❌ No bots with strategy "${options.strategy}" found`);
      process.exit(1);
    }
  } else if (!options.all) {
    console.error(`❌ Must specify --bot, --strategy, or --all`);
    console.log(`\nUse --help for usage information`);
    process.exit(1);
  }

  console.log(`🎯 Running ${botsToRun.length} bot(s) for ${options.sessions} session(s) each\n`);

  // Run simulations
  for (const bot of botsToRun) {
    const beforeFirst = await getBotSnapshot(prisma, bot.player_id);
    beforeFirst.strategy = bot.strategy;

    printSnapshot('INITIAL STATE', beforeFirst);

    for (let session = 1; session <= options.sessions; session++) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`Session ${session}/${options.sessions}`);
      console.log(`${'─'.repeat(80)}`);

      const beforeSession = await getBotSnapshot(prisma, bot.player_id);
      beforeSession.strategy = bot.strategy;

      // Generate a unique session ID for tracking
      const sessionId = `sim-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Run the bot session
      try {
        await botScheduler.runSingleBot(
          bot.id,
          bot.player_id,
          bot.strategy,
          bot.personality_seed,
        );

        // Get the actual session ID from the most recent bot action log
        const lastLog = await prisma.botActionLog.findFirst({
          where: { bot_config_id: bot.id },
          orderBy: { created_at: 'desc' },
        });

        if (options.verbose && lastLog) {
          await showActionLogs(prisma, lastLog.session_id);
        }

        const afterSession = await getBotSnapshot(prisma, bot.player_id);
        afterSession.strategy = bot.strategy;

        printDiff(beforeSession, afterSession);

      } catch (err) {
        console.error(`\n❌ Session ${session} failed:`, err instanceof Error ? err.message : err);
      }
    }

    // Final summary
    const afterAll = await getBotSnapshot(prisma, bot.player_id);
    afterAll.strategy = bot.strategy;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`FINAL SUMMARY: ${afterAll.displayName}`);
    console.log(`${'='.repeat(80)}`);
    printDiff(beforeFirst, afterAll);
    console.log();
  }

  await app.close();
  console.log('\n✅ Simulation complete!\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
