import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  try {
    const [intel, battles, threats] = await Promise.all([
      prisma.botIntelCache.count(),
      prisma.botBattleMemory.count(),
      prisma.botThreatTracking.count(),
    ]);

    console.log('\n🧠 Intelligence Data After Simulation:');
    console.log('   📊 Intel Cache:', intel, 'records');
    console.log('   ⚔️  Battle Memory:', battles, 'records');
    console.log('   🎯 Threat Tracking:', threats, 'records\n');

    // Show sample battle memory
    if (battles > 0) {
      const sampleBattles = await prisma.botBattleMemory.findMany({
        take: 5,
        orderBy: { timestamp: 'desc' },
      });
      console.log('📜 Recent Battles:');
      for (const b of sampleBattles) {
        console.log(`   ${b.is_win ? '✅' : '❌'} vs ${b.target_name}: ${b.gold_stolen} gold, ${b.units_lost} casualties`);
      }
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
