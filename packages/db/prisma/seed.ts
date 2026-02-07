import { PrismaClient, PlayerRace, PlayerClass, UnitType, BonusPointType } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

/**
 * Simple password hash using SHA-256.
 * In production, use bcrypt or argon2 instead.
 */
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

async function main() {
  console.log('Seeding database...');

  // ─── Player 1: Human Fighter ────────────────────────────────────────────────

  const player1 = await prisma.player.create({
    data: {
      email: 'testplayer1@openthrone.dev',
      display_name: 'TestKnight',
      password_hash: hashPassword('password123'),
      race: PlayerRace.HUMAN,
      player_class: PlayerClass.FIGHTER,
      bio: 'A brave human fighter ready for battle.',
    },
  });

  console.log(`Created player: ${player1.display_name} (${player1.id})`);

  // ─── Player 2: Elf Assassin ─────────────────────────────────────────────────

  const player2 = await prisma.player.create({
    data: {
      email: 'testplayer2@openthrone.dev',
      display_name: 'ShadowLeaf',
      password_hash: hashPassword('password456'),
      race: PlayerRace.ELF,
      player_class: PlayerClass.ASSASSIN,
      bio: 'A stealthy elf assassin lurking in the shadows.',
    },
  });

  console.log(`Created player: ${player2.display_name} (${player2.id})`);

  // ─── Player Economy ─────────────────────────────────────────────────────────

  await prisma.playerEconomy.createMany({
    data: [
      { player_id: player1.id, gold: BigInt(25000), gold_in_bank: BigInt(0), attack_turns: 50 },
      { player_id: player2.id, gold: BigInt(25000), gold_in_bank: BigInt(0), attack_turns: 50 },
    ],
  });

  console.log('Created player economies.');

  // ─── Player Units (50 citizens each) ────────────────────────────────────────

  await prisma.playerUnit.createMany({
    data: [
      { player_id: player1.id, unit_type: UnitType.CITIZEN, level: 1, quantity: 50 },
      { player_id: player2.id, unit_type: UnitType.CITIZEN, level: 1, quantity: 50 },
    ],
  });

  console.log('Created player units (50 citizens each).');

  // ─── Player Fortifications ──────────────────────────────────────────────────

  await prisma.playerFortification.createMany({
    data: [
      { player_id: player1.id, fort_level: 1, hitpoints: 50 },
      { player_id: player2.id, fort_level: 1, hitpoints: 50 },
    ],
  });

  console.log('Created player fortifications.');

  // ─── Player Stats ───────────────────────────────────────────────────────────

  await prisma.playerStats.createMany({
    data: [
      {
        player_id: player1.id,
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
      {
        player_id: player2.id,
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
    ],
  });

  console.log('Created player stats.');

  // ─── Player Bonus Points ────────────────────────────────────────────────────

  const bonusTypes = [
    BonusPointType.OFFENSE,
    BonusPointType.DEFENSE,
    BonusPointType.INTEL,
    BonusPointType.PRICES,
    BonusPointType.INCOME,
  ];

  const bonusData = [player1.id, player2.id].flatMap((playerId) =>
    bonusTypes.map((bonusType) => ({
      player_id: playerId,
      bonus_type: bonusType,
      level: 0,
    }))
  );

  await prisma.playerBonusPoint.createMany({ data: bonusData });

  console.log('Created player bonus points.');

  // ─── Blog Post ──────────────────────────────────────────────────────────────

  const blogPost = await prisma.blogPost.create({
    data: {
      title: 'Welcome to OpenThrone v2!',
      content:
        'Welcome to the next generation of OpenThrone. This version features a fully normalized database, improved performance, and a modern monorepo architecture. Prepare your armies and fortify your defenses!',
      posted_by_id: player1.id,
    },
  });

  console.log(`Created blog post: "${blogPost.title}" (id: ${blogPost.id})`);

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
