import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  try {
    const result = await prisma.botConfig.updateMany({
      data: {
        sessions_per_day: 30,
      },
    });

    console.log(`✅ Updated ${result.count} bot configs to 30 sessions/day`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
