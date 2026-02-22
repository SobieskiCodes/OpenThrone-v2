import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  try {
    const failedActions = await prisma.botActionLog.findMany({
      where: { success: false },
      orderBy: { created_at: 'desc' },
      take: 10,
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

    console.log(`❌ Last ${failedActions.length} Failed Actions:\n`);

    for (const action of failedActions) {
      console.log(`🤖 ${action.bot_config.player.display_name} - [${action.action_type}]`);
      console.log(`   Reasoning: ${action.reasoning.substring(0, 100)}...`);
      console.log(`   ❌ Error: ${action.error_message}`);
      console.log(`   📅 ${action.created_at.toLocaleString()}\n`);
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
