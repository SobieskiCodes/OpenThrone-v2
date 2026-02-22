/**
 * Initialize default game settings
 * Run once after db:push to populate game_settings table
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Initializing default game settings...');

  const defaults = [
    {
      key: 'bot_chat_enabled',
      value: 'true',
      description: 'Enable bots to send messages in general chat',
    },
    {
      key: 'turns_per_tick',
      value: '1',
      description: 'Attack turns awarded per 30-minute tick',
    },
    {
      key: 'starting_gold',
      value: '25000',
      description: 'Gold awarded to new players',
    },
    {
      key: 'starting_citizens',
      value: '50',
      description: 'Citizens awarded to new players',
    },
  ];

  for (const setting of defaults) {
    const existing = await prisma.gameSettings.findUnique({
      where: { key: setting.key },
    });

    if (existing) {
      console.log(`  ⏭️  ${setting.key} already exists (current: ${existing.value})`);
    } else {
      await prisma.gameSettings.create({
        data: {
          key: setting.key,
          value: setting.value,
          description: setting.description,
        },
      });
      console.log(`  ✅ ${setting.key} = ${setting.value}`);
    }
  }

  console.log('\nSettings initialization complete!');
}

main()
  .catch((e) => {
    console.error('Error initializing settings:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
