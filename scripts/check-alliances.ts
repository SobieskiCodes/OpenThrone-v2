import { PrismaClient } from '@openthrone/db';

const prisma = new PrismaClient();

async function main() {
  // Check active bots and their alliance memberships
  const bots = await prisma.botConfig.findMany({
    where: { is_active: true },
    include: {
      player: {
        select: {
          display_name: true,
          alliance_membership: {
            include: {
              alliance: {
                select: {
                  id: true,
                  name: true,
                  allow_bots: true,
                  closed_enrollment: true,
                  leader: {
                    select: { display_name: true }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  console.log('\n🤖 BOTS AND THEIR ALLIANCES:\n');
  
  let botsInAlliances = 0;
  let botsWithoutAlliances = 0;
  
  bots.forEach(bot => {
    const memberships = bot.player.alliance_membership;
    if (memberships.length > 0) {
      console.log(`✅ ${bot.player.display_name} (${bot.strategy})`);
      memberships.forEach(m => {
        console.log(`   └─ ${m.alliance.name} (Leader: ${m.alliance.leader.display_name})`);
      });
      botsInAlliances++;
    } else {
      console.log(`❌ ${bot.player.display_name} (${bot.strategy}) - No alliance`);
      botsWithoutAlliances++;
    }
  });

  console.log(`\n📊 Summary: ${botsInAlliances} bots in alliances, ${botsWithoutAlliances} without\n`);

  // Check all alliances
  const alliances = await prisma.alliance.findMany({
    include: {
      leader: {
        select: { display_name: true }
      },
      memberships: {
        include: {
          user: {
            select: { display_name: true }
          }
        }
      }
    }
  });

  console.log('🏰 ALL ALLIANCES:\n');
  
  if (alliances.length === 0) {
    console.log('⚠️  NO ALLIANCES EXIST!\n');
    console.log('This is why bots aren\'t joining - there\'s nothing to join.');
    console.log('Bots can only JOIN alliances, they cannot CREATE them.\n');
  } else {
    alliances.forEach(alliance => {
      console.log(`${alliance.name} (Leader: ${alliance.leader.display_name})`);
      console.log(`   Members: ${alliance.memberships.length}`);
      console.log(`   allow_bots: ${alliance.allow_bots}`);
      console.log(`   closed_enrollment: ${alliance.closed_enrollment}`);
      
      if (alliance.memberships.length > 0) {
        const members = alliance.memberships.map(m => m.user.display_name).join(', ');
        console.log(`   └─ ${members}`);
      }
      console.log();
    });
  }

  // Check JOIN_ALLIANCE attempts
  const joinAttempts = await prisma.botActionLog.findMany({
    where: { action_type: 'JOIN_ALLIANCE' },
    orderBy: { timestamp: 'desc' },
    take: 10,
    include: {
      bot_config: {
        include: {
          player: { select: { display_name: true } }
        }
      }
    }
  });

  console.log(`\n📜 JOIN_ALLIANCE ATTEMPTS (Last 10):\n`);
  
  if (joinAttempts.length === 0) {
    console.log('No JOIN_ALLIANCE attempts found.\n');
  } else {
    joinAttempts.forEach(attempt => {
      const botName = attempt.bot_config?.player?.display_name || 'Unknown';
      const status = attempt.success ? '✅' : '❌';
      console.log(`${status} ${botName} - ${attempt.timestamp.toLocaleDateString()} ${attempt.timestamp.toLocaleTimeString()}`);
      if (!attempt.success && attempt.error_message) {
        console.log(`   Error: ${attempt.error_message}`);
      }
      if (attempt.reasoning) {
        console.log(`   Reasoning: ${attempt.reasoning}`);
      }
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
