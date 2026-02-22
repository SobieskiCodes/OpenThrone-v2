import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BotBrainService } from './bot-brain.service';
import { BotExecutorService } from './bot-executor.service';
import { BotSnapshotService } from './bot-snapshot.service';
import { BotService } from './bot.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface SimulationProgress {
  status: 'running' | 'completed' | 'cancelled' | 'error';
  currentDay: number;
  totalDays: number;
  currentBot: number;
  totalBots: number;
  totalActions: number;
  startTime: number;
  error?: string;
}

@Injectable()
export class BotSimulationService {
  private readonly logger = new Logger(BotSimulationService.name);
  private currentSimulation: SimulationProgress | null = null;
  private shouldCancel = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly botService: BotService,
    private readonly botBrain: BotBrainService,
    private readonly botExecutor: BotExecutorService,
    private readonly snapshotService: BotSnapshotService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Get current simulation status
   */
  getSimulationStatus(): SimulationProgress | null {
    return this.currentSimulation;
  }

  /**
   * Cancel running simulation
   */
  cancelSimulation() {
    if (this.currentSimulation?.status === 'running') {
      this.shouldCancel = true;
      this.logger.warn('Simulation cancellation requested');
    }
  }

  /**
   * Run fast-forward simulation for all active bots
   * @param days Number of days to simulate (default: 180 = 6 months)
   * @param sessionsPerDay How many sessions each bot runs per day (default: 5)
   */
  async runSimulation(days = 180, sessionsPerDay = 5): Promise<SimulationProgress> {
    if (this.currentSimulation?.status === 'running') {
      throw new Error('Simulation already running');
    }

    this.shouldCancel = false;
    this.currentSimulation = {
      status: 'running',
      currentDay: 0,
      totalDays: days,
      currentBot: 0,
      totalBots: 0,
      totalActions: 0,
      startTime: Date.now(),
    };

    try {
      // Get all active bots
      const bots = await this.prisma.botConfig.findMany({
        where: { is_active: true },
      });

      this.currentSimulation.totalBots = bots.length;
      this.logger.log(
        `Starting simulation: ${days} days, ${bots.length} bots, ${sessionsPerDay} sessions/day`,
      );

      // Calculate start date (beginning of simulation = days ago)
      const simulationStartDate = new Date();
      simulationStartDate.setDate(simulationStartDate.getDate() - days);

      // Simulate each day
      for (let day = 1; day <= days; day++) {
        if (this.shouldCancel) {
          this.currentSimulation.status = 'cancelled';
          this.logger.warn(`Simulation cancelled at day ${day}`);
          break;
        }

        this.currentSimulation.currentDay = day;
        this.logger.log(`📅 Simulating day ${day}/${days}`);

        // Run each bot
        for (let botIdx = 0; botIdx < bots.length; botIdx++) {
          if (this.shouldCancel) break;

          const bot = bots[botIdx]!;
          this.currentSimulation.currentBot = botIdx + 1;

          // Run multiple sessions per day
          for (let session = 0; session < sessionsPerDay; session++) {
            if (this.shouldCancel) break;

            try {
              const actions = await this.runBotSession(
                bot.id,
                bot.player_id,
                bot.strategy,
                bot.personality_seed,
              );
              this.currentSimulation.totalActions += actions;

              // Small delay to prevent overwhelming DB (10ms per session)
              await this.sleep(10);
            } catch (err) {
              this.logger.error(
                `Session failed for bot ${bot.id} on day ${day}: ${err}`,
              );
            }
          }
        }

        // Run turn ticks (simulate every 30 min = 48 ticks per day)
        // For performance, do fewer ticks with scaled income
        const turnsPerTick = 6; // Normal turn tick gives 6 turns
        const ticksPerDay = 8; // 8 ticks = every 3 hours
        for (let tick = 0; tick < ticksPerDay; tick++) {
          await this.runTurnTick(bots, turnsPerTick);
        }

        // End-of-day processing (citizen generation, daily resets)
        await this.runDailyTick(bots);

        // Calculate simulated date for this day
        const simulatedDate = new Date(simulationStartDate);
        simulatedDate.setDate(simulatedDate.getDate() + day);

        // Capture snapshots for all bots with simulated date
        for (const bot of bots) {
          try {
            await this.snapshotService.captureSnapshot(bot.id, simulatedDate);
          } catch (err) {
            this.logger.error(`Snapshot failed for bot ${bot.id}: ${err}`);
          }
        }

        // Log progress every 10 days
        if (day % 10 === 0) {
          const elapsed = Date.now() - this.currentSimulation.startTime;
          const rate = (day / elapsed) * 1000 * 60; // days per minute
          const eta = ((days - day) / rate).toFixed(1);
          this.logger.log(
            `Progress: ${day}/${days} days (${rate.toFixed(1)} days/min, ETA: ${eta}min)`,
          );
        }
      }

      // Mark as completed
      if (this.currentSimulation.status === 'running') {
        this.currentSimulation.status = 'completed';
        const duration = ((Date.now() - this.currentSimulation.startTime) / 1000).toFixed(1);
        this.logger.log(
          `✅ Simulation complete: ${this.currentSimulation.totalActions} total actions in ${duration}s`,
        );
      }

      return this.currentSimulation;
    } catch (err: any) {
      this.currentSimulation.status = 'error';
      this.currentSimulation.error = err.message;
      this.logger.error(`Simulation error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Run a single bot session (mimics bot-scheduler logic)
   */
  private async runBotSession(
    botId: number,
    playerId: string,
    strategy: string,
    seed: number,
  ): Promise<number> {
    // Load bot game state
    const state = await this.botService.loadBotGameState(playerId);

    // Brain decides actions
    const actions = this.botBrain.decideActions(strategy, state, seed);

    // Execute actions and LOG them
    let actionsPerformed = 0;
    const sessionId = `sim-${Date.now()}-${botId}`;

    // Log session start
    await this.prisma.botActionLog.create({
      data: {
        bot_config_id: botId,
        session_id: sessionId,
        action_type: 'SESSION_START',
        action_data: {},
        reasoning: `Starting bot session (strategy: ${strategy})`,
        success: true,
        created_at: new Date(),
      },
    });

    for (const action of actions) {
      const result = await this.botExecutor.executeAction(
        action,
        playerId,
        state,
        strategy,
      );

      // Log the action
      await this.prisma.botActionLog.create({
        data: {
          bot_config_id: botId,
          session_id: sessionId,
          action_type: action.type,
          action_data: action.params || {},
          reasoning: action.reasoning,
          success: result.success,
          error_message: result.errorMessage || null,
          created_at: new Date(),
        },
      });

      if (result.success) {
        actionsPerformed++;
      }
    }

    // Log session end
    await this.prisma.botActionLog.create({
      data: {
        bot_config_id: botId,
        session_id: sessionId,
        action_type: 'SESSION_END',
        action_data: { actionsPerformed, totalActions: actions.length },
        reasoning: `Session complete: ${actionsPerformed}/${actions.length} actions succeeded`,
        success: true,
        created_at: new Date(),
      },
    });

    // Update snapshot metrics
    await this.snapshotService.updateSessionMetrics(
      botId,
      actionsPerformed,
      actions.length - actionsPerformed,
    );

    return actionsPerformed;
  }

  /**
   * Run daily tick for all bots (income, turns, etc.)
   */
  private async runDailyTick(bots: any[]) {
    for (const bot of bots) {
      try {
        const player = await this.prisma.player.findUnique({
          where: { id: bot.player_id },
          include: { economy: true, units: true, fortification: true },
        });

        if (!player?.economy) continue;

        // Calculate daily income
        const workers = player.units.find((u) => u.unit_type === 'WORKER')?.quantity ?? 0;
        const fortLevel = player.fortification?.fort_level ?? 0;
        const workerIncome = workers * 25; // 25 gold per worker
        const fortIncome = fortLevel * 250; // 250 gold per fort level
        const totalIncome = workerIncome + fortIncome;

        // Update economy (daily income only - turns handled by turn ticks)
        await this.prisma.playerEconomy.update({
          where: { player_id: player.id },
          data: {
            gold: { increment: BigInt(totalIncome) },
          },
        });

        // Generate citizens (from housing building or default)
        const housingLevel =
          (
            await this.prisma.playerBuilding.findUnique({
              where: {
                player_id_building_type: {
                  player_id: player.id,
                  building_type: 'HOUSING',
                },
              },
            })
          )?.level ?? 0;

        const citizensPerDay = housingLevel > 0 ? [150, 200, 250, 350, 500][housingLevel - 1] : 150;

        const citizenUnit = await this.prisma.playerUnit.findUnique({
          where: {
            player_id_unit_type_level: {
              player_id: player.id,
              unit_type: 'CITIZEN',
              level: 1,
            },
          },
        });

        if (citizenUnit) {
          await this.prisma.playerUnit.update({
            where: { id: citizenUnit.id },
            data: { quantity: { increment: citizensPerDay } },
          });
        }
      } catch (err) {
        this.logger.error(`Daily tick failed for bot ${bot.id}: ${err}`);
      }
    }
  }

  /**
   * Run turn tick for all bots (attack turns + gold income)
   */
  private async runTurnTick(bots: any[], turnsToAdd: number) {
    for (const bot of bots) {
      try {
        const player = await this.prisma.player.findUnique({
          where: { id: bot.player_id },
          include: { economy: true, units: true, fortification: true },
        });

        if (!player?.economy) continue;

        // Calculate turn tick income (same formula as real turn tick)
        const workers = player.units.find((u) => u.unit_type === 'WORKER')?.quantity ?? 0;
        const buildings = await this.prisma.playerBuilding.findMany({
          where: { player_id: player.id },
        });
        const mineLevel = buildings.find((b) => b.building_type === 'MINE')?.level ?? 0;
        const fortLevel = player.fortification?.fort_level ?? 1;

        const workerIncome = workers * 5; // 5 gold per worker per turn
        const mineIncome = mineLevel * 500; // 500 gold per mine level per turn
        const fortIncome = fortLevel * 25; // 25 gold per fort level per turn
        const totalIncome = workerIncome + mineIncome + fortIncome;

        // Update economy
        await this.prisma.playerEconomy.update({
          where: { player_id: player.id },
          data: {
            gold: { increment: BigInt(totalIncome) },
            attack_turns: { increment: turnsToAdd },
          },
        });
      } catch (err) {
        this.logger.error(`Turn tick failed for bot ${bot.id}: ${err}`);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
