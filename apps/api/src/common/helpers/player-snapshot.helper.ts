import { PrismaService } from '../../prisma/prisma.service';
import { PlayerStateSnapshot, UnitType } from '@openthrone/shared';
import { getLevelForXP } from '@openthrone/game-logic';

export async function buildPlayerSnapshot(
  prisma: PrismaService,
  playerId: string,
  options?: { includeUnits?: boolean },
): Promise<PlayerStateSnapshot> {
  // Always fetch units to calculate citizens
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

  // Calculate citizens from CITIZEN type units
  const citizens = player.units
    .filter((u) => u.unit_type === 'CITIZEN')
    .reduce((sum, u) => sum + u.quantity, 0);

  return {
    gold: player.economy.gold.toString(),
    goldInBank: player.economy.gold_in_bank.toString(),
    experience: player.stats.experience.toString(),
    level: getLevelForXP(player.stats.experience),
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
  };
}
