import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  try {
    console.log('🗑️  Clearing bot action logs...');

    const result = await prisma.botActionLog.deleteMany({});

    console.log(`✅ Deleted ${result.count} bot action logs`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
