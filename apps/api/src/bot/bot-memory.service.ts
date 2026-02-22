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
  @OnEvent('combat.spy')
  async handleSpyMissionCompleted(event: any) {
    // Check if the spy is a bot
    const botConfig = await this.prisma.botConfig.findUnique({
      where: { player_id: event.attackerId },
    });

    if (!botConfig || event.missionType !== 'intel') return;

    try {
      // Fetch the full spy log to get all the details
      const log = await this.prisma.attackLog.findUnique({
        where: { id: event.logId },
        include: {
          defender: {
            select: { display_name: true, stats: true },
          },
        },
      });

      if (!log) return;

      const stats = JSON.parse(log.stats as string);

      // Store intel cache for future target selection
      await this.prisma.botIntelCache.upsert({
        where: {
          bot_id_target_id: {
            bot_id: event.attackerId,
            target_id: event.defenderId,
          },
        },
        update: {
          target_name: log.defender.display_name,
          target_level: stats.defenderMeta?.level || 1,
          gold_amount: stats.goldRevealed ? BigInt(stats.gold || 0) : null,
          offense_strength: stats.offenseUnits || 0,
          defense_strength: stats.defenseUnits || 0,
          spied_at: new Date(),
          reveal_percent: stats.revealPercent || 0,
        },
        create: {
          bot_id: event.attackerId,
          target_id: event.defenderId,
          target_name: log.defender.display_name,
          target_level: stats.defenderMeta?.level || 1,
          gold_amount: stats.goldRevealed ? BigInt(stats.gold || 0) : null,
          offense_strength: stats.offenseUnits || 0,
          defense_strength: stats.defenseUnits || 0,
          spied_at: new Date(),
          reveal_percent: stats.revealPercent || 0,
        },
      });

      this.logger.debug(
        `Bot ${botConfig.player_id} cached intel on ${log.defender.display_name} (reveal: ${stats.revealPercent || 0}%)`,
      );
    } catch (error) {
      this.logger.error(`Failed to cache intel for bot ${event.attackerId}:`, error);
    }
  }

  /**
   * When a battle completes, record the outcome for learning
   */
  @OnEvent('combat.attack')
  async handleBattleCompleted(event: any) {
    // Fetch the full attack log to get all the details
    const log = await this.prisma.attackLog.findUnique({
      where: { id: event.logId },
      include: {
        attacker: { select: { display_name: true, stats: true } },
        defender: { select: { display_name: true, stats: true } },
      },
    });

    if (!log) return;

    const stats = JSON.parse(log.stats as string);

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
            target_name: log.defender.display_name,
            is_win: event.winnerId === event.attackerId,
            gold_stolen: BigInt(stats.goldStolen || 0),
            units_lost: stats.attackerCasualties?.total || 0,
            timestamp: new Date(),
          },
        });

        this.logger.debug(
          `Bot ${attackerBotConfig.player_id} battle vs ${log.defender.display_name}: ${event.winnerId === event.attackerId ? 'WIN' : 'LOSS'}`,
        );
      } catch (error) {
        this.logger.error(`Failed to record battle memory for bot ${event.attackerId}:`, error);
      }
    }

    // Check if defender is a bot
    const defenderBotConfig = await this.prisma.botConfig.findUnique({
      where: { player_id: event.defenderId },
    });

    if (defenderBotConfig && event.winnerId === event.attackerId) {
      // Bot was attacked and lost - track the threat for revenge
      try {
        await this.prisma.botThreatTracking.create({
          data: {
            bot_id: event.defenderId,
            attacker_id: event.attackerId,
            attacker_name: log.attacker.display_name,
            attacker_level: stats.attackerMeta?.level || 1,
            gold_lost: BigInt(stats.goldStolen || 0),
            timestamp: new Date(),
          },
        });

        this.logger.debug(
          `Bot ${defenderBotConfig.player_id} was attacked by ${log.attacker.display_name} (lost ${stats.goldStolen || 0} gold)`,
        );
      } catch (error) {
        this.logger.error(`Failed to record threat for bot ${event.defenderId}:`, error);
      }
    }
  }
}
