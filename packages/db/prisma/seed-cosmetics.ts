import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding cosmetics...');

  const nameColors = [
    { id: 'color-royal-purple', type: 'NAME_COLOR', name: 'Royal Purple', value: '#9333EA', price: BigInt(50000), description: 'A regal purple fit for nobility' },
    { id: 'color-blood-red', type: 'NAME_COLOR', name: 'Blood Red', value: '#DC2626', price: BigInt(50000), description: 'Strike fear into your enemies' },
    { id: 'color-golden', type: 'NAME_COLOR', name: 'Golden', value: '#F59E0B', price: BigInt(75000), description: 'Shine like treasure' },
    { id: 'color-emerald', type: 'NAME_COLOR', name: 'Emerald', value: '#10B981', price: BigInt(75000), description: 'Vibrant and verdant' },
    { id: 'color-sapphire', type: 'NAME_COLOR', name: 'Sapphire', value: '#3B82F6', price: BigInt(75000), description: 'Deep as the ocean' },
    { id: 'color-shadow', type: 'NAME_COLOR', name: 'Shadow', value: '#475569', price: BigInt(100000), description: 'Lurk in darkness' },
    { id: 'color-flame', type: 'NAME_COLOR', name: 'Flame', value: '#F97316', price: BigInt(100000), description: 'Burn bright' },
  ];

  const icons = [
    { id: 'icon-crown', type: 'ICON', name: 'Crown', value: '👑', price: BigInt(100000), description: 'Show your royal status' },
    { id: 'icon-sword', type: 'ICON', name: 'Crossed Swords', value: '⚔️', price: BigInt(75000), description: 'A warrior\'s mark' },
    { id: 'icon-shield', type: 'ICON', name: 'Shield', value: '🛡️', price: BigInt(75000), description: 'Defender of the realm' },
    { id: 'icon-fire', type: 'ICON', name: 'Fire', value: '🔥', price: BigInt(150000), description: 'Unleash destruction' },
    { id: 'icon-skull', type: 'ICON', name: 'Skull', value: '💀', price: BigInt(125000), description: 'Death comes for all' },
    { id: 'icon-star', type: 'ICON', name: 'Star', value: '⭐', price: BigInt(125000), description: 'Shine among legends' },
    { id: 'icon-dragon', type: 'ICON', name: 'Dragon', value: '🐉', price: BigInt(200000), description: 'Rare and powerful' },
  ];

  for (const cosmetic of [...nameColors, ...icons]) {
    await prisma.cosmetic.upsert({
      where: { id: cosmetic.id },
      create: cosmetic,
      update: cosmetic,
    });
  }

  console.log(`✅ Created/updated ${nameColors.length + icons.length} cosmetics`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
