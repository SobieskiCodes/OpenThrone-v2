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
import { getLevelForXP } from '@openthrone/game-logic';
import { BotService } from './bot.service';
import { BotSchedulerService } from './bot-scheduler.service';
import { BotSnapshotService } from './bot-snapshot.service';
import { BotSimulationService } from './bot-simulation.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/bots')
@UseGuards(RolesGuard)
@Roles(PermissionType.ADMINISTRATOR)
export class BotController {
  constructor(
    private readonly botService: BotService,
    private readonly botScheduler: BotSchedulerService,
    private readonly snapshotService: BotSnapshotService,
    private readonly simulationService: BotSimulationService,
    private readonly prisma: PrismaService,
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

  @Get('analytics/global')
  async getGlobalAnalytics(@Query('period') period?: string) {
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
        startDate.setFullYear(2020, 0, 1);
        break;
    }

    // Get all active bots with their snapshots
    const bots = await this.prisma.botConfig.findMany({
      where: { is_active: true },
      include: {
        player: {
          select: {
            display_name: true,
            stats: {
              select: { rank: true, experience: true, offense: true, defense: true },
            },
            economy: {
              select: { gold: true, gold_in_bank: true },
            },
          },
        },
        snapshots: {
          where: {
            snapshot_date: {
              gte: startDate,
              lte: now,
            },
          },
          orderBy: { snapshot_date: 'asc' },
        },
      },
    });

    // Group by strategy for comparison
    const strategyData: Record<string, any[]> = {};
    const botData: any[] = [];

    for (const bot of bots) {
      if (!strategyData[bot.strategy]) {
        strategyData[bot.strategy] = [];
      }

      const latestSnapshot = bot.snapshots[bot.snapshots.length - 1];

      botData.push({
        id: bot.id,
        name: bot.player.display_name,
        strategy: bot.strategy,
        level: getLevelForXP(bot.player.stats?.experience ?? 0),
        gold: bot.player.economy?.gold.toString() ?? '0',
        offense: bot.player.stats?.offense ?? 0,
        defense: bot.player.stats?.defense ?? 0,
        snapshots: bot.snapshots.map((s) => ({
          date: s.snapshot_date,
          gold: Number(s.gold),
          level: s.level,
          totalPopulation: s.total_population,
          attacksWon: s.attacks_won,
          attacksLost: s.attacks_lost,
        })),
      });

      // Aggregate strategy data
      for (const snapshot of bot.snapshots) {
        const dateKey = snapshot.snapshot_date.toISOString().split('T')[0]!;
        let existing = strategyData[bot.strategy]!.find(
          (d: any) => d.date === dateKey,
        );
        if (!existing) {
          existing = {
            date: dateKey,
            gold: 0,
            population: 0,
            bots: 0,
          };
          strategyData[bot.strategy]!.push(existing);
        }
        existing.gold += Number(snapshot.gold);
        existing.population += snapshot.total_population;
        existing.bots++;
      }
    }

    // Average strategy data
    for (const strategy in strategyData) {
      if (strategyData[strategy]) {
        strategyData[strategy] = strategyData[strategy]!.map((d: any) => ({
          date: d.date,
          gold: Math.floor(d.gold / d.bots),
          population: Math.floor(d.population / d.bots),
        }));
      }
    }

    // Calculate global stats
    const totalGold = bots.reduce(
      (sum: number, b: any) => sum + Number(b.player.economy?.gold ?? 0) + Number(b.player.economy?.gold_in_bank ?? 0),
      0,
    );
    const totalPopulation = bots.reduce((sum: number, b: any) => {
      const latest = b.snapshots[b.snapshots.length - 1];
      return sum + (latest?.total_population ?? 0);
    }, 0);

    // Top performers
    const topByGold = [...bots]
      .sort((a, b) => {
        const aGold = Number(a.player.economy?.gold ?? 0) + Number(a.player.economy?.gold_in_bank ?? 0);
        const bGold = Number(b.player.economy?.gold ?? 0) + Number(b.player.economy?.gold_in_bank ?? 0);
        return bGold - aGold;
      })
      .slice(0, 5)
      .map((b) => ({
        name: b.player.display_name,
        strategy: b.strategy,
        gold: (Number(b.player.economy?.gold ?? 0) + Number(b.player.economy?.gold_in_bank ?? 0)).toLocaleString(),
      }));

    const topByLevel = [...bots]
      .map((b) => ({
        ...b,
        calculatedLevel: getLevelForXP(b.player.stats?.experience ?? 0),
      }))
      .sort((a, b) => b.calculatedLevel - a.calculatedLevel)
      .slice(0, 5)
      .map((b) => ({
        name: b.player.display_name,
        strategy: b.strategy,
        level: b.calculatedLevel,
      }));

    return {
      summary: {
        totalBots: bots.length,
        totalGold,
        totalPopulation,
      },
      topPerformers: {
        byGold: topByGold,
        byLevel: topByLevel,
      },
      strategyComparison: strategyData,
      bots: botData,
    };
  }

