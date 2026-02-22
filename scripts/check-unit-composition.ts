import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  try {
    const bots = await prisma.botConfig.findMany({
      where: { is_active: true },
      include: {
        player: {
          include: {
            units: true,
            economy: true,
          },
        },
      },
      take: 8,
    });

    console.log('\n📊 Bot Unit Composition & Gold:');
    console.log('='.repeat(90));

    for (const bot of bots) {
      const byType: Record<string, number> = {};
      bot.player.units.forEach((u) => {
        byType[u.unit_type] = (byType[u.unit_type] || 0) + u.quantity;
      });

      const total = Object.values(byType).reduce((a, c) => a + c, 0);
      const gold = Number(bot.player.economy?.gold ?? 0);

      console.log(`\n${bot.player.display_name.padEnd(20)} (${bot.strategy.padEnd(10)}) Gold: ${gold.toLocaleString().padStart(10)}`);
      console.log(`  Total Units: ${total.toLocaleString()}`);

      const sorted = Object.entries(byType).sort((a, b) => b[1] - a[1]);
      sorted.forEach(([type, qty]) => {
        const pct = ((qty / total) * 100).toFixed(1);
        console.log(`    ${type.padEnd(10)} ${qty.toLocaleString().padStart(6)} (${pct.padStart(5)}%)`);
      });
    }

    console.log('\n' + '='.repeat(90));
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
