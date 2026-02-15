const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setRankDown() {
  const playerId = '0a606042-8e17-41c8-9b00-c047e1d8f216';
  
  await prisma.playerStats.update({
    where: { player_id: playerId },
    data: { previous_rank: 15 },
  });
  
  console.log('✅ Set previous_rank = 15');
  console.log('Current rank: 19');
  console.log('Expected arrow: ▼ -4 (moved down 4 spots)');
  
  await prisma.$disconnect();
}

setRankDown().catch(console.error);
