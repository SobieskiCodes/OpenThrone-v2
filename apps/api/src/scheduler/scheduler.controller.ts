import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TurnTickService } from './turn-tick.service';
import { DailyTickService } from './daily-tick.service';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionType } from '@openthrone/shared';

@Controller('scheduler')
@UseGuards(RolesGuard)
@Roles(PermissionType.ADMINISTRATOR)
export class SchedulerController {
  constructor(
    private readonly turnTickService: TurnTickService,
    private readonly dailyTickService: DailyTickService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Post('turn-tick')
  async triggerTurnTick() {
    return this.turnTickService.executeTurnTick();
  }

  @Post('daily-tick')
  async triggerDailyTick() {
    return this.dailyTickService.executeDailyTick();
  }

  @Get('logs')
  async getLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobName') jobName?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit || '20', 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (jobName) where.job_name = jobName;

    const [rows, total] = await Promise.all([
      this.prisma.jobLog.findMany({
        where,
        take: limitNum,
        skip,
        orderBy: { started_at: 'desc' },
      }),
      this.prisma.jobLog.count({ where }),
    ]);

    return {
      rows,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Get('status')
  async getStatus() {
    // Get the last run time for each job type
    const jobNames = ['turn_tick', 'daily_tick'];
    const statuses: Record<string, any> = {};

    for (const jobName of jobNames) {
      const lastRun = await this.prisma.jobLog.findFirst({
        where: { job_name: jobName },
        orderBy: { started_at: 'desc' },
      });
      statuses[jobName] = lastRun ?? null;
    }

    return {
      jobs: statuses,
      enabled: {
        turn_tick: !!this.config.get('ENABLE_TURN_TICK'),
        daily_tick: !!this.config.get('ENABLE_DAILY_TICK'),
        bot_scheduler: !!this.config.get('ENABLE_BOT_SCHEDULER'),
      },
    };
  }
}
