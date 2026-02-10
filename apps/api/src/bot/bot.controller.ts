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
  createBotSchema,
  updateBotSchema,
  CreateBotDto,
  UpdateBotDto,
} from '@openthrone/shared';
import { BotService } from './bot.service';
import { BotSchedulerService } from './bot-scheduler.service';

@Controller('admin/bots')
@UseGuards(RolesGuard)
@Roles(PermissionType.ADMINISTRATOR)
export class BotController {
  constructor(
    private readonly botService: BotService,
    private readonly botScheduler: BotSchedulerService,
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

  @Post()
  async createBot(
    @Body(new ZodValidationPipe(createBotSchema)) dto: CreateBotDto,
  ) {
    return this.botService.createBot(dto);
  }

  // ── Parameterized routes ──────────────────────────────────────────

  @Get(':id')
  async getBot(@Param('id', ParseIntPipe) id: number) {
    return this.botService.getBot(id);
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