  @Get('analytics/battles')
  async getBattleAnalytics(@Query('period') period?: string) {
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
        startDate.setFullYear(2020, 0, 1);
        break;
    }

    // Get all active bots
    const botConfigs = await this.prisma.botConfig.findMany({
      where: { is_active: true },
      include: {
        player: {
          select: {
            id: true,
            display_name: true,
            stats: { select: { experience: true } },
          },
        },
      },
    });

    const botIds = botConfigs.map((b) => b.player_id);

    // Get all attack logs for bots (as attackers)
    const attackLogs = await this.prisma.attackLog.findMany({
      where: {
        type: 'attack',
        attacker_id: { in: botIds },
        timestamp: { gte: startDate, lte: now },
      },
      select: {
        id: true,
        attacker_id: true,
        winner: true,
        stats: true,
        timestamp: true,
      },
    });

    // Group by bot and calculate metrics
    const botStats: Record<
      string,
      {
        strategy: string;
        name: string;
        level: number;
        totalAttacks: number;
        wins: number;
        goldStolen: number;
        casualties: number;
      }
    > = {};

    for (const log of attackLogs) {
      if (!botStats[log.attacker_id]) {
        const config = botConfigs.find((b) => b.player_id === log.attacker_id);
        if (!config) continue;

        botStats[log.attacker_id] = {
          strategy: config.strategy,
          name: config.player.display_name,
          level: getLevelForXP(config.player.stats?.experience ?? 0),
          totalAttacks: 0,
          wins: 0,
          goldStolen: 0,
          casualties: 0,
        };
      }

      const stats = botStats[log.attacker_id]!;
      stats.totalAttacks++;

      if (log.winner === log.attacker_id) {
        stats.wins++;
      }

      // Parse stats JSON
      try {
        const logStats = JSON.parse(log.stats as string);
        stats.goldStolen += logStats.goldStolen || 0;
        stats.casualties += logStats.attackerCasualties?.total || 0;
      } catch (e) {
        // Ignore parsing errors
      }
    }

    // Calculate by-strategy aggregates
    const strategyGroups: Record<string, any[]> = {};
    for (const [botId, stats] of Object.entries(botStats)) {
      if (!strategyGroups[stats.strategy]) {
        strategyGroups[stats.strategy] = [];
      }
      strategyGroups[stats.strategy]!.push({ botId, ...stats });
    }

