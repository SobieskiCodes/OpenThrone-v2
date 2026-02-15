import { PrismaService } from '../../prisma/prisma.service';
import { PlayerStateSnapshot } from '@openthrone/shared';
import { getLevelForXP } from '@openthrone/game-logic';

export async function buildPlayerSnapshot(
  prisma: PrismaService,
  playerId: string,
  options?: { includeUnits?: boolean },
): Promise<PlayerStateSnapshot> {
  // Always include units if requested
  const selectClause = {
    attack_turns: true,
    citizens: true,
    economy: {
      select: {
        gold: true,
        gold_in_bank: true,
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
    ...(options?.includeUnits && {
      units: {
        select: {
          unit_type: true,
          level: true,
          quantity: true,
        },
      },
    }),
  };

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: selectClause,
  });

  if (!player || !player.economy || !player.stats) {
    throw new Error(`Player ${playerId} not found or missing economy/stats`);
  }

  return {
    gold: player.economy.gold.toString(),
    goldInBank: player.economy.gold_in_bank.toString(),
    experience: player.stats.experience,
    level: getLevelForXP(player.stats.experience),
    offense: player.stats.offense,
    defense: player.stats.defense,
    spy: player.stats.spy,
    sentry: player.stats.sentry,
    attackTurns: player.attack_turns,
    citizens: player.citizens,
    updatedUnits: options?.includeUnits && 'units' in player
      ? (player as any).units.map((u: any) => ({
          unitType: u.unit_type,
          level: u.level,
          quantity: u.quantity,
        }))
      : undefined,
  };
}
