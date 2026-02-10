import {
  Controller,
  Get,
  Param,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { ActivityService } from './activity.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { activityFeedQuerySchema } from '@openthrone/shared';
import type { ActivityFeedQueryDto } from '@openthrone/shared';
import { PrismaService } from '../prisma/prisma.service';

@Controller('activity')
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  async getMyFeed(
    @CurrentPlayer('id') playerId: string,
    @Query(new ZodValidationPipe(activityFeedQuerySchema)) query: ActivityFeedQueryDto,
  ) {
    return this.activityService.getPlayerFeed(playerId, query, playerId);
  }

  @Get('player/:id')
  async getPlayerFeed(
    @CurrentPlayer('id') requesterId: string,
    @Param('id') playerId: string,
    @Query(new ZodValidationPipe(activityFeedQuerySchema)) query: ActivityFeedQueryDto,
  ) {
    return this.activityService.getPlayerFeed(playerId, query, requesterId);
  }

  @Get('alliance/:id')
  async getAllianceFeed(
    @CurrentPlayer('id') playerId: string,
    @Param('id') allianceId: string,
    @Query(new ZodValidationPipe(activityFeedQuerySchema)) query: ActivityFeedQueryDto,
  ) {
    // Check membership
    const membership = await this.prisma.allianceMembership.findFirst({
      where: { user_id: playerId, alliance_id: Number(allianceId) },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this alliance');
    }
    return this.activityService.getAllianceFeed(Number(allianceId), query);
  }

  @Get('server')
  async getServerFeed(
    @Query(new ZodValidationPipe(activityFeedQuerySchema)) query: ActivityFeedQueryDto,
  ) {
    return this.activityService.getServerFeed(query);
  }
}