    const byStrategy: Record<string, any> = {};
    const daysDiff = Math.max(1, (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    for (const [strategy, bots] of Object.entries(strategyGroups)) {
      const totalBots = bots.length;
      const totalAttacks = bots.reduce((sum, b) => sum + b.totalAttacks, 0);
      const totalWins = bots.reduce((sum, b) => sum + b.wins, 0);
      const totalGold = bots.reduce((sum, b) => sum + b.goldStolen, 0);
      const totalCasualties = bots.reduce((sum, b) => sum + b.casualties, 0);

      const avgAttacksPerBot = totalBots > 0 ? totalAttacks / totalBots : 0;
      const winRate = totalAttacks > 0 ? totalWins / totalAttacks : 0;
      const avgGoldPerAttack = totalAttacks > 0 ? totalGold / totalAttacks : 0;
      const avgCasualtiesPerAttack = totalAttacks > 0 ? totalCasualties / totalAttacks : 0;

      // Gold efficiency = gold stolen - (casualties × avg unit cost ~10 gold)
      const goldEfficiency = avgGoldPerAttack - avgCasualtiesPerAttack * 10;

      byStrategy[strategy] = {
        attacksPerDay: avgAttacksPerBot / daysDiff,
        winRate,
        avgGoldPerAttack: Math.round(avgGoldPerAttack),
        avgCasualties: Math.round(avgCasualtiesPerAttack),
        goldEfficiency: Math.round(goldEfficiency),
        defensesWon: 0, // TODO: Calculate from defensive logs
      };
    }

    // Detect outliers
    const outliers: any[] = [];
    for (const [botId, stats] of Object.entries(botStats)) {
      const winRate = stats.totalAttacks > 0 ? stats.wins / stats.totalAttacks : 0;
      const avgCasualties = stats.totalAttacks > 0 ? stats.casualties / stats.totalAttacks : 0;

      let issue = null;
      let severity: 'CRITICAL' | 'WARNING' | 'GOOD' = 'GOOD';

      if (stats.totalAttacks >= 50 && winRate === 0) {
        issue = 'NO_SUCCESSFUL_ATTACKS';
        severity = 'CRITICAL';
      } else if (stats.totalAttacks >= 20 && winRate < 0.2) {
        issue = 'VERY_LOW_WIN_RATE';
        severity = 'CRITICAL';
      } else if (stats.totalAttacks >= 10 && winRate < 0.3) {
        issue = 'LOW_WIN_RATE';
        severity = 'WARNING';
      } else if (stats.totalAttacks < 3 && daysDiff > 3) {
        issue = 'VERY_LOW_ATTACK_FREQUENCY';
        severity = 'WARNING';
      } else if (avgCasualties > 80) {
        issue = 'EXCESSIVE_CASUALTIES';
        severity = 'WARNING';
      } else if (winRate > 0.95 && stats.totalAttacks >= 20) {
        issue = 'UNUSUALLY_HIGH_WIN_RATE';
        severity = 'GOOD';
      }

      if (issue) {
        outliers.push({
          botId,
          botName: stats.name,
          strategy: stats.strategy,
          level: stats.level,
          totalAttacks: stats.totalAttacks,
          winRate: Math.round(winRate * 100) / 100,
          issue,
          severity,
        });
      }
    }

    // Sort outliers: CRITICAL first, then WARNING, then GOOD
    outliers.sort((a, b) => {
      const severityOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, GOOD: 2 };
      return (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
    });

    // TODO: Time series data (win rate over time, gold per attack over time, etc.)
    // For now, return empty arrays
    const overTime = {
      dates: [],
      winRateByStrategy: {},
      goldPerAttackByStrategy: {},
      casualtyRateByStrategy: {},
    };

    return {
      byStrategy,
      outliers,
      overTime,
    };
  }

  @Get('analytics/unit-composition')
  async getUnitComposition(
    @Query('period') period?: string,
    @Query('strategy') strategy?: string,
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
        startDate.setFullYear(2020, 0, 1);
        break;
    }

    // Get snapshots for requested strategy (or all if not specified)
    const whereClause: any = {
      snapshot_date: { gte: startDate, lte: now },
    };

    if (strategy) {
      const botConfigs = await this.prisma.botConfig.findMany({
        where: { strategy, is_active: true },
        select: { id: true },
      });
      whereClause.bot_config_id = { in: botConfigs.map((b) => b.id) };
    }

    const snapshots = await this.prisma.botSnapshot.findMany({
      where: whereClause,
      include: {
        bot_config: {
          select: { strategy: true },
        },
      },
      orderBy: { snapshot_date: 'asc' },
    });

    // Group by date and strategy
    const dataByDate: Record<string, Record<string, any>> = {};

    for (const snapshot of snapshots) {
      const dateKey = snapshot.snapshot_date.toISOString().split('T')[0]!;
      if (!dataByDate[dateKey]) {
        dataByDate[dateKey] = {};
      }

      const strat = snapshot.bot_config.strategy;
      if (!dataByDate[dateKey]![strat]) {
        dataByDate[dateKey]![strat] = {
          count: 0,
          citizens: 0,
          workers: 0,
          offense: 0,
          defense: 0,
          spy: 0,
          sentry: 0,
        };
      }

      const data = dataByDate[dateKey]![strat]!;
      data.count++;
      data.citizens += snapshot.citizens;
      data.workers += snapshot.workers;
      data.offense += snapshot.offense_units;
      data.defense += snapshot.defense_units;
      data.spy += snapshot.spy_units;
      data.sentry += snapshot.sentry_units;
    }

    // Calculate percentages and format response
    const dates = Object.keys(dataByDate).sort();
    const composition: Record<string, any> = {};

    for (const [date, strategies] of Object.entries(dataByDate)) {
      for (const [strat, data] of Object.entries(strategies)) {
        if (!composition[strat]) {
          composition[strat] = {
            dates: [],
            citizens: [],
            workers: [],
            offense: [],
            defense: [],
            spy: [],
            sentry: [],
          };
        }

        const total =
          data.citizens +
          data.workers +
          data.offense +
          data.defense +
          data.spy +
          data.sentry;

        composition[strat]!.dates.push(date);
        composition[strat]!.citizens.push(total > 0 ? (data.citizens / total) * 100 : 0);
        composition[strat]!.workers.push(total > 0 ? (data.workers / total) * 100 : 0);
        composition[strat]!.offense.push(total > 0 ? (data.offense / total) * 100 : 0);
        composition[strat]!.defense.push(total > 0 ? (data.defense / total) * 100 : 0);
        composition[strat]!.spy.push(total > 0 ? (data.spy / total) * 100 : 0);
        composition[strat]!.sentry.push(total > 0 ? (data.sentry / total) * 100 : 0);
      }
    }

    return { composition };
  }

