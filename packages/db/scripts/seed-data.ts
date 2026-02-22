import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { ALL_COSMETICS } from '@openthrone/game-logic';

const RACES = ['HUMAN', 'ELF', 'GOBLIN', 'UNDEAD'] as const;
const CLASSES = ['FIGHTER', 'CLERIC', 'ASSASSIN', 'THIEF'] as const;
const BONUS_TYPES = ['OFFENSE', 'DEFENSE', 'INTEL', 'PRICES', 'INCOME'] as const;
const BUILDING_TYPES = ['FORTIFICATION', 'ARMORY', 'MINE', 'SPY_ACADEMY', 'HOUSING', 'MERCENARY_CAMP'] as const;

interface TestPlayer {
  email: string;
  displayName: string;
  password: string;
  race: string;
  playerClass: string;
  bio: string;
  gold: bigint;
}

const TEST_PLAYERS: TestPlayer[] = [
  {
    email: 'testplayer1@openthrone.dev',
    displayName: 'TestKnight',
    password: 'password123',
    race: 'HUMAN',
    playerClass: 'FIGHTER',
    bio: 'A brave human fighter ready for battle.',
    gold: BigInt(50000),
  },
  {
    email: 'testplayer2@openthrone.dev',
    displayName: 'ShadowLeaf',
    password: 'password123',
    race: 'ELF',
    playerClass: 'ASSASSIN',
    bio: 'A stealthy elf assassin lurking in the shadows.',
    gold: BigInt(30000),
  },
  {
    email: 'testplayer3@openthrone.dev',
    displayName: 'GrimReaper',
    password: 'password123',
    race: 'UNDEAD',
    playerClass: 'CLERIC',
    bio: 'An undead cleric who commands dark forces.',
    gold: BigInt(40000),
  },
  {
    email: 'testplayer4@openthrone.dev',
    displayName: 'SkullCrusher',
    password: 'password123',
    race: 'GOBLIN',
    playerClass: 'FIGHTER',
    bio: 'A goblin fighter with a nasty temper.',
    gold: BigInt(35000),
  },
  {
    email: 'testplayer5@openthrone.dev',
    displayName: 'IronFist',
    password: 'password123',
    race: 'HUMAN',
    playerClass: 'THIEF',
    bio: 'A human thief who steals from the rich.',
    gold: BigInt(60000),
  },
  {
    email: 'testplayer6@openthrone.dev',
    displayName: 'MoonWhisper',
    password: 'password123',
    race: 'ELF',
    playerClass: 'CLERIC',
    bio: 'An elf cleric attuned to the moonlight.',
    gold: BigInt(45000),
  },
];

const BOT_CONFIGS = [
  {
    displayName: 'IronGuard',
    race: 'HUMAN',
    playerClass: 'FIGHTER',
    strategy: 'WARRIOR',
    gold: BigInt(25000),
  },
  {
    displayName: 'StoneShield',
    race: 'HUMAN',
    playerClass: 'CLERIC',
    strategy: 'TURTLE',
    gold: BigInt(30000),
  },
  {
    displayName: 'GoldWeaver',
    race: 'ELF',
    playerClass: 'THIEF',
    strategy: 'ECONOMIST',
    gold: BigInt(80000),
  },
  {
    displayName: 'PhantomBlade',
    race: 'UNDEAD',
    playerClass: 'ASSASSIN',
    strategy: 'SPYMASTER',
    gold: BigInt(20000),
  },
  {
    displayName: 'WarChief',
    race: 'GOBLIN',
    playerClass: 'FIGHTER',
    strategy: 'BALANCED',
    gold: BigInt(40000),
  },
];

/**
 * Seed the database with test players, bots, and initial data.
 * Can be called from the seed script or from the admin reset endpoint.
 */
