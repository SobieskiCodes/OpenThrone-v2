import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  try {
    const count = await prisma.botActionLog.count();
    console.log('📊 Total bot action logs:', count);

    if (count === 0) {
      console.log('\n⚠️  No bot logs found. Run a bot session first!');
      await prisma.$disconnect();
      return;
    }

    // Check for Phase 0: ALLOCATE_BONUS_POINTS actions
    const bonusPointsActions = await prisma.botActionLog.count({
      where: { action_type: 'ALLOCATE_BONUS_POINTS' }
    });
    console.log('\n✨ Phase 0 - Bonus Points Actions:', bonusPointsActions);

    // Check for Phase 1: SPY_MISSION and ATTACK_PLAYER actions
    const spyActions = await prisma.botActionLog.count({
      where: { action_type: 'SPY_MISSION' }
    });
    const attackActions = await prisma.botActionLog.count({
      where: { action_type: 'ATTACK_PLAYER' }
    });
    console.log('🕵️  Phase 1 - Spy Missions:', spyActions);
    console.log('⚔️  Phase 1 - Attacks:', attackActions);

    // Show last 10 actions
    const recent = await prisma.botActionLog.findMany({
      take: 10,
      orderBy: { created_at: 'desc' },
      include: {
        bot_config: {
          include: {
            player: {
              select: { display_name: true }
            }
          }
        }
      }
    });

    console.log('\n📜 Last 10 Bot Actions:\n');
    recent.forEach((log, i) => {
      const status = log.success ? '✅' : '❌';
      const botName = log.bot_config.player.display_name;
      const time = log.created_at.toLocaleString();
      const reasoning = log.reasoning.substring(0, 100);
      console.log(`${i + 1}. [${log.action_type}] ${status} - ${botName}`);
      console.log(`   ${reasoning}${log.reasoning.length > 100 ? '...' : ''}`);
      console.log(`   ${time}\n`);
    });

    // Check intelligence tables
    const intelCount = await prisma.botIntelCache.count();
    const battleCount = await prisma.botBattleMemory.count();
    const threatCount = await prisma.botThreatTracking.count();

    console.log('🧠 Intelligence Data:');
    console.log(`   Intel Cache: ${intelCount} records`);
    console.log(`   Battle Memory: ${battleCount} records`);
    console.log(`   Threat Tracking: ${threatCount} records`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
