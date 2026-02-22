import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
  try {
    const botConfigs = await prisma.botConfig.findMany({
      where: { is_active: true },
      select: { player_id: true },
    });
    const botIds = botConfigs.map(b => b.player_id);

    console.log(`\nActive bots: ${botIds.length}`);

    const botVsBotAttacks = await prisma.attackLog.count({
      where: {
        type: 'attack',
        attacker_id: { in: botIds },
        defender_id: { in: botIds },
      },
    });

    const botVsHumanAttacks = await prisma.attackLog.count({
      where: {
        type: 'attack',
        attacker_id: { in: botIds },
        defender_id: { notIn: botIds },
      },
    });

    // Check how many times bots lost defense battles to humans
    // (winner is attacker_id, defender is bot, attacker is not bot)
    const botDefenseLosses = await prisma.attackLog.count({
      where: {
        type: 'attack',
        defender_id: { in: botIds },
        attacker_id: { notIn: botIds }, // Human attacker
        OR: [
          { winner: { in: botIds, equals: undefined } },
          { AND: [
            { winner: { not: '' } },
            { winner: { not: { in: botIds } } },
          ]},
        ],
      },
    });

    // Check bot vs bot battles where defending bot lost
    const allLogs = await prisma.attackLog.findMany({
      where: {
        type: 'attack',
        defender_id: { in: botIds },
      },
      select: {
        id: true,
        attacker_id: true,
        defender_id: true,
        winner: true,
      },
    });

    // Manually filter for losses (where winner != defender_id)
    const botDefenseToHuman = allLogs.filter(log =>
      !botIds.includes(log.attacker_id) && // Attacker is human
      log.winner && // Winner exists
      log.winner === log.attacker_id // Attacker won (defender lost)
    ).length;

    const botDefenseToBot = allLogs.filter(log =>
      botIds.includes(log.attacker_id) && // Attacker is bot
      log.winner && // Winner exists
      log.winner === log.attacker_id // Attacker won (defender lost)
    ).length;

    const currentThreats = await prisma.botThreatTracking.count();

    console.log('\n📊 Attack Pattern Analysis:');
    console.log('='.repeat(60));
    console.log(`  Bot vs Bot attacks:           ${botVsBotAttacks}`);
    console.log(`  Bot vs Human attacks:         ${botVsHumanAttacks}`);
    console.log(`  Bot lost defense to humans:   ${botDefenseToHuman}`);
    console.log(`  Bot lost defense to bots:     ${botDefenseToBot}`);
    console.log('');
    console.log(`  Expected threat records:      ${botDefenseToHuman + botDefenseToBot}`);
    console.log(`  Actual threat records:        ${currentThreats}`);
    console.log('='.repeat(60));

    // Show which bots lost defense
    if (botDefenseToHuman > 0 || botDefenseToBot > 0) {
      console.log('\nBot defense losses (should have threat tracking):');
      const losses = allLogs.filter(log =>
        log.winner && log.winner === log.attacker_id
      );

      for (const log of losses.slice(0, 5)) {
        const attacker = await prisma.player.findUnique({
          where: { id: log.attacker_id },
          select: { display_name: true },
        });
        const defender = await prisma.player.findUnique({
          where: { id: log.defender_id },
          select: { display_name: true },
        });
        console.log(`  ${attacker?.display_name} defeated ${defender?.display_name} (log ID: ${log.id})`);
      }
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
