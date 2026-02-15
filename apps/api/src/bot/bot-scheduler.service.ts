import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from './bot.service';
import { BotBrainService } from './bot-brain.service';
import { BotExecutorService } from './bot-executor.service';
import {
  BotSessionStartedEvent,
  BotSessionCompletedEvent,
} from '@openthrone/events';
import { calculateFullStats } from '@openthrone/game-logic';
import * as crypto from 'crypto';

@Injectable()
export class BotSchedulerService {
  private readonly logger = new Logger(BotSchedulerService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly botService: BotService,
    private readonly botBrain: BotBrainService,
    private readonly botExecutor: BotExecutorService,
  ) {}

  /**
   * Runs every 4 hours (6 windows per day).
   * Gated by ENABLE_BOT_SCHEDULER env var.
   */
  @Cron('0 0 */4 * * *')
  async handleCron() {
    if (!this.config.get('ENABLE_BOT_SCHEDULER')) return;
    await this.runAllBots();
  }

  /**
   * Run all active bots that still have sessions remaining today.
   * Can also be triggered manually from admin.
   */
  async runAllBots(): Promise<{ botsRun: number; totalActions: number }> {
    if (this.isRunning) {
      this.logger.warn('Bot scheduler already running, skipping');
      return { botsRun: 0, totalActions: 0 };
    }

    this.isRunning = true;
    const startTime = Date.now();
    let botsRun = 0;
    let totalActions = 0;

    const jobLog = await this.prisma.jobLog.create({
      data: { job_name: 'bot_session', status: 'RUNNING' },
    });

    try {
      const bots = await this.botService.getBotsReadyForSession();
      const eligible = bots.filter((b) => b.sessions_today < b.sessions_per_day);

      this.logger.log(
        `Bot scheduler: ${eligible.length}/${bots.length} bots eligible for session`,
      );

      for (const bot of eligible) {
        try {
          const actionsRun = await this.runSingleBot(
            bot.id,
            bot.player_id,
            bot.strategy,
            bot.personality_seed,
          );
          botsRun++;
          totalActions += actionsRun;
        } catch (err) {
          this.logger.error(
            `Bot session failed for ${bot.player.display_name}: ${err}`,
          );
        }

        // Stagger between bots: 2-5 seconds
        await this.sleep(2000 + Math.random() * 3000);
      }

      this.logger.log(
        `Bot scheduler complete: ${botsRun} bots, ${totalActions} actions in ${Date.now() - startTime}ms`,
      );
    } catch (err) {
      this.logger.error(`Bot scheduler failed: ${err}`);
    } finally {
      await this.prisma.jobLog.update({
        where: { id: jobLog.id },
        data: {
          status: 'COMPLETED',
          finished_at: new Date(),
          duration_ms: Date.now() - startTime,
          players_processed: botsRun,
          details: JSON.stringify({ botsRun, totalActions }),
        },
      });
      this.isRunning = false;
    }

    return { botsRun, totalActions };
  }

