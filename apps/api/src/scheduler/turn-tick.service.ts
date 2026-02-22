import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';
import { calculateGoldPerTurn, calculateRankScore, computeArmoryResaleValue, computeBattleUpgradeResaleValue, getBuildingLevel } from '@openthrone/game-logic';
import { TurnTickEvent, RankingsRecalculatedEvent } from '@openthrone/events';
import { BankAccountType, BankTransferHistoryType, BuildingType } from '@openthrone/shared';

@Injectable()
export class TurnTickService {
  private readonly logger = new Logger(TurnTickService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {}

  // TODO: Migrate to BullMQ queue when Redis available
  @Cron('0 */30 * * * *')
  async handleCron() {
    if (!this.config.get('ENABLE_TURN_TICK')) return;
    await this.executeTurnTick();
  }

  async executeTurnTick() {
    if (this.isRunning) {
      this.logger.warn('Turn tick already running, skipping');
      return { message: 'Already running' };
    }

    this.isRunning = true;
    const startTime = Date.now();
    let playersProcessed = 0;
    let errorMessage: string | null = null;

    // Create job log entry
    const jobLog = await this.prisma.jobLog.create({
      data: { job_name: 'turn_tick', status: 'RUNNING' },
    });

    try {
      this.logger.log('Executing 30-minute turn tick...');

      // Fetch all ACTIVE players with their economy, fortification, units, bonus points, and mine building
      const players = await this.prisma.player.findMany({
        where: { status: 'ACTIVE' },
        include: {
          economy: true,
          fortification: true,
          units: { where: { unit_type: 'WORKER' } },
          bonus_points: { where: { bonus_type: 'INCOME' } },
          buildings: { where: { building_type: 'MINE' } },
        },
      });

      for (const player of players) {
        try {
          const economy = player.economy;
          if (!economy) continue;

          const workers = player.units.map((u) => ({
            level: u.level,
            quantity: u.quantity,
          }));
          const incomeBonus =
            player.bonus_points.find((b) => b.bonus_type === 'INCOME')?.level ??
            0;

          // Get mine building bonus
          const mineRow = player.buildings.find((b) => b.building_type === 'MINE');
          const mineLevel = mineRow?.level ?? 0;
          const mineDef = getBuildingLevel(BuildingType.MINE, mineLevel);
          const mineBonusPercent = mineDef?.incomeBonusPercent ?? 0;

          const goldEarned = calculateGoldPerTurn(
            workers,
            mineBonusPercent,
            incomeBonus,
          );

          await this.prisma.$transaction(async (tx) => {
            // Increment gold and attack turns
            await tx.playerEconomy.update({
              where: { player_id: player.id },
              data: {
                gold: { increment: goldEarned },
                attack_turns: { increment: 6 },
              },
            });

            // Create ECONOMY bank history entry
            await tx.bankHistory.create({
              data: {
                gold_amount: BigInt(goldEarned),
                from_user_id: player.id,
                from_account_type: BankAccountType.HAND,
                to_user_id: player.id,
                to_account_type: BankAccountType.HAND,
                date_time: new Date(),
                history_type: BankTransferHistoryType.ECONOMY,
              },
            });
          });

          playersProcessed++;
        } catch (playerErr) {
          this.logger.error(
            `Turn tick failed for player ${player.id}: ${playerErr}`,
          );
        }
      }

      // Recalculate rankings
      await this.recalculateRankings();

      this.logger.log(
        `Turn tick complete: ${playersProcessed}/${players.length} players processed`,
      );
    } catch (err) {
      errorMessage =
        err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Turn tick failed: ${errorMessage}`);
    } finally {
      const durationMs = Date.now() - startTime;
      await this.prisma.jobLog.update({
        where: { id: jobLog.id },
        data: {
          status: errorMessage ? 'FAILED' : 'COMPLETED',
          finished_at: new Date(),
          duration_ms: durationMs,
          players_processed: playersProcessed,
          error_message: errorMessage,
        },
      });
      this.isRunning = false;
    }

    this.eventEmitter.emit(
      'system.turn_tick',
      new TurnTickEvent(new Date(), playersProcessed),
    );

    // Broadcast turn tick announcement to general chat (only if successful)
    if (!errorMessage) {
      try {
        await this.chatService.sendSystemMessage(
          `⏰ Turn tick! All players received +6 attack turns and gold income from workers.`,
          'SYSTEM',
        );
      } catch (chatErr) {
        this.logger.error('Failed to broadcast turn tick to chat:', chatErr);
      }
    }

    return { playersProcessed, durationMs: Date.now() - startTime };
  }

  private async recalculateRankings() {
    const players = await this.prisma.player.findMany({
      where: { status: 'ACTIVE' },
      include: {
        stats: true,
        economy: { select: { gold: true, gold_in_bank: true } },
        items: { select: { item_type: true, usage: true, level: true, quantity: true } },
        battle_upgrades: { select: { upgrade_type: true, level: true, quantity: true } },
      },
    });

    const scored = players
      .filter((p) => p.stats)
      .map((p) => {
        const armoryResale = computeArmoryResaleValue(
          (p.items ?? []).map((i) => ({
            itemType: i.item_type,
            usage: i.usage,
            level: i.level,
            quantity: i.quantity,
          })),
        );
        const battleUpgradeResale = computeBattleUpgradeResaleValue(
          (p.battle_upgrades ?? []).map((bu) => ({
            upgradeType: bu.upgrade_type,
            level: bu.level,
            quantity: bu.quantity,
          })),
        );
        const gold = Number(p.economy?.gold ?? 0);
        const bank = Number(p.economy?.gold_in_bank ?? 0);

        return {
          statsId: p.stats!.id,
          score: calculateRankScore({
            offense: p.stats!.offense,
            defense: p.stats!.defense,
            netWorth: gold + bank + armoryResale + battleUpgradeResale,
          }),
        };
      })
      .sort((a, b) => b.score - a.score);

    for (const [i, entry] of scored.entries()) {
      await this.prisma.playerStats.update({
        where: { id: entry.statsId },
        data: { rank: i + 1 },
      });
    }

    this.eventEmitter.emit(
      'system.rankings_recalculated',
      new RankingsRecalculatedEvent(new Date()),
    );
  }
}
