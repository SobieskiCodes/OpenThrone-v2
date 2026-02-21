const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setFakePreviousRank() {
  const playerId = '0a606042-8e17-41c8-9b00-c047e1d8f216';
  
  console.log('Setting fake previous_rank for TestKnight...');
  
  await prisma.playerStats.update({
    where: { player_id: playerId },
    data: { previous_rank: 25 },
  });
  
  console.log('✅ Set previous_rank = 25');
  console.log('Current rank: 19');
  console.log('Expected arrow: ▲ +6 (moved up 6 spots)');
  console.log('\nRefresh the rankings page (All-Time) to see the arrow!');
  
  await prisma.$disconnect();
}

setFakePreviousRank().catch(console.error);
