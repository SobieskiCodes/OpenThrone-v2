import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import {
  getBuildingLevel,
  calculateAutoRecruitCitizens,
  calculateRankScore,
  computeArmoryResaleValue,
  computeBattleUpgradeResaleValue,
} from '@openthrone/game-logic';
import { DailyTickEvent } from '@openthrone/events';
import { BankAccountType, BankTransferHistoryType, BuildingType } from '@openthrone/shared';

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
          buildings: { where: { building_type: 'HOUSING' } },
          bonus_points: { where: { bonus_type: 'RECRUITING' } },
        },
      });

      for (const player of players) {
        try {
          const economy = player.economy;
          if (!economy) continue;

          const housingRow = player.buildings.find(
            (b) => b.building_type === 'HOUSING',
          );
          const housingLevel = housingRow?.level ?? 0;
          const housingDef = getBuildingLevel(BuildingType.HOUSING, housingLevel);
          const citizensDaily = housingDef?.citizensPerDay ?? 1; // base 1 citizen/day

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

      // ─── Reset Auto-Recruit Pool ─────────────────────────────
      await this.prisma.playerEconomy.updateMany({
        data: { last_auto_recruit: null },
      });
      this.logger.log('Reset auto-recruit pool');

      // ─── Reset Bot Daily Sessions ─────────────────────────────
      await this.prisma.botConfig.updateMany({
        data: { sessions_today: 0 },
      });
      this.logger.log('Reset bot daily sessions');

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

      // ─── Snapshot Rankings ───────────────────────────────────
      await this.snapshotRankings();
      this.logger.log('Snapshotted daily rankings');

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

  /**
   * Snapshot current rankings for all players (called at midnight UTC).
   * Updates PlayerStats.previous_rank and creates RankingSnapshot records.
   */
  private async snapshotRankings() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Normalize to midnight UTC

    // Fetch all active players with their current stats
    const players = await this.prisma.player.findMany({
      where: { status: 'ACTIVE' },
      include: {
        stats: true,
        economy: { select: { gold: true, gold_in_bank: true } },
        items: { select: { item_type: true, usage: true, level: true, quantity: true } },
        battle_upgrades: { select: { upgrade_type: true, level: true, quantity: true } },
      },
    });

    // Prepare snapshot records
    const snapshots: Array<{
      player_id: string;
      category: string;
      rank: number;
      score: number;
      snapshot_date: Date;
    }> = [];

    for (const player of players) {
      if (!player.stats) continue;

      // Calculate net worth for this player
      const gold = Number(player.economy?.gold ?? 0);
      const bank = Number(player.economy?.gold_in_bank ?? 0);
      const armoryResale = computeArmoryResaleValue(
        (player.items ?? []).map((i) => ({
          itemType: i.item_type,
          usage: i.usage,
          level: i.level,
          quantity: i.quantity,
        })),
      );
      const battleUpgradeResale = computeBattleUpgradeResaleValue(
        (player.battle_upgrades ?? []).map((bu) => ({
          upgradeType: bu.upgrade_type,
          level: bu.level,
          quantity: bu.quantity,
        })),
      );
      const netWorth = gold + bank + armoryResale + battleUpgradeResale;

      // Snapshot all categories
      snapshots.push(
        {
          player_id: player.id,
          category: 'overall',
          rank: player.stats.rank,
          score: calculateRankScore({
            offense: player.stats.offense,
            defense: player.stats.defense,
            netWorth,
          }),
          snapshot_date: today,
        },
        {
          player_id: player.id,
          category: 'offense',
          rank: 0, // Will be calculated below
          score: player.stats.offense,
          snapshot_date: today,
        },
        {
          player_id: player.id,
          category: 'defense',
          rank: 0, // Will be calculated below
          score: player.stats.defense,
          snapshot_date: today,
        },
        {
          player_id: player.id,
          category: 'spy',
          rank: 0, // Will be calculated below
          score: player.stats.spy,
          snapshot_date: today,
        },
        {
          player_id: player.id,
          category: 'sentry',
          rank: 0, // Will be calculated below
          score: player.stats.sentry,
          snapshot_date: today,
        },
        {
          player_id: player.id,
          category: 'netWorth',
          rank: 0, // Will be calculated below
          score: netWorth,
          snapshot_date: today,
        },
      );
    }

    // Calculate ranks for each category (descending order by score)
    const categories = ['overall', 'offense', 'defense', 'spy', 'sentry', 'netWorth'];
    for (const category of categories) {
      const categorySnapshots = snapshots
        .filter((s) => s.category === category)
        .sort((a, b) => b.score - a.score);

      for (let i = 0; i < categorySnapshots.length; i++) {
        categorySnapshots[i]!.rank = i + 1;
      }
    }

    // Delete old snapshots for today (in case we're re-running)
    await this.prisma.rankingSnapshot.deleteMany({
      where: { snapshot_date: today },
    });

    // Insert all snapshots
    await this.prisma.rankingSnapshot.createMany({
      data: snapshots,
    });

    // Update PlayerStats.previous_rank to current rank (for movement arrows)
    for (const player of players) {
      if (!player.stats) continue;
      await this.prisma.playerStats.update({
        where: { id: player.stats.id },
        data: { previous_rank: player.stats.rank },
      });
    }
  }
}
