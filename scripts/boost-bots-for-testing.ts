import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  try {
    console.log('🚀 Boosting bots for Phase 0 + Phase 1 testing...\n');

    const bots = await prisma.botConfig.findMany({
      include: {
        player: {
          include: {
            stats: true,
            bonus_points: true,
            units: true,
            economy: true,
          }
        }
      }
    });

    for (const bot of bots) {
      const playerId = bot.player.id;

      // 1. Clear existing bonus points
      const deletedPoints = await prisma.playerBonusPoint.deleteMany({
        where: { player_id: playerId }
      });
      console.log(`📝 ${bot.player.display_name}: Cleared ${deletedPoints.count} old bonus points`);

      // 2. Give them XP for level 10 (2^10 - 1 = 1023 XP)
      const targetXP = Math.pow(2, 10) - 1;
      await prisma.playerStats.upsert({
        where: { player_id: playerId },
        update: { experience: BigInt(targetXP) },
        create: {
          player_id: playerId,
          experience: BigInt(targetXP),
          offense: 100,
          defense: 100,
          spy: 50,
          sentry: 50,
          rank: 0,
        }
      });

      // 3. Give them 1500 units (exit early-game mode)
      // Clear existing units first
      await prisma.playerUnit.deleteMany({
        where: { player_id: playerId }
      });

      // Add units based on strategy
      if (bot.strategy === 'WARRIOR') {
        await prisma.playerUnit.createMany({
          data: [
            { player_id: playerId, unit_type: 'CITIZEN', level: 1, quantity: 200 },
            { player_id: playerId, unit_type: 'WORKER', level: 1, quantity: 300 },
            { player_id: playerId, unit_type: 'OFFENSE', level: 1, quantity: 700 },
            { player_id: playerId, unit_type: 'DEFENSE', level: 1, quantity: 200 },
            { player_id: playerId, unit_type: 'SPY', level: 1, quantity: 50 },
            { player_id: playerId, unit_type: 'SENTRY', level: 1, quantity: 50 },
          ]
        });
      } else if (bot.strategy === 'TURTLE') {
        await prisma.playerUnit.createMany({
          data: [
            { player_id: playerId, unit_type: 'CITIZEN', level: 1, quantity: 200 },
            { player_id: playerId, unit_type: 'WORKER', level: 1, quantity: 400 },
            { player_id: playerId, unit_type: 'OFFENSE', level: 1, quantity: 200 },
            { player_id: playerId, unit_type: 'DEFENSE', level: 1, quantity: 600 },
            { player_id: playerId, unit_type: 'SPY', level: 1, quantity: 50 },
            { player_id: playerId, unit_type: 'SENTRY', level: 1, quantity: 50 },
          ]
        });
      } else if (bot.strategy === 'ECONOMIST') {
        await prisma.playerUnit.createMany({
          data: [
            { player_id: playerId, unit_type: 'CITIZEN', level: 1, quantity: 200 },
            { player_id: playerId, unit_type: 'WORKER', level: 1, quantity: 1000 },
            { player_id: playerId, unit_type: 'OFFENSE', level: 1, quantity: 100 },
            { player_id: playerId, unit_type: 'DEFENSE', level: 1, quantity: 150 },
            { player_id: playerId, unit_type: 'SPY', level: 1, quantity: 25 },
            { player_id: playerId, unit_type: 'SENTRY', level: 1, quantity: 25 },
          ]
        });
      } else if (bot.strategy === 'SPYMASTER') {
        await prisma.playerUnit.createMany({
          data: [
            { player_id: playerId, unit_type: 'CITIZEN', level: 1, quantity: 200 },
            { player_id: playerId, unit_type: 'WORKER', level: 1, quantity: 300 },
            { player_id: playerId, unit_type: 'OFFENSE', level: 1, quantity: 200 },
            { player_id: playerId, unit_type: 'DEFENSE', level: 1, quantity: 200 },
            { player_id: playerId, unit_type: 'SPY', level: 1, quantity: 500 },
            { player_id: playerId, unit_type: 'SENTRY', level: 1, quantity: 100 },
          ]
        });
      } else {
        // BALANCED
        await prisma.playerUnit.createMany({
          data: [
            { player_id: playerId, unit_type: 'CITIZEN', level: 1, quantity: 200 },
            { player_id: playerId, unit_type: 'WORKER', level: 1, quantity: 400 },
            { player_id: playerId, unit_type: 'OFFENSE', level: 1, quantity: 300 },
            { player_id: playerId, unit_type: 'DEFENSE', level: 1, quantity: 300 },
            { player_id: playerId, unit_type: 'SPY', level: 1, quantity: 150 },
            { player_id: playerId, unit_type: 'SENTRY', level: 1, quantity: 150 },
          ]
        });
      }

      // 4. Give them gold and attack turns
      await prisma.playerEconomy.update({
        where: { player_id: playerId },
        data: {
          gold: BigInt(50000),
          gold_in_bank: BigInt(100000),
          attack_turns: 20,
        }
      });

      console.log(`   ✅ Boosted to Level 10, 1500 units, 50k gold, 20 attack turns`);
    }

    console.log(`\n✅ All ${bots.length} bots boosted for testing!`);
    console.log('\n📊 Expected behavior on next bot run:');
    console.log('   - Phase 0: ALLOCATE_BONUS_POINTS actions (10 points available)');
    console.log('   - Phase 1: SPY_MISSION and ATTACK_PLAYER actions');
    console.log('   - Intelligence tables will populate after spy/battle actions\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
