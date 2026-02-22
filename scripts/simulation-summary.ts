import { PrismaClient } from '@prisma/client';
import { getLevelForXP } from '../packages/game-logic/src/xp';

const prisma = new PrismaClient();

(async () => {
  try {
    console.log('\n📊 SIMULATION SUMMARY\n');
    console.log('='.repeat(80));

    // Action type breakdown
    const actions = await prisma.botActionLog.groupBy({
      by: ['action_type', 'success'],
      _count: true,
    });

    console.log('\n🎯 Action Results:');
    const successActions = actions.filter((a) => a.success);
    const failActions = actions.filter((a) => !a.success);

    successActions.forEach((a) => {
      const failCount = failActions.find((f) => f.action_type === a.action_type)?._count ?? 0;
      const totalCount = a._count + failCount;
      const successRate = ((a._count / totalCount) * 100).toFixed(0);
      console.log(
        `  ✅ ${a.action_type.padEnd(25)} ${a._count}/${totalCount} (${successRate}% success)`,
      );
    });

    failActions
      .filter((a) => !successActions.find((s) => s.action_type === a.action_type))
      .forEach((a) => {
        console.log(`  ❌ ${a.action_type.padEnd(25)} 0/${a._count} (0% success)`);
      });

    // Bot states
    const bots = await prisma.botConfig.findMany({
      where: { is_active: true },
      include: {
        player: {
          include: {
            stats: true,
            economy: true,
            units: true,
            bonus_points: true,
          },
        },
      },
    });

    console.log('\n🤖 Bot States:');
    for (const bot of bots) {
      const exp = Number(bot.player.stats?.experience ?? 0);
      const level = getLevelForXP(exp);
      const totalUnits =
        bot.player.units?.reduce((sum, u) => sum + u.quantity, 0) ?? 0;
      const allocatedPoints =
        bot.player.bonus_points?.reduce((sum, bp) => sum + bp.level, 0) ?? 0;

      console.log(
        `  ${bot.player.display_name.padEnd(20)} Lv${level} | ${Number(bot.player.economy?.gold ?? 0).toLocaleString()} gold | ${totalUnits.toLocaleString()} units | ${Number(bot.player.economy?.attack_turns ?? 0)} turns | ${allocatedPoints} prof points`,
      );
    }

    // Sample errors
    const errors = await prisma.botActionLog.findMany({
      where: {
        success: false,
        error_message: { not: null },
      },
      select: { error_message: true },
      distinct: ['error_message'],
      take: 5,
    });

    if (errors.length > 0) {
      console.log('\n❌ Sample Errors:');
      errors.forEach((e) => {
        console.log(`  - ${e.error_message}`);
      });
    }

    // Intelligence data
    const [intelCount, battleCount, threatCount] = await Promise.all([
      prisma.botIntelCache.count(),
      prisma.botBattleMemory.count(),
      prisma.botThreatTracking.count(),
    ]);

    console.log('\n🧠 Intelligence Data:');
    console.log(`  📊 Intel Cache: ${intelCount} records`);
    console.log(`  ⚔️  Battle Memory: ${battleCount} records`);
    console.log(`  🎯 Threat Tracking: ${threatCount} records`);

    console.log('\n' + '='.repeat(80) + '\n');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
