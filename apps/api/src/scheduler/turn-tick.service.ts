import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { calculateGoldPerTurn } from '@openthrone/game-logic';
import { TurnTickEvent, RankingsRecalculatedEvent } from '@openthrone/events';
import { BankAccountType, BankTransferHistoryType } from '@openthrone/shared';

@Injectable()
export class TurnTickService {
  private readonly logger = new Logger(TurnTickService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
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

      // Fetch all ACTIVE players with their economy, fortification, units, and bonus points
      const players = await this.prisma.player.findMany({
        where: { status: 'ACTIVE' },
        include: {
          economy: true,
          fortification: true,
          units: { where: { unit_type: 'WORKER' } },
          bonus_points: { where: { bonus_type: 'INCOME' } },
          structure_upgrades: { where: { upgrade_type: 'ECONOMY' } },
        },
      });

      for (const player of players) {
        try {
          const economy = player.economy;
          const fort = player.fortification;
          if (!economy || !fort) continue;

          const fortLevel = fort.fort_level;
          const economyUpgrade = player.structure_upgrades.find(
            (u) => u.upgrade_type === 'ECONOMY',
          );
          const economyLevel = economyUpgrade?.level ?? 1;
          const workerCount = player.units.reduce(
            (sum, u) => sum + u.quantity,
            0,
          );
          const incomeBonus =
            player.bonus_points.find((b) => b.bonus_type === 'INCOME')?.level ??
            0;

          const goldEarned = calculateGoldPerTurn(
            fortLevel,
            economyLevel,
            workerCount,
            incomeBonus,
          );

          await this.prisma.$transaction(async (tx) => {
            // Increment gold and attack turns
            await tx.playerEconomy.update({
              where: { player_id: player.id },
              data: {
                gold: { increment: goldEarned },
                attack_turns: { increment: 1 },
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

    return { playersProcessed, durationMs: Date.now() - startTime };
  }

  private async recalculateRankings() {
    const stats = await this.prisma.playerStats.findMany({
      orderBy: [
        { offense: 'desc' },
        { defense: 'desc' },
      ],
    });

    // Combined score = offense + defense + spy + sentry
    const ranked = stats
      .map((s) => ({
        id: s.id,
        playerId: s.player_id,
        score: s.offense + s.defense + s.spy + s.sentry,
      }))
      .sort((a, b) => b.score - a.score);

    for (const [i, entry] of ranked.entries()) {
      await this.prisma.playerStats.update({
        where: { id: entry.id },
        data: { rank: i + 1 },
      });
    }

    this.eventEmitter.emit(
      'system.rankings_recalculated',
      new RankingsRecalculatedEvent(new Date()),
    );
  }
}
