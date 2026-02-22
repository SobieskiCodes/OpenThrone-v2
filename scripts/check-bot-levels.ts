import { PrismaClient } from '@prisma/client';
import { getLevelForXP } from '../packages/game-logic/src/xp';

const prisma = new PrismaClient();

(async () => {
  try {
    const bots = await prisma.player.findMany({
      where: { is_bot: true },
      select: {
        display_name: true,
        stats: {
          select: {
            experience: true,
          },
        },
        bonus_points: {
          select: {
            bonus_type: true,
            level: true,
          },
        },
      },
    });

    console.log('\n📊 Actual Bot Data:');
    console.log('='.repeat(80));

    for (const bot of bots) {
      const exp = Number(bot.stats?.experience ?? 0);
      const calcLevel = getLevelForXP(exp);
      const totalProfPoints = bot.bonus_points?.reduce((sum, bp) => sum + bp.level, 0) ?? 0;

      console.log(`\n${bot.display_name}:`);
      console.log(`  Experience: ${exp}`);
      console.log(`  Calculated Level: ${calcLevel}`);
      console.log(`  Allocated Proficiency Points: ${totalProfPoints}`);
      console.log(`  Available Points: ${calcLevel - totalProfPoints}`);

      if (bot.bonus_points && bot.bonus_points.length > 0) {
        console.log('  Proficiency Breakdown:');
        bot.bonus_points.forEach((bp) => {
          console.log(`    ${bp.bonus_type}: ${bp.level}`);
        });
      }
    }

    console.log('\n' + '='.repeat(80));
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
