import { PrismaClient } from '@prisma/client';
import { UnitTypes, ItemTypes, Buildings, Fortifications } from '@openthrone/game-logic';
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

  // Seed buildings (flatten the nested structure)
  console.log('Seeding buildings...');
  let buildingCount = 0;
  for (const building of Buildings) {
    for (const level of building.levels) {
      await prisma.building.upsert({
        where: { type_level: { type: building.type, level: level.level } },
        update: {
          name: level.name,
          cost: BigInt(level.cost),
          player_level_req: level.playerLevelRequirement,
          workers_provided: (level as any).workersProvided,
          offense_bonus: (level as any).offenseBonus ?? 0,
          defense_bonus: (level as any).defenseBonus ?? 0,
          spy_bonus: (level as any).spyOffenseBonus ?? 0,
          sentry_bonus: (level as any).sentryBonus ?? 0,
          income_bonus: (level as any).incomeBonusPercent ?? 0,
          max_item_bonus: (level as any).maxItemBonus,
          daily_merc_stock: (level as any).dailyMercStock,
          fort_hitpoints: (level as any).fortHitpoints,
          citizens_per_day: (level as any).citizensPerDay,
        },
        create: {
          type: building.type,
          level: level.level,
          name: level.name,
          cost: BigInt(level.cost),
          player_level_req: level.playerLevelRequirement,
          workers_provided: (level as any).workersProvided,
          offense_bonus: (level as any).offenseBonus ?? 0,
          defense_bonus: (level as any).defenseBonus ?? 0,
          spy_bonus: (level as any).spyOffenseBonus ?? 0,
          sentry_bonus: (level as any).sentryBonus ?? 0,
          income_bonus: (level as any).incomeBonusPercent ?? 0,
          max_item_bonus: (level as any).maxItemBonus,
          daily_merc_stock: (level as any).dailyMercStock,
          fort_hitpoints: (level as any).fortHitpoints,
          citizens_per_day: (level as any).citizensPerDay,
          enabled: true,
        },
      });
      buildingCount++;
    }
  }
  console.log(`✓ Seeded ${buildingCount} building levels across ${Buildings.length} building types`);

  // Seed fortifications
  console.log('Seeding fortifications...');
  for (const fort of Fortifications) {
    await prisma.fortification.upsert({
      where: { level: fort.level },
      update: {
        name: fort.name,
        level_requirement: fort.levelRequirement,
        max_population: 0, // TODO: Add to game-logic if needed
        max_land: 0, // TODO: Add to game-logic if needed
        price: BigInt(fort.cost),
        cost: BigInt(fort.cost),
        hitpoints: fort.hitpoints,
        gold_per_turn: fort.goldPerTurn,
        cost_per_repair_point: BigInt(fort.costPerRepairPoint),
        defense_bonus_percentage: fort.defenseBonusPercentage,
      },
      create: {
        level: fort.level,
        name: fort.name,
        level_requirement: fort.levelRequirement,
        max_population: 0, // TODO: Add to game-logic if needed
        max_land: 0, // TODO: Add to game-logic if needed
        price: BigInt(fort.cost),
        cost: BigInt(fort.cost),
        hitpoints: fort.hitpoints,
        gold_per_turn: fort.goldPerTurn,
        cost_per_repair_point: BigInt(fort.costPerRepairPoint),
        defense_bonus_percentage: fort.defenseBonusPercentage,
        enabled: true,
      },
    });
  }
  console.log(`✓ Seeded ${Fortifications.length} fortifications`);

  // TODO Phase 5-7: Seed battle upgrades, economy upgrades, races

  console.log('Game data seeding complete!');
  console.log('Units, items, and buildings now loaded from database. Other game data will be seeded in future phases.');
}

seedGameData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
