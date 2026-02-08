import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { RankingsService } from './rankings.service';
import {
  AttackExecutedEvent,
  SpyMissionExecutedEvent,
  UnitsTrainedEvent,
  ItemEquippedEvent,
  StructureUpgradedEvent,
  MessageSentEvent,
  PlayerRecruitedEvent,
  TurnGoldAwardedEvent,
} from '@openthrone/events';

@Injectable()
export class RankingsListener {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rankingsService: RankingsService,
  ) {}

  @OnEvent('combat.attack')
  async handleAttack(event: AttackExecutedEvent) {
    // Read the attack log to get detailed stats
    const log = await this.prisma.attackLog.findUnique({ where: { id: event.logId } });
    if (!log) return;

    const stats = JSON.parse(log.stats);
    const attackerWon = event.winnerId === event.attackerId;

    // Attacker stats
    const attackerIncrements: Record<string, number | bigint> = {
      total_attacks: 1,
    };
    if (attackerWon) {
      attackerIncrements.attack_wins = 1;
      attackerIncrements.daily_attack_wins = 1;
      if (stats.goldStolen) {
        attackerIncrements.gold_stolen = BigInt(stats.goldStolen);
        attackerIncrements.daily_gold_stolen = BigInt(stats.goldStolen);
      }
      if (stats.fortDamage) {
        attackerIncrements.fort_damage_dealt = stats.fortDamage;
      }
    }
    if (stats.defenderCasualties) {
      const totalKilled = Object.values(stats.defenderCasualties as Record<string, number>)
        .reduce((sum: number, v: number) => sum + v, 0);
      if (totalKilled > 0) attackerIncrements.units_killed = totalKilled;
    }
    if (stats.attackerCasualties) {
      const totalLost = Object.values(stats.attackerCasualties as Record<string, number>)
        .reduce((sum: number, v: number) => sum + v, 0);
      if (totalLost > 0) attackerIncrements.units_lost = totalLost;
    }
    await this.rankingsService.incrementMultiple(event.attackerId, attackerIncrements);

    // Defender stats
    const defenderIncrements: Record<string, number | bigint> = {
      total_defends: 1,
    };
    if (!attackerWon) {
      defenderIncrements.defense_wins = 1;
      defenderIncrements.daily_defense_wins = 1;
    }
    if (stats.attackerCasualties) {
      const totalKilled = Object.values(stats.attackerCasualties as Record<string, number>)
        .reduce((sum: number, v: number) => sum + v, 0);
      if (totalKilled > 0) defenderIncrements.units_killed = totalKilled;
    }
    if (stats.defenderCasualties) {
      const totalLost = Object.values(stats.defenderCasualties as Record<string, number>)
        .reduce((sum: number, v: number) => sum + v, 0);
      if (totalLost > 0) defenderIncrements.units_lost = totalLost;
    }
    await this.rankingsService.incrementMultiple(event.defenderId, defenderIncrements);
  }

  @OnEvent('combat.spy')
  async handleSpyMission(event: SpyMissionExecutedEvent) {
    // Attacker (spy)
    const attackerIncrements: Record<string, number | bigint> = {
      total_spy_ops: 1,
    };
    if (event.success) {
      attackerIncrements.spy_wins = 1;
      attackerIncrements.daily_spy_wins = 1;
    }
    await this.rankingsService.incrementMultiple(event.attackerId, attackerIncrements);

    // Defender (sentry)
    if (!event.success) {
      await this.rankingsService.incrementStat(event.defenderId, 'counter_spy_wins', 1);
    }
  }

  @OnEvent('units.trained')
  async handleUnitsTrained(event: UnitsTrainedEvent) {
    const totalTrained = event.units.reduce((sum, u) => sum + u.quantity, 0);
    await this.rankingsService.incrementMultiple(event.playerId, {
      units_trained: totalTrained,
      daily_units_trained: totalTrained,
      gold_spent: event.goldSpent,
    });
  }

  @OnEvent('item.equipped')
  async handleItemEquipped(event: ItemEquippedEvent) {
    await this.rankingsService.incrementStat(event.playerId, 'gold_spent', event.goldSpent);
  }

  @OnEvent('structure.upgraded')
  async handleStructureUpgraded(event: StructureUpgradedEvent) {
    await this.rankingsService.incrementStat(event.playerId, 'gold_spent', event.goldSpent);
  }

  @OnEvent('chat.message.sent')
  async handleMessageSent(event: MessageSentEvent) {
    await this.rankingsService.incrementStat(event.senderId, 'messages_sent', 1);
  }

  @OnEvent('recruit.claimed')
  async handleRecruitment(event: PlayerRecruitedEvent) {
    if (event.referrerId) {
      await this.rankingsService.incrementStat(event.referrerId, 'citizens_recruited', event.citizensAwarded);
    }
  }

  @OnEvent('economy.turn_gold')
  async handleTurnGold(event: TurnGoldAwardedEvent) {
    await this.rankingsService.incrementMultiple(event.playerId, {
      gold_income: event.amount,
      daily_gold_income: event.amount,
    });
  }
}