  /**
   * Run a single bot with a JobLog entry (used by manual admin trigger).
   */
  async runSingleBotWithJobLog(
    configId: number,
    playerId: string,
    strategy: string,
    personalitySeed: number,
  ): Promise<number> {
    const startTime = Date.now();
    const jobLog = await this.prisma.jobLog.create({
      data: { job_name: 'bot_session', status: 'RUNNING' },
    });

    try {
      const actionsPerformed = await this.runSingleBot(configId, playerId, strategy, personalitySeed);

      await this.prisma.jobLog.update({
        where: { id: jobLog.id },
        data: {
          status: 'COMPLETED',
          finished_at: new Date(),
          duration_ms: Date.now() - startTime,
          players_processed: 1,
          details: JSON.stringify({ botsRun: 1, totalActions: actionsPerformed }),
        },
      });

      return actionsPerformed;
    } catch (err) {
      await this.prisma.jobLog.update({
        where: { id: jobLog.id },
        data: {
          status: 'FAILED',
          finished_at: new Date(),
          duration_ms: Date.now() - startTime,
          error_message: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  }

  /**
   * Run a single bot's session. Can be triggered manually for one bot.
   */
  async runSingleBot(
    configId: number,
    playerId: string,
    strategy: string,
    personalitySeed: number,
  ): Promise<number> {
    const sessionId = crypto.randomUUID();
    const sessionStart = Date.now();

    this.eventEmitter.emit(
      'bot.session_started',
      new BotSessionStartedEvent(playerId, sessionId, strategy),
    );

    // Log session start
    await this.prisma.botActionLog.create({
      data: {
        bot_config_id: configId,
        session_id: sessionId,
        action_type: 'SESSION_START',
        action_data: JSON.stringify({ strategy }),
        reasoning: `Starting bot session (strategy: ${strategy})`,
      },
    });

    // Load game state
    const state = await this.botService.loadBotGameState(playerId);

    // Brain decides actions
    const actions = this.botBrain.decideActions(strategy, state, personalitySeed);
    let actionsPerformed = 0;

    for (const action of actions) {
      // Small delay between actions (0.5-2s)
      await this.sleep(500 + Math.random() * 1500);

      const result = await this.botExecutor.executeAction(
        action,
        playerId,
        state,
        strategy,
      );

      // Log the action
      await this.prisma.botActionLog.create({
        data: {
          bot_config_id: configId,
          session_id: sessionId,
          action_type: action.type,
          action_data: JSON.stringify(action.params ?? {}),
          result_data: result.resultData ? JSON.stringify(result.resultData) : null,
          reasoning: action.reasoning,
          success: result.success,
          error_message: result.errorMessage,
        },
      });

      if (result.success) actionsPerformed++;
    }

    const durationMs = Date.now() - sessionStart;

    // Recalculate player stats after all actions
    await this.recalculateStats(playerId);

    // Log session end
    await this.prisma.botActionLog.create({
      data: {
        bot_config_id: configId,
        session_id: sessionId,
        action_type: 'SESSION_END',
        action_data: JSON.stringify({ actionsPerformed, durationMs }),
        reasoning: `Session complete: ${actionsPerformed}/${actions.length} actions succeeded in ${durationMs}ms`,
      },
    });

    // Update bot config
    await this.prisma.botConfig.update({
      where: { id: configId },
      data: {
        last_session_at: new Date(),
        sessions_today: { increment: 1 },
      },
    });

    // Update player last_active
    await this.prisma.player.update({
      where: { id: playerId },
      data: { last_active: new Date() },
    });

    this.eventEmitter.emit(
      'bot.session_completed',
      new BotSessionCompletedEvent(playerId, sessionId, actionsPerformed, durationMs),
    );

    return actionsPerformed;
  }

  private async recalculateStats(playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        units: true,
        items: true,
        battle_upgrades: true,
        bonus_points: true,
        fortification: true,
      },
    });
    if (!player) return;

    const fullStats = calculateFullStats({
      race: player.race,
      playerClass: player.player_class,
      fortLevel: player.fortification?.fort_level ?? 1,
      units: player.units.map((u) => ({ unitType: u.unit_type, level: u.level, quantity: u.quantity })),
      items: player.items.map((i) => ({ itemType: i.item_type, usage: i.usage, level: i.level, quantity: i.quantity })),
      battleUpgrades: player.battle_upgrades.map((b) => ({ upgradeType: b.upgrade_type, level: b.level, quantity: b.quantity })),
      bonusPoints: player.bonus_points.map((bp) => ({ bonusType: bp.bonus_type, level: bp.level })),
    });

    await this.prisma.playerStats.update({
      where: { player_id: playerId },
      data: {
        offense: fullStats.offense.total,
        defense: fullStats.defense.total,
        spy: fullStats.spy.total,
        sentry: fullStats.sentry.total,
      },
    });
  }

  /**
   * Compute the next cron fire time (every 4 hours at :00:00).
   */
  getNextRunTime(): Date {
    const now = new Date();
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    // Advance to next 4-hour window
    const currentHour = now.getHours();
    const nextHour = Math.ceil((currentHour + 1) / 4) * 4;
    if (nextHour >= 24) {
      // Roll to next day at 00:00
      next.setDate(next.getDate() + 1);
      next.setHours(0);
    } else {
      next.setHours(nextHour);
    }
    return next;
  }

  getSchedulerEnabled(): boolean {
    return !!this.config.get('ENABLE_BOT_SCHEDULER');
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
