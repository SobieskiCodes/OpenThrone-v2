import { PrismaClient } from '@prisma/client';
import { getLevelForXP } from '@openthrone/game-logic';

const prisma = new PrismaClient();

(async () => {
  try {
    const bots = await prisma.botConfig.findMany({
      include: {
        player: {
          include: {
            stats: true,
            economy: true,
            bonus_points: true,
            units: true,
          }
        }
      },
      take: 10,
    });

    console.log(`🤖 Found ${bots.length} bots\n`);

    for (const bot of bots) {
      const xp = Number(bot.player.stats?.experience || 0);
      const level = getLevelForXP(xp);
      const bonusPointsCount = bot.player.bonus_points?.length || 0;
      const availablePoints = level - bonusPointsCount;

      const totalUnits = bot.player.units?.reduce((sum, u) => sum + u.quantity, 0) || 0;
      const gold = Number(bot.player.economy?.gold || 0);
      const attackTurns = bot.player.economy?.attack_turns || 0;

      console.log(`📊 ${bot.player.display_name} (${bot.strategy})`);
      console.log(`   Level: ${level} | XP: ${xp.toLocaleString()}`);
      console.log(`   Bonus Points: ${bonusPointsCount} spent, ${availablePoints} available`);
      console.log(`   Population: ${totalUnits} units | Gold: ${gold.toLocaleString()}`);
      console.log(`   Attack Turns: ${attackTurns}`);
      console.log(`   Early Game: ${totalUnits < 1000 ? 'YES ⚠️' : 'NO ✅'}`);

      if (availablePoints > 0) {
        console.log(`   🎯 Should allocate ${availablePoints} bonus points!`);
      }
      console.log('');
    }

    // Check if any bots have proficiency points in DB
    const playersWithPoints = await prisma.bonusPoint.groupBy({
      by: ['player_id'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    if (playersWithPoints.length > 0) {
      console.log('\n📈 Players with most bonus points allocated:');
      for (const p of playersWithPoints) {
        const player = await prisma.player.findUnique({
          where: { id: p.player_id },
          select: { display_name: true },
        });
        console.log(`   ${player?.display_name}: ${p._count.id} points`);
      }
    } else {
      console.log('\n⚠️  No players have allocated any bonus points yet!');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
