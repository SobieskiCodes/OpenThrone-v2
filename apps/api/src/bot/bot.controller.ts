import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  PermissionType,
  updateBotSchema,
  generateBotsSchema,
  UpdateBotDto,
  GenerateBotsDto,
} from '@openthrone/shared';
import { BotService } from './bot.service';
import { BotSchedulerService } from './bot-scheduler.service';
import { BotSnapshotService } from './bot-snapshot.service';

@Controller('admin/bots')
@UseGuards(RolesGuard)
@Roles(PermissionType.ADMINISTRATOR)
export class BotController {
  constructor(
    private readonly botService: BotService,
    private readonly botScheduler: BotSchedulerService,
    private readonly snapshotService: BotSnapshotService,
  ) {}

  // ── Static routes FIRST (before :id) ──────────────────────────────

  @Get('stats')
  async getStats() {
    const stats = await this.botService.getStats();
    return {
      ...stats,
      schedulerEnabled: this.botScheduler.getSchedulerEnabled(),
      isRunning: this.botScheduler.getIsRunning(),
      nextRunAt: this.botScheduler.getNextRunTime().toISOString(),
    };
  }

  @Post('generate')
  async generateBots(
    @Body(new ZodValidationPipe(generateBotsSchema)) dto: GenerateBotsDto,
  ) {
    return this.botService.generateBots(dto);
  }

  @Post('run-all')
  async runAllBots() {
    return this.botScheduler.runAllBots();
  }

  // ── CRUD routes ───────────────────────────────────────────────────

  @Get()
  async listBots(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('strategy') strategy?: string,
    @Query('active') active?: string,
  ) {
    return this.botService.listBots(
      Math.max(1, parseInt(page || '1', 10)),
      Math.min(50, Math.max(1, parseInt(limit || '20', 10))),
      strategy || undefined,
      active !== undefined ? active === 'true' : undefined,
    );
  }

  // ── Parameterized routes ──────────────────────────────────────────

  @Get(':id/analytics')
  async getBotAnalytics(
    @Param('id', ParseIntPipe) id: number,
    @Query('period') period?: string,
  ) {
    // Parse time period
    const now = new Date();
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '3m':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '6m':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
      default:
        startDate.setFullYear(2020, 0, 1); // Far in the past
        break;
    }

    const snapshots = await this.snapshotService.getSnapshotHistory(
      id,
      startDate,
      now,
    );

    // Calculate summary metrics
    const summary = this.calculateSummaryMetrics(snapshots);

    return {
      snapshots: snapshots.map((s) => ({
        date: s.snapshot_date,
        gold: s.gold.toString(),
        goldInBank: s.gold_in_bank.toString(),
        attackTurns: s.attack_turns,
        level: s.level,
        experience: s.experience.toString(),
        offense: s.offense,
        defense: s.defense,
        spy: s.spy,
        sentry: s.sentry,
        citizens: s.citizens,
        workers: s.workers,
        offenseUnits: s.offense_units,
        defenseUnits: s.defense_units,
        spyUnits: s.spy_units,
        sentryUnits: s.sentry_units,
        totalPopulation: s.total_population,
        fortLevel: s.fort_level,
        fortHP: s.fort_hp,
        attacksWon: s.attacks_won,
        attacksLost: s.attacks_lost,
        goldStolen: s.gold_stolen.toString(),
        goldLost: s.gold_lost.toString(),
        sessionsRun: s.sessions_run,
        actionsPerformed: s.actions_performed,
        actionsFailed: s.actions_failed,
      })),
      summary,
    };
  }

  @Get(':id')
  async getBot(@Param('id', ParseIntPipe) id: number) {
    return this.botService.getBot(id);
  }

  private calculateSummaryMetrics(snapshots: any[]) {
    if (snapshots.length === 0) {
      return {
        goldGrowthRate: 0,
        xpGrowthRate: 0,
        avgActionsPerSession: 0,
        combatWinRate: 0,
        actionSuccessRate: 0,
      };
    }

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const daysDiff = Math.max(
      1,
      (new Date(last.snapshot_date).getTime() -
        new Date(first.snapshot_date).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    const goldDiff = Number(last.gold) - Number(first.gold);
    const xpDiff = Number(last.experience) - Number(first.experience);

    const totalWins = snapshots.reduce((sum, s) => sum + s.attacks_won, 0);
    const totalLosses = snapshots.reduce((sum, s) => sum + s.attacks_lost, 0);
    const totalSessions = snapshots.reduce((sum, s) => sum + s.sessions_run, 0);
    const totalActions = snapshots.reduce((sum, s) => sum + s.actions_performed, 0);
    const totalFailed = snapshots.reduce((sum, s) => sum + s.actions_failed, 0);

    return {
      goldGrowthRate: Math.round(goldDiff / daysDiff),
      xpGrowthRate: Math.round(xpDiff / daysDiff),
      avgActionsPerSession:
        totalSessions > 0 ? Math.round((totalActions / totalSessions) * 10) / 10 : 0,
      combatWinRate:
        totalWins + totalLosses > 0
          ? Math.round((totalWins / (totalWins + totalLosses)) * 100) / 100
          : 0,
      actionSuccessRate:
        totalActions + totalFailed > 0
          ? Math.round((totalActions / (totalActions + totalFailed)) * 100) / 100
          : 0,
    };
  }

  @Patch(':id')
  async updateBot(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(updateBotSchema)) dto: UpdateBotDto,
  ) {
    return this.botService.updateBot(id, dto);
  }

  @Delete(':id')
  async deleteBot(@Param('id', ParseIntPipe) id: number) {
    return this.botService.deleteBot(id);
  }

  @Get(':id/logs')
  async getBotLogs(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('actionType') actionType?: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.botService.getBotLogs(
      id,
      Math.max(1, parseInt(page || '1', 10)),
      Math.min(100, Math.max(1, parseInt(limit || '25', 10))),
      actionType || undefined,
      sessionId || undefined,
    );
  }

  @Post(':id/run')
  async runSingleBot(@Param('id', ParseIntPipe) id: number) {
    const bot = await this.botService.getBot(id);
    const actions = await this.botScheduler.runSingleBotWithJobLog(
      id,
      bot.playerId,
      bot.strategy,
      bot.personalitySeed,
    );
    return { success: true, actionsPerformed: actions };
  }
}
