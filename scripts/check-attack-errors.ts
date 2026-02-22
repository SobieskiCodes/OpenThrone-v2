import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  try {
    // Get failed attack actions with error messages
    const failedAttacks = await prisma.botActionLog.findMany({
      where: {
        action_type: 'ATTACK',
        success: false,
      },
      select: {
        id: true,
        bot_config_id: true,
        action_data: true,
        reasoning: true,
        error_message: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    console.log('\n❌ Failed Attack Actions (most recent 10):');
    console.log('='.repeat(80));

    for (const attack of failedAttacks) {
      const data = JSON.parse(attack.action_data);
      console.log(`\nBot: ${attack.bot_config_id}`);
      console.log(`Target: ${data.targetId || 'N/A'}`);
      console.log(`Turns: ${data.turns || 'N/A'}`);
      console.log(`Reasoning: ${attack.reasoning}`);
      console.log(`Error: ${attack.error_message || 'No error message'}`);
      console.log('-'.repeat(80));
    }

    // Get error message breakdown
    const errorCounts = await prisma.botActionLog.groupBy({
      by: ['error_message'],
      where: {
        action_type: 'ATTACK',
        success: false,
      },
      _count: true,
    });

    console.log('\n📊 Error Message Breakdown:');
    errorCounts.forEach((err) => {
      console.log(`  ${err._count} - ${err.error_message || 'No error message'}`);
    });

    // Also check successful attacks
    const successCount = await prisma.botActionLog.count({
      where: {
        action_type: 'ATTACK',
        success: true,
      },
    });

    console.log(`\n✅ Successful attacks: ${successCount}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
