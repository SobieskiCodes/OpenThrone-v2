import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const RACES = ['HUMAN', 'ELF', 'GOBLIN', 'UNDEAD'] as const;
const CLASSES = ['FIGHTER', 'CLERIC', 'ASSASSIN', 'THIEF'] as const;
const BONUS_TYPES = ['OFFENSE', 'DEFENSE', 'INTEL', 'PRICES', 'INCOME'] as const;

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

async function main() {
  console.log('Seeding database...');

  const players: { id: string; displayName: string }[] = [];

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
    console.log(`Created player: ${player.display_name} (${player.id})`);

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
        fort_level: 1,
        hitpoints: 50,
      },
    });

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

  console.log(`\nCreated ${players.length} players with economy, units, stats, and bonus points.`);

  // ─── Blog Post ──────────────────────────────────────────────────────────────

  const blogPost = await prisma.blogPost.create({
    data: {
      title: 'Welcome to OpenThrone v2!',
      content:
        'Welcome to the next generation of OpenThrone. This version features a fully normalized database, improved performance, and a modern monorepo architecture. Prepare your armies and fortify your defenses!',
      posted_by_id: players[0].id,
    },
  });

  console.log(`Created blog post: "${blogPost.title}" (id: ${blogPost.id})`);

  // ─── Admin Permission ──────────────────────────────────────────────────────

  // Grant ADMINISTRATOR to first player
  try {
    await prisma.permissionGrant.create({
      data: {
        user_id: players[0].id,
        type: 'ADMINISTRATOR',
      },
    });
    console.log(`Granted ADMINISTRATOR to ${players[0].displayName}`);
  } catch {
    console.log('Admin permission already exists, skipping');
  }

  // ─── Print login info ─────────────────────────────────────────────────────

  console.log('\n=== Test Login Credentials ===');
  console.log('All passwords: password123');
  console.log(`  ${players[0].displayName} — ${TEST_PLAYERS[0].email} (ADMIN)`);
  for (const p of players.slice(1)) {
    const tp = TEST_PLAYERS.find((t) => t.displayName === p.displayName)!;
    console.log(`  ${p.displayName} — ${tp.email}`);
  }

  console.log('\nSeeding complete!');
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
