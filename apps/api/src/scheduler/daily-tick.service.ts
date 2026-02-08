import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import {
  getHouseUpgradeByLevel,
  calculateAutoRecruitCitizens,
} from '@openthrone/game-logic';
import { DailyTickEvent } from '@openthrone/events';
import { BankAccountType, BankTransferHistoryType } from '@openthrone/shared';

@Injectable()
export class DailyTickService {
  private readonly logger = new Logger(DailyTickService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // TODO: Migrate to BullMQ queue when Redis available
  @Cron('0 0 0 * * *')
  async handleCron() {
    if (!this.config.get('ENABLE_DAILY_TICK')) return;
    await this.executeDailyTick();
  }

  async executeDailyTick() {
    if (this.isRunning) {
      this.logger.warn('Daily tick already running, skipping');
      return { message: 'Already running' };
    }

    this.isRunning = true;
    const startTime = Date.now();
    let playersProcessed = 0;
    let errorMessage: string | null = null;

    const jobLog = await this.prisma.jobLog.create({
      data: { job_name: 'daily_tick', status: 'RUNNING' },
    });

    try {
      this.logger.log('Executing daily tick...');

      // ─── Citizen Generation ───────────────────────────────────
      const players = await this.prisma.player.findMany({
        where: { status: 'ACTIVE' },
        include: {
          economy: true,
          structure_upgrades: { where: { upgrade_type: 'HOUSE' } },
          bonus_points: { where: { bonus_type: 'RECRUITING' } },
        },
      });

      for (const player of players) {
        try {
          const economy = player.economy;
          if (!economy) continue;

          const houseUpgrade = player.structure_upgrades.find(
            (u) => u.upgrade_type === 'HOUSE',
          );
          const houseLevel = houseUpgrade?.level ?? 1;
          const houseDef = getHouseUpgradeByLevel(houseLevel);
          const citizensDaily = houseDef?.citizensDaily ?? 1;

          const recruitingBonus =
            player.bonus_points.find((b) => b.bonus_type === 'RECRUITING')
              ?.level ?? 0;

          const totalCitizens = calculateAutoRecruitCitizens(
            citizensDaily,
            recruitingBonus,
          );

          await this.prisma.$transaction(async (tx) => {
            // Upsert CITIZEN unit (level 1)
            const existing = await tx.playerUnit.findUnique({
              where: {
                player_id_unit_type_level: {
                  player_id: player.id,
                  unit_type: 'CITIZEN',
                  level: 1,
                },
              },
            });

            if (existing) {
              await tx.playerUnit.update({
                where: { id: existing.id },
                data: { quantity: { increment: totalCitizens } },
              });
            } else {
              await tx.playerUnit.create({
                data: {
                  player_id: player.id,
                  unit_type: 'CITIZEN',
                  level: 1,
                  quantity: totalCitizens,
                },
              });
            }

            // Create DAILY_RECRUIT bank history
            await tx.bankHistory.create({
              data: {
                gold_amount: BigInt(0),
                from_user_id: player.id,
                from_account_type: BankAccountType.HAND,
                to_user_id: player.id,
                to_account_type: BankAccountType.HAND,
                date_time: new Date(),
                history_type: BankTransferHistoryType.DAILY_RECRUIT,
                stats: JSON.stringify({ citizensAdded: totalCitizens }),
              },
            });
          });

          playersProcessed++;
        } catch (playerErr) {
          this.logger.error(
            `Daily tick failed for player ${player.id}: ${playerErr}`,
          );
        }
      }

      // ─── Reset Daily Ranking Counters ─────────────────────────
      await this.prisma.playerCumulativeStats.updateMany({
        data: {
          daily_attack_wins: 0,
          daily_defense_wins: 0,
          daily_gold_stolen: BigInt(0),
          daily_gold_income: BigInt(0),
          daily_spy_wins: 0,
          daily_units_trained: 0,
          daily_reset_at: new Date(),
        },
      });
      this.logger.log('Reset daily ranking counters');

      // ─── DB Cleanup (20+ days old) ───────────────────────────
      const cutoffDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);

      const [deletedAttackLogs, deletedBankHistory, deletedRecruitHistory] =
        await Promise.all([
          this.prisma.attackLog.deleteMany({
            where: { timestamp: { lt: cutoffDate } },
          }),
          this.prisma.bankHistory.deleteMany({
            where: { date_time: { lt: cutoffDate } },
          }),
          this.prisma.recruitHistory.deleteMany({
            where: { timestamp: { lt: cutoffDate } },
          }),
        ]);

      this.logger.log(
        `Cleanup: deleted ${deletedAttackLogs.count} attack logs, ${deletedBankHistory.count} bank history, ${deletedRecruitHistory.count} recruit history`,
      );

      // ─── Account Status Checks ───────────────────────────────
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      // ACTIVE players inactive for 60+ days → IDLE
      await this.prisma.player.updateMany({
        where: {
          status: 'ACTIVE',
          last_active: { lt: sixtyDaysAgo },
        },
        data: { status: 'IDLE' },
      });

      // Expired VACATION/BANNED → check AccountStatusHistory for end_date
      const expiredStatuses = await this.prisma.accountStatusHistory.findMany({
        where: {
          status: { in: ['VACATION', 'BANNED', 'SUSPENDED', 'TIMEOUT'] },
          end_date: { lte: new Date() },
        },
      });

      for (const statusHistory of expiredStatuses) {
        await this.prisma.player.update({
          where: { id: statusHistory.user_id },
          data: { status: 'ACTIVE' },
        });
      }

      this.logger.log(
        `Daily tick complete: ${playersProcessed}/${players.length} players processed`,
      );
    } catch (err) {
      errorMessage =
        err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Daily tick failed: ${errorMessage}`);
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
          details: JSON.stringify({
            playersProcessed,
          }),
        },
      });
      this.isRunning = false;
    }

    this.eventEmitter.emit(
      'system.daily_tick',
      new DailyTickEvent(new Date(), playersProcessed),
    );

    return { playersProcessed, durationMs: Date.now() - startTime };
  }
}
