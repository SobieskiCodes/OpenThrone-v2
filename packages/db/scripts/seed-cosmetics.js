/**
 * Seed cosmetics to production database
 * Run with: node packages/db/scripts/seed-cosmetics.js
 */

const { PrismaClient } = require('@prisma/client');

// Import cosmetics from compiled game-logic
const { ALL_COSMETICS } = require('../../game-logic/dist/cosmetics');

const prisma = new PrismaClient();

async function seedCosmetics() {
  console.log('Seeding cosmetics...');

  for (const cosmetic of ALL_COSMETICS) {
    await prisma.cosmetic.upsert({
      where: { id: cosmetic.id },
      update: {
        type: cosmetic.type,
        name: cosmetic.name,
        value: cosmetic.value,
        price: cosmetic.price,
        description: cosmetic.description || null,
      },
      create: {
        id: cosmetic.id,
        type: cosmetic.type,
        name: cosmetic.name,
        value: cosmetic.value,
        price: cosmetic.price,
        description: cosmetic.description || null,
      },
    });
  }

  console.log(`✅ Seeded ${ALL_COSMETICS.length} cosmetics`);
}

seedCosmetics()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Done!');
  })
  .catch(async (e) => {
    console.error('Error seeding cosmetics:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
