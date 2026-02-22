/**
 * Check for bot chat messages in the database
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for bot chat messages...\n');

  // Get all bots
  const bots = await prisma.botConfig.findMany({
    select: {
      player_id: true,
      player: {
        select: {
          display_name: true,
        },
      },
    },
    take: 5,
  });

  console.log(`Found ${bots.length} bots:`);
  bots.forEach((bot) => {
    console.log(`  - ${bot.player.display_name} (${bot.player_id})`);
  });

  // Get general chat room
  const generalRoom = await prisma.chatRoom.findFirst({
    where: { name: 'general', is_private: false },
  });

  if (!generalRoom) {
    console.log('\nNo general chat room found!');
    return;
  }

  console.log(`\nGeneral chat room: ${generalRoom.name} (${generalRoom.id})\n`);

  // Get recent bot messages
  const botIds = bots.map((b) => b.player_id);
  const messages = await prisma.chatMessage.findMany({
    where: {
      room_id: generalRoom.id,
      sender_id: { in: botIds },
    },
    include: {
      sender: {
        select: {
          display_name: true,
        },
      },
    },
    orderBy: { sent_at: 'desc' },
    take: 20,
  });

  if (messages.length === 0) {
    console.log('No bot messages found in general chat.');
  } else {
    console.log(`Found ${messages.length} bot messages:\n`);
    messages.forEach((msg) => {
      const time = new Date(msg.sent_at).toLocaleTimeString();
      console.log(`[${time}] ${msg.sender.display_name}: ${msg.content}`);
    });
  }

  // Check bot_chat_enabled setting
  const chatSetting = await prisma.gameSettings.findUnique({
    where: { key: 'bot_chat_enabled' },
  });

  console.log(`\nBot chat enabled: ${chatSetting ? chatSetting.value : 'NOT SET'}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