  @Get('analytics/equipment')
  async getEquipmentAnalytics(@Query('period') period?: string) {
    // Get all active bots with their items
    const botConfigs = await this.prisma.botConfig.findMany({
      where: { is_active: true },
      include: {
        player: {
          include: {
            stats: true,
            items: true,
            units: true,
          },
        },
      },
    });

    const botEquipment: any[] = [];

    for (const bot of botConfigs) {
      if (!bot.player) continue; // Skip if player relation is null

      // Count items by type and tier
      const weapons = bot.player.items.filter((i) => i.item_type === 'WEAPON');
      const armor = bot.player.items.filter((i) => i.item_type === 'ARMOR');

      // Count units by type
      const units = bot.player.units || [];
      const offenseUnits = units
        .filter((u) => u.unit_type === 'OFFENSE')
        .reduce((sum, u) => sum + u.quantity, 0);
      const defenseUnits = units
        .filter((u) => u.unit_type === 'DEFENSE')
        .reduce((sum, u) => sum + u.quantity, 0);

      // Calculate coverage
      const weaponCoverage = offenseUnits > 0 ? weapons.length / offenseUnits : 0;
      const armorCoverage = defenseUnits > 0 ? armor.length / defenseUnits : 0;

      // Calculate average tier (using 'level' field which represents tier)
      const avgWeaponTier =
        weapons.length > 0
          ? weapons.reduce((sum, w) => sum + w.level, 0) / weapons.length
          : 0;
      const avgArmorTier =
        armor.length > 0 ? armor.reduce((sum, a) => sum + a.level, 0) / armor.length : 0;

      botEquipment.push({
        botId: bot.player_id,
        botName: bot.player.display_name,
        strategy: bot.strategy,
        level: getLevelForXP(Number(bot.player.stats?.experience ?? 0)),
        weapons: weapons.length,
        armor: armor.length,
        offenseUnits,
        defenseUnits,
        weaponCoverage: Math.round(weaponCoverage * 100),
        armorCoverage: Math.round(armorCoverage * 100),
        avgWeaponTier: Math.round(avgWeaponTier * 10) / 10,
        avgArmorTier: Math.round(avgArmorTier * 10) / 10,
        status:
          weaponCoverage >= 0.8 && armorCoverage >= 0.8
            ? 'GOOD'
            : weaponCoverage >= 0.5 && armorCoverage >= 0.5
              ? 'FAIR'
              : 'POOR',
      });
    }

    // Calculate by-strategy averages
    const byStrategy: Record<string, any> = {};
    const strategyGroups: Record<string, any[]> = {};

    for (const bot of botEquipment) {
      if (!strategyGroups[bot.strategy]) {
        strategyGroups[bot.strategy] = [];
      }
      strategyGroups[bot.strategy]!.push(bot);
    }

    for (const [strategy, bots] of Object.entries(strategyGroups)) {
      const totalBots = bots.length;
      if (totalBots === 0) continue;

      byStrategy[strategy] = {
        avgWeapons: Math.round(bots.reduce((sum, b) => sum + b.weapons, 0) / totalBots),
        avgArmor: Math.round(bots.reduce((sum, b) => sum + b.armor, 0) / totalBots),
        avgOffenseUnits: Math.round(
          bots.reduce((sum, b) => sum + b.offenseUnits, 0) / totalBots,
        ),
        avgDefenseUnits: Math.round(
          bots.reduce((sum, b) => sum + b.defenseUnits, 0) / totalBots,
        ),
        avgWeaponCoverage: Math.round(
          bots.reduce((sum, b) => sum + b.weaponCoverage, 0) / totalBots,
        ),
        avgArmorCoverage: Math.round(
          bots.reduce((sum, b) => sum + b.armorCoverage, 0) / totalBots,
        ),
        avgWeaponTier:
          Math.round((bots.reduce((sum, b) => sum + b.avgWeaponTier, 0) / totalBots) * 10) /
          10,
        avgArmorTier:
          Math.round((bots.reduce((sum, b) => sum + b.avgArmorTier, 0) / totalBots) * 10) / 10,
      };
    }

    return {
      byStrategy,
      bots: botEquipment,
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

  @Post('simulation/start')
  async startSimulation(
    @Body() body: { days?: number; sessionsPerDay?: number },
  ) {
    const days = body.days ?? 180;
    const sessionsPerDay = body.sessionsPerDay ?? 5;

    // Run simulation in background (don't block request)
    this.simulationService.runSimulation(days, sessionsPerDay).catch((err) => {
      console.error('Simulation error:', err);
    });

    return {
      message: 'Simulation started',
      days,
      sessionsPerDay,
    };
  }

  @Get('simulation/status')
  async getSimulationStatus() {
    const status = this.simulationService.getSimulationStatus();
    return status || { status: 'idle' };
  }

  @Post('simulation/cancel')
  async cancelSimulation() {
    this.simulationService.cancelSimulation();
    return { message: 'Cancellation requested' };
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

  @Get('logs')
  async getAllBotLogs(
    @Query('limit') limit?: string,
    @Query('botId') botId?: string,
    @Query('actionType') actionType?: string,
    @Query('sessionId') sessionId?: string,
    @Query('success') success?: string,
    @Query('hours') hours?: string,
    @Query('days') days?: string,
  ) {
    // Parse limit (default 50, max 200)
    const parsedLimit = Math.min(200, Math.max(1, parseInt(limit || '50', 10)));

    // Build where clause
    const where: any = {};

    // Filter by specific bot
    if (botId) {
      const botConfig = await this.prisma.botConfig.findFirst({
        where: { player_id: botId },
      });
      if (botConfig) {
        where.bot_config_id = botConfig.id;
      }
    }

    // Filter by action type
    if (actionType) {
      where.action_type = actionType;
    }

    // Filter by session
    if (sessionId) {
      where.session_id = sessionId;
    }

    // Filter by success/failure
    if (success !== undefined) {
      where.success = success === 'true';
    }

    // Filter by time range
    if (hours || days) {
      const now = new Date();
      const timeAgo = new Date();
      if (hours) {
        timeAgo.setHours(now.getHours() - parseInt(hours, 10));
      } else if (days) {
        timeAgo.setDate(now.getDate() - parseInt(days, 10));
      }
      where.created_at = { gte: timeAgo };
    }

    const logs = await this.prisma.botActionLog.findMany({
      where,
      include: {
        bot_config: {
          include: {
            player: {
              select: { id: true, display_name: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: parsedLimit,
    });

    return {
      logs: logs.map((log) => ({
        id: log.id,
        botId: log.bot_config.player_id,
        botName: log.bot_config.player.display_name,
        strategy: log.bot_config.strategy,
        sessionId: log.session_id,
        actionType: log.action_type,
        actionData: JSON.parse(log.action_data || '{}'),
        resultData: log.result_data ? JSON.parse(log.result_data) : null,
        reasoning: log.reasoning,
        success: log.success,
        errorMessage: log.error_message,
        createdAt: log.created_at,
      })),
      total: logs.length,
      filters: { botId, actionType, sessionId, success, hours, days, limit: parsedLimit },
    };
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
        fortificationLevel: s.fortification_level,
        armoryLevel: s.armory_level,
        mineLevel: s.mine_level,
        spyAcademyLevel: s.spy_academy_level,
        housingLevel: s.housing_level,
        mercenaryCampLevel: s.mercenary_camp_level,
        chatMessagesSent: s.chat_messages_sent,
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
