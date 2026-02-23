import { PrismaService } from '../../prisma/prisma.service';
import { PlayerStateSnapshot, UnitType, BuildingType } from '@openthrone/shared';
import { getLevelForXP, canUpgradeBuilding, getBuildingLevel } from '@openthrone/game-logic';

export async function buildPlayerSnapshot(
  prisma: PrismaService,
  playerId: string,
  options?: {
    includeUnits?: boolean;
    includeBuildings?: boolean;
    includeProficiencies?: boolean;
    includeNotifications?: boolean;
    includeItems?: boolean;
  },
): Promise<PlayerStateSnapshot> {
  // Always fetch core player data + units (needed for citizens)
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: {
      economy: {
        select: {
          gold: true,
          gold_in_bank: true,
          attack_turns: true,
        },
      },
      stats: {
        select: {
          experience: true,
          offense: true,
          defense: true,
          spy: true,
          sentry: true,
        },
      },
      units: {
        select: {
          unit_type: true,
          level: true,
          quantity: true,
        },
      },
    },
  });

  if (!player || !player.economy || !player.stats) {
    throw new Error(`Player ${playerId} not found or missing economy/stats`);
  }

  // Calculate level from experience
  const level = getLevelForXP(player.stats.experience);

  // Calculate citizens from CITIZEN type units
  const citizens = player.units
    .filter((u) => u.unit_type === 'CITIZEN')
    .reduce((sum, u) => sum + u.quantity, 0);

  // Fetch buildings if requested
  let buildings: Array<{ building_type: string; level: number }> | undefined;
  if (options?.includeBuildings) {
    buildings = await prisma.playerBuilding.findMany({
      where: { player_id: playerId },
      select: {
        building_type: true,
        level: true,
      },
    });
  }

  // Fetch proficiencies (bonus points) if requested
  let bonusPoints: Array<{ bonus_type: string; level: number }> | undefined;
  if (options?.includeProficiencies) {
    bonusPoints = await prisma.playerBonusPoint.findMany({
      where: { player_id: playerId },
      select: {
        bonus_type: true,
        level: true,
      },
    });
  }

  // Note: Items don't have an "equipped" concept in the schema
  // All items are in inventory and counted by type/usage/level
  let equippedItems: Array<{ id: string; type: string; tier: number }> | undefined;

  // Calculate available proficiency points if requested
  let availablePoints: number | undefined;
  if (options?.includeProficiencies && bonusPoints) {
    const spentPoints = bonusPoints.reduce((sum, bp) => sum + bp.level, 0);
    availablePoints = level - spentPoints;
  }

  // Calculate available building upgrades if requested
  let availableUpgrades: number | undefined;
  if (options?.includeBuildings && buildings) {
    const gold = player.economy.gold;
    let count = 0;

    for (const type of Object.values(BuildingType)) {
      const current = buildings.find((b) => b.building_type === type);
      const currentLevel = current?.level ?? 0;
      const nextLevel = currentLevel + 1;
      const nextDef = getBuildingLevel(type, nextLevel);

      // Count if next level exists and player meets level requirement
      if (nextDef && level >= nextDef.playerLevelRequirement) {
        count++;
      }
    }

    availableUpgrades = count;
  }

  // Get unread mail count if notifications requested
  let unreadMail: number | undefined;
  if (options?.includeNotifications) {
    unreadMail = await prisma.mailRecipient.count({
      where: {
        player_id: playerId,
        is_read: false,
        is_deleted: false,
      },
    });
  }

  return {
    gold: player.economy.gold.toString(),
    goldInBank: player.economy.gold_in_bank.toString(),
    experience: player.stats.experience.toString(),
    level,
    offense: player.stats.offense,
    defense: player.stats.defense,
    spy: player.stats.spy,
    sentry: player.stats.sentry,
    attackTurns: player.economy.attack_turns,
    citizens,
    updatedUnits: options?.includeUnits
      ? player.units.map((u) => ({
          unitType: u.unit_type as UnitType,
          level: u.level,
          quantity: u.quantity,
        }))
      : undefined,
    updatedBuildings: options?.includeBuildings && buildings
      ? buildings.map((b) => ({
          type: b.building_type,
          level: b.level,
        }))
      : undefined,
    proficiencies: options?.includeProficiencies && bonusPoints
      ? bonusPoints.map((p) => ({
          type: p.bonus_type,
          level: p.level,
        }))
      : undefined,
    availablePoints,
    availableUpgrades,
    unreadMail,
    equippedItems: undefined, // Not tracking equipped items in current schema
  };
}