export async function seedDatabase(prisma: PrismaClient) {
  console.log('Seeding database...');

  // Wipe all existing data (PostgreSQL only - uses TRUNCATE CASCADE)
  const isProduction = process.env.DATABASE_URL?.includes('postgresql');

  if (isProduction) {
    console.log('Wiping existing data (production mode)...');

    // Get all table names from the database
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `;

    // Truncate all tables in one go with CASCADE
    const tableNames = tables.map(t => `"${t.tablename}"`).join(', ');
    if (tableNames) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
    }

    console.log('Database wiped successfully');
  } else {
    console.log('Skipping database wipe (dev mode with SQLite)');
  }

  const players: { id: string; displayName: string }[] = [];

  // Create test players
  for (const tp of TEST_PLAYERS) {
    const passwordHash = await argon2.hash(tp.password);

    const player = await prisma.player.create({
      data: {
        email: tp.email,
        display_name: tp.displayName,
        password_hash: passwordHash,
        race: tp.race,
        player_class: tp.playerClass,
        bio: tp.bio,
        last_active: new Date(),
      },
    });

    players.push({ id: player.id, displayName: player.display_name });
    console.log(`Created player: ${player.display_name}`);

    // Economy
    await prisma.playerEconomy.create({
      data: {
        player_id: player.id,
        gold: tp.gold,
        gold_in_bank: BigInt(0),
        attack_turns: 50,
      },
    });

    // Units (50 citizens)
    await prisma.playerUnit.create({
      data: {
        player_id: player.id,
        unit_type: 'CITIZEN',
        level: 1,
        quantity: 50,
      },
    });

    // Fortification
    await prisma.playerFortification.create({
      data: {
        player_id: player.id,
        fort_level: 0,
        hitpoints: 50,
      },
    });

    // Buildings (all start at level 0)
    for (const buildingType of BUILDING_TYPES) {
      await prisma.playerBuilding.create({
        data: {
          player_id: player.id,
          building_type: buildingType,
          level: 0,
        },
      });
    }

    // Stats
    await prisma.playerStats.create({
      data: {
        player_id: player.id,
        experience: 0,
        rank: 0,
        offense: 0,
        defense: 0,
        spy: 0,
        sentry: 0,
        killing_str: 1,
        defense_str: 1,
        spying_str: 1,
        sentry_str: 1,
      },
    });

    // Bonus points
    for (const bonusType of BONUS_TYPES) {
      await prisma.playerBonusPoint.create({
        data: {
          player_id: player.id,
          bonus_type: bonusType,
          level: 0,
        },
      });
    }
  }

  console.log(`Created ${players.length} test players`);

  // Create bot players
  for (const bot of BOT_CONFIGS) {
    const botEmail = `bot-${bot.displayName.toLowerCase()}@bot.openthrone.local`;
    const botPasswordHash = await argon2.hash('bot-no-login');

    const botPlayer = await prisma.player.create({
      data: {
        email: botEmail,
        display_name: bot.displayName,
        password_hash: botPasswordHash,
        race: bot.race,
        player_class: bot.playerClass,
        is_bot: true,
        last_active: new Date(),
      },
    });

    await prisma.playerEconomy.create({
      data: {
        player_id: botPlayer.id,
        gold: bot.gold,
        gold_in_bank: BigInt(0),
        attack_turns: 50,
      },
    });

    await prisma.playerUnit.create({
      data: {
        player_id: botPlayer.id,
        unit_type: 'CITIZEN',
        level: 1,
        quantity: 50,
      },
    });

    await prisma.playerFortification.create({
      data: {
        player_id: botPlayer.id,
        fort_level: 0,
        hitpoints: 50,
      },
    });

    for (const buildingType of BUILDING_TYPES) {
      await prisma.playerBuilding.create({
        data: {
          player_id: botPlayer.id,
          building_type: buildingType,
          level: 0,
        },
      });
    }

    await prisma.playerStats.create({
      data: {
        player_id: botPlayer.id,
        experience: 0,
        rank: 0,
        offense: 0,
        defense: 0,
        spy: 0,
        sentry: 0,
        killing_str: 1,
        defense_str: 1,
        spying_str: 1,
        sentry_str: 1,
      },
    });

    for (const bonusType of BONUS_TYPES) {
      await prisma.playerBonusPoint.create({
        data: {
          player_id: botPlayer.id,
          bonus_type: bonusType,
          level: 0,
        },
      });
    }

    await prisma.botConfig.create({
      data: {
        player_id: botPlayer.id,
        strategy: bot.strategy,
        is_active: true,
        sessions_per_day: 3,
        personality_seed: Math.floor(Math.random() * 1000000),
      },
    });

    console.log(`Created bot: ${bot.displayName} (${bot.strategy})`);
  }

  console.log(`Created ${BOT_CONFIGS.length} bots`);

  // Seed cosmetics
  console.log('\nSeeding cosmetics...');

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
      update: cosmetic,
      create: cosmetic,
    });
  }

  console.log(`Seeded ${nameColors.length + icons.length} cosmetics (created or updated)`);

  // Create welcome blog post
  const blogPost = await prisma.blogPost.create({
    data: {
      title: 'Welcome to OpenThrone v2!',
      content:
        'Welcome to the next generation of OpenThrone. This version features a fully normalized database, improved performance, and a modern monorepo architecture. Prepare your armies and fortify your defenses!',
      posted_by_id: players[0]!.id,
    },
  });

  console.log(`Created blog post: "${blogPost.title}"`);

  // Grant ADMINISTRATOR to first player
  await prisma.permissionGrant.create({
    data: {
      user_id: players[0]!.id,
      type: 'ADMINISTRATOR',
    },
  });

  console.log(`Granted ADMINISTRATOR to ${players[0]!.displayName}`);

  // Seed cosmetics shop
  console.log('\nSeeding cosmetics shop...');
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
  console.log(`Seeded ${ALL_COSMETICS.length} cosmetics`);

  console.log('\n=== Login Credentials ===');
  console.log('All passwords: password123');
  console.log(`Admin: ${TEST_PLAYERS[0]!.email}`);
  console.log('Seeding complete!');
}
