import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  try {
    const actionTypes = await prisma.botActionLog.groupBy({
      by: ['action_type', 'success'],
      _count: true,
    });

    console.log('\n📊 Action Type Breakdown:');
    actionTypes.forEach((at) => {
      const count = typeof at._count === 'number' ? at._count : at._count._all || 0;
      console.log(`  ${count} ${at.action_type} (${at.success ? '✅' : '❌'})`);
    });

    const totalLogs = await prisma.botActionLog.count();
    console.log(`\nTotal logs: ${totalLogs}`);

    // Sample some actions
    const sample = await prisma.botActionLog.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      select: {
        action_type: true,
        reasoning: true,
        success: true,
        error_message: true,
      },
    });

    console.log('\n📝 Sample Actions:');
    sample.forEach((s) => {
      console.log(`  ${s.action_type}: ${s.reasoning}`);
      console.log(`    Success: ${s.success}, Error: ${s.error_message || 'none'}`);
    });

    // Check proficiency allocations
    const profAllocations = await prisma.botActionLog.findMany({
      where: { action_type: 'ALLOCATE_BONUS_POINTS' },
      select: { success: true, error_message: true, reasoning: true },
      take: 10,
    });

    console.log(`\n🎯 Proficiency Allocations (${profAllocations.length} total):`);
    profAllocations.slice(0, 5).forEach((p) => {
      console.log(`  ${p.success ? '✅' : '❌'} ${p.reasoning}`);
      if (!p.success) console.log(`    Error: ${p.error_message}`);
    });

    // Check rate limit errors
    const rateLimitErrors = await prisma.botActionLog.count({
      where: {
        success: false,
        error_message: { contains: 'Maximum' },
      },
    });

    console.log(`\n⏱️  Rate Limit Errors: ${rateLimitErrors}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
