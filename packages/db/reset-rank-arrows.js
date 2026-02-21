const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetRankArrows() {
  const playerId = '0a606042-8e17-41c8-9b00-c047e1d8f216';
  
  await prisma.playerStats.update({
    where: { player_id: playerId },
    data: { previous_rank: 0 },
  });
  
  console.log('✅ Reset previous_rank = 0');
  console.log('Arrows should disappear on next refresh');
  
  await prisma.$disconnect();
}

resetRankArrows().catch(console.error);
