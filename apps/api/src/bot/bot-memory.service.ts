import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

/**
 * BotMemoryService - Phase 1: Bot Intelligence
 *
 * Listens to game events and automatically records:
 * - Spy mission results → BotIntelCache
 * - Battle outcomes → BotBattleMemory (for learning)
 * - Incoming attacks → BotThreatTracking (for revenge)
 */
@Injectable()
export class BotMemoryService {
  private readonly logger = new Logger(BotMemoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * When a bot completes a spy mission, cache the intel for target selection
   */
  @OnEvent('spy.mission.completed')
  async handleSpyMissionCompleted(event: any) {
    // Check if the spy is a bot
    const botConfig = await this.prisma.botConfig.findUnique({
      where: { player_id: event.spyId },
    });

    if (!botConfig || event.missionType !== 'INTEL') return;

    try {
      // Store intel cache for future target selection
      await this.prisma.botIntelCache.upsert({
        where: {
          bot_id_target_id: {
            bot_id: event.spyId,
            target_id: event.targetId,
          },
        },
        update: {
          target_name: event.targetName,
          target_level: event.targetLevel,
          gold_amount: event.goldRevealed ? event.gold : null,
          offense_strength: event.offenseUnits || 0,
          defense_strength: event.defenseUnits || 0,
          spied_at: new Date(),
          reveal_percent: event.revealPercent || 0,
        },
        create: {
          bot_id: event.spyId,
          target_id: event.targetId,
          target_name: event.targetName,
          target_level: event.targetLevel,
          gold_amount: event.goldRevealed ? event.gold : null,
          offense_strength: event.offenseUnits || 0,
          defense_strength: event.defenseUnits || 0,
          spied_at: new Date(),
          reveal_percent: event.revealPercent || 0,
        },
      });

      this.logger.debug(
        `Bot ${botConfig.bot_name} cached intel on ${event.targetName} (reveal: ${event.revealPercent}%)`,
      );
    } catch (error) {
      this.logger.error(`Failed to cache intel for bot ${event.spyId}:`, error);
    }
  }

  /**
   * When a battle completes, record the outcome for learning
   */
  @OnEvent('battle.completed')
  async handleBattleCompleted(event: any) {
    // Check if attacker is a bot
    const attackerBotConfig = await this.prisma.botConfig.findUnique({
      where: { player_id: event.attackerId },
    });

    if (attackerBotConfig) {
      // Bot attacked someone - record the outcome
      try {
        await this.prisma.botBattleMemory.create({
          data: {
            bot_id: event.attackerId,
            target_id: event.defenderId,
            target_name: event.defenderName,
            is_win: event.winner === event.attackerId,
            gold_stolen: event.goldStolen || BigInt(0),
            units_lost: event.attackerUnitsLost || 0,
            timestamp: new Date(),
          },
        });

        this.logger.debug(
          `Bot ${attackerBotConfig.bot_name} battle vs ${event.defenderName}: ${event.winner === event.attackerId ? 'WIN' : 'LOSS'}`,
        );
      } catch (error) {
        this.logger.error(`Failed to record battle memory for bot ${event.attackerId}:`, error);
      }
    }

    // Check if defender is a bot
    const defenderBotConfig = await this.prisma.botConfig.findUnique({
      where: { player_id: event.defenderId },
    });

    if (defenderBotConfig && event.winner === event.attackerId) {
      // Bot was attacked and lost - track the threat for revenge
      try {
        await this.prisma.botThreatTracking.create({
          data: {
            bot_id: event.defenderId,
            attacker_id: event.attackerId,
            attacker_name: event.attackerName,
            attacker_level: event.attackerLevel || 1,
            gold_lost: event.goldStolen || BigInt(0),
            timestamp: new Date(),
          },
        });

        this.logger.debug(
          `Bot ${defenderBotConfig.bot_name} was attacked by ${event.attackerName} (lost ${event.goldStolen} gold)`,
        );
      } catch (error) {
        this.logger.error(`Failed to record threat for bot ${event.defenderId}:`, error);
      }
    }
  }
}
