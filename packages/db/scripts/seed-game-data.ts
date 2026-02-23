import { PrismaClient } from '@prisma/client';
import { UnitTypes, ItemTypes, Buildings, Fortifications, BattleUpgrades, EconomyUpgrades } from '@openthrone/game-logic';
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

  // Seed battle upgrades
  console.log('Seeding battle upgrades...');
  for (const upgrade of BattleUpgrades) {
    await prisma.battleUpgrade.upsert({
      where: { type_level: { type: upgrade.type, level: upgrade.level } },
      update: {
        name: upgrade.name,
        siege_upgrade_level: upgrade.siegeUpgradeLevel,
        bonus: upgrade.bonus,
        cost: BigInt(upgrade.cost),
        units_covered: upgrade.unitsCovered,
        min_unit_level: upgrade.minUnitLevel,
        killing_strength: upgrade.killingStrength,
        defense_strength: upgrade.defenseStrength,
      },
      create: {
        type: upgrade.type,
        level: upgrade.level,
        name: upgrade.name,
        siege_upgrade_level: upgrade.siegeUpgradeLevel,
        bonus: upgrade.bonus,
        cost: BigInt(upgrade.cost),
        units_covered: upgrade.unitsCovered,
        min_unit_level: upgrade.minUnitLevel,
        killing_strength: upgrade.killingStrength,
        defense_strength: upgrade.defenseStrength,
        enabled: true,
      },
    });
  }
  console.log(`✓ Seeded ${BattleUpgrades.length} battle upgrades`);

  // Seed economy upgrades
  console.log('Seeding economy upgrades...');
  for (const upgrade of EconomyUpgrades) {
    await prisma.economyUpgrade.upsert({
      where: { level: upgrade.level },
      update: {
        name: upgrade.name,
        fort_level: upgrade.fortLevel,
        gold_per_worker: upgrade.goldPerWorker,
        deposits_per_day: upgrade.depositsPerDay,
        gold_transfer_rec: upgrade.goldTransferRec,
        gold_transfer_tx: upgrade.goldTransferTx,
        cost: BigInt(upgrade.cost),
      },
      create: {
        level: upgrade.level,
        name: upgrade.name,
        fort_level: upgrade.fortLevel,
        gold_per_worker: upgrade.goldPerWorker,
        deposits_per_day: upgrade.depositsPerDay,
        gold_transfer_rec: upgrade.goldTransferRec,
        gold_transfer_tx: upgrade.goldTransferTx,
        cost: BigInt(upgrade.cost),
        enabled: true,
      },
    });
  }
  console.log(`✓ Seeded ${EconomyUpgrades.length} economy upgrades`);

  // Seed races
  console.log('Seeding races...');
  const races = [
    {
      id: 'HUMAN',
      name: 'Human',
      description: 'Balanced and versatile, humans adapt to any strategy',
      theme_color: '#3b82f6',
      offense_bonus: 0.05,
      defense_bonus: 0,
      spy_bonus: 0,
      sentry_bonus: 0,
      income_bonus: 0,
      recruit_bonus: 0,
    },
    {
      id: 'ELF',
      name: 'Elf',
      description: 'Swift and elusive, elves excel at defense',
      theme_color: '#10b981',
      offense_bonus: 0,
      defense_bonus: 0.05,
      spy_bonus: 0,
      sentry_bonus: 0,
      income_bonus: 0,
      recruit_bonus: 0,
    },
    {
      id: 'GOBLIN',
      name: 'Goblin',
      description: 'Cunning and defensive, goblins fortify their positions',
      theme_color: '#22c55e',
      offense_bonus: 0,
      defense_bonus: 0.05,
      spy_bonus: 0,
      sentry_bonus: 0,
      income_bonus: 0,
      recruit_bonus: 0,
    },
    {
      id: 'UNDEAD',
      name: 'Undead',
      description: 'Relentless and aggressive, the undead crush their enemies',
      theme_color: '#6b46c1',
      offense_bonus: 0.05,
      defense_bonus: 0,
      spy_bonus: 0,
      sentry_bonus: 0,
      income_bonus: 0,
      recruit_bonus: 0,
    },
  ];

  for (const race of races) {
    await prisma.race.upsert({
      where: { id: race.id },
      update: {
        name: race.name,
        description: race.description,
        theme_color: race.theme_color,
        offense_bonus: race.offense_bonus,
        defense_bonus: race.defense_bonus,
        spy_bonus: race.spy_bonus,
        sentry_bonus: race.sentry_bonus,
        income_bonus: race.income_bonus,
        recruit_bonus: race.recruit_bonus,
      },
      create: {
        id: race.id,
        name: race.name,
        description: race.description,
        theme_color: race.theme_color,
        offense_bonus: race.offense_bonus,
        defense_bonus: race.defense_bonus,
        spy_bonus: race.spy_bonus,
        sentry_bonus: race.sentry_bonus,
        income_bonus: race.income_bonus,
        recruit_bonus: race.recruit_bonus,
        enabled: true,
      },
    });
  }
  console.log(`✓ Seeded ${races.length} races`);

  console.log('Game data seeding complete!');
  console.log('All game data is now loaded from database: units, items, buildings, fortifications, battle upgrades, economy upgrades, and races.');
}

seedGameData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
