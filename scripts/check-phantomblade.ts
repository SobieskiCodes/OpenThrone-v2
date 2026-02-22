import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  try {
    const pb = await prisma.botConfig.findFirst({
      where: { player: { display_name: 'PhantomBlade' } },
      include: { player: true },
    });

    if (!pb) {
      console.log('PhantomBlade not found!');
      return;
    }

    const actions = await prisma.botActionLog.groupBy({
      by: ['action_type', 'success'],
      where: { bot_config_id: pb.id },
      _count: true,
    });

    console.log(`\n🔍 PhantomBlade (Strategy: ${pb.strategy}) Action Breakdown:`);
    console.log('='.repeat(80));
    actions.forEach((a) => {
      console.log(`  ${a.action_type.padEnd(25)} ${a._count.toString().padStart(4)} (${a.success ? '✅' : '❌'})`);
    });

    // Check attack success rate specifically
    const attacks = actions.filter((a) => a.action_type === 'ATTACK_PLAYER');
    if (attacks.length > 0) {
      const successful = attacks.find((a) => a.success)?._count ?? 0;
      const failed = attacks.find((a) => !a.success)?._count ?? 0;
      console.log(`\n  Attack Summary: ${successful} successes, ${failed} failures`);
    }

    // Check attack failure reasons
    const attackErrors = await prisma.botActionLog.groupBy({
      by: ['error_message'],
      where: { bot_config_id: pb.id, action_type: 'ATTACK_PLAYER', success: false },
      _count: true,
    });

    if (attackErrors.length > 0) {
      console.log('\n❌ Attack Failure Reasons:');
      attackErrors.forEach((e) => {
        console.log(`  ${e._count.toString().padStart(4)}x: ${e.error_message}`);
      });
    }

    console.log('\n' + '='.repeat(80));
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
