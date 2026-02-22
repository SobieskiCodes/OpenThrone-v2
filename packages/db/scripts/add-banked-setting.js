const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.gameSettings.upsert({
    where: { key: 'starting_gold_banked' },
    update: {},
    create: {
      key: 'starting_gold_banked',
      value: 'false',
      description: 'Whether starting gold should be placed in bank instead of wallet',
    },
  });
  console.log('Added starting_gold_banked setting');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
