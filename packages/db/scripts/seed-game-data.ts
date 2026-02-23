import { PrismaClient } from '@prisma/client';
import { UnitTypes, ItemTypes } from '@openthrone/game-logic';
import { UnitType } from '@openthrone/shared';

const prisma = new PrismaClient();

async function seedGameData() {
  console.log('Seeding game data from game-logic package...');

  // Seed units
  console.log('Seeding units...');
  for (const unit of UnitTypes) {
    // Map bonus to appropriate stat based on unit type
    const offense = unit.type === UnitType.OFFENSE ? unit.bonus : 0;
    const defense = unit.type === UnitType.DEFENSE ? unit.bonus : 0;
    const spy = unit.type === UnitType.SPY ? unit.bonus : 0;
    const sentry = unit.type === UnitType.SENTRY ? unit.bonus : 0;

    // Serialize building requirements to JSON
    const buildingRequirements = unit.buildingRequirements.length > 0
      ? JSON.stringify(unit.buildingRequirements)
      : null;

    await prisma.unit.upsert({
      where: { type_level: { type: unit.type, level: unit.level } },
      update: {
        name: unit.name,
        cost: BigInt(unit.cost),
        bonus: unit.bonus,
        offense,
        defense,
        spy,
        sentry,
        fort_level: unit.fortLevel,
        building_requirements: buildingRequirements,
        hp: unit.hp,
        killing_strength: unit.killingStrength,
        defense_strength: unit.defenseStrength,
      },
      create: {
        type: unit.type,
        level: unit.level,
        name: unit.name,
        cost: BigInt(unit.cost),
        bonus: unit.bonus,
        offense,
        defense,
        spy,
        sentry,
        fort_level: unit.fortLevel,
        building_requirements: buildingRequirements,
        hp: unit.hp,
        killing_strength: unit.killingStrength,
        defense_strength: unit.defenseStrength,
        enabled: true,
      },
    });
  }
  console.log(`✓ Seeded ${UnitTypes.length} units`);

  // Seed items
  console.log('Seeding items...');
  for (const item of ItemTypes) {
    await prisma.item.upsert({
      where: { type_usage_level: { type: item.type, usage: item.usage, level: item.level } },
      update: {
        name: item.name,
        bonus: item.bonus,
        cost: BigInt(item.cost),
        armory_level: item.armoryLevel,
        race: item.race,
        killing_strength: item.killingStrength,
        defense_strength: item.defenseStrength,
      },
      create: {
        type: item.type,
        usage: item.usage,
        level: item.level,
        name: item.name,
        bonus: item.bonus,
        cost: BigInt(item.cost),
        armory_level: item.armoryLevel,
        race: item.race,
        killing_strength: item.killingStrength,
        defense_strength: item.defenseStrength,
        enabled: true,
      },
    });
  }
  console.log(`✓ Seeded ${ItemTypes.length} items`);

  // TODO Phase 3-7: Seed buildings, fortifications, battle upgrades, economy upgrades, races

  console.log('Game data seeding complete!');
  console.log('Units and items now loaded from database. Other game data will be seeded in future phases.');
}

seedGameData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
