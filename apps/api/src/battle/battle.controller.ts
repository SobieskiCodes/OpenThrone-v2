import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { BattleService } from './battle.service';
import { RankingsService } from './rankings.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  battlePlayersQuerySchema,
  battleRankingsQuerySchema,
  battleHistoryQuerySchema,
  detailedRankingsQuerySchema,
  attackSchema,
  spyMissionSchema,
  shareIntelSchema,
  BattlePlayersQueryDto,
  BattleRankingsQueryDto,
  BattleHistoryQueryDto,
  DetailedRankingsQueryDto,
  AttackDto,
  SpyMissionDto,
  ShareIntelDto,
} from '@openthrone/shared';
import type { RankingCategory, RankingPeriod } from './rankings.service';

@Controller('battle')
export class BattleController {
  constructor(
    private readonly battleService: BattleService,
    private readonly rankingsService: RankingsService,
  ) {}

  @Get('players')
  async getPlayers(
    @CurrentPlayer() player: any,
    @Query(new ZodValidationPipe(battlePlayersQuerySchema)) query: BattlePlayersQueryDto,
  ) {
    return this.battleService.getPlayers(player.id, query);
  }

  @Get('rankings/detailed')
  async getDetailedRankings(
    @CurrentPlayer() player: any,
    @Query(new ZodValidationPipe(detailedRankingsQuerySchema)) query: DetailedRankingsQueryDto,
  ) {
    return this.rankingsService.getRankings(
      query.category as RankingCategory,
      query.subType,
      query.period as RankingPeriod,
      query.page,
      query.limit,
    );
  }

  @Get('rankings/my-rank')
  async getMyRank(
    @CurrentPlayer() player: any,
    @Query(new ZodValidationPipe(detailedRankingsQuerySchema)) query: DetailedRankingsQueryDto,
  ) {
    return this.rankingsService.getMyRank(
      player.id,
      query.category as RankingCategory,
      query.subType,
      query.period as RankingPeriod,
    );
  }

  @Get('rankings')
  async getRankings(
    @CurrentPlayer() player: any,
    @Query(new ZodValidationPipe(battleRankingsQuerySchema)) query: BattleRankingsQueryDto,
  ) {
    return this.battleService.getRankings(query, player.id);
  }

  @Get('history')
  async getHistory(
    @CurrentPlayer() player: any,
    @Query(new ZodValidationPipe(battleHistoryQuerySchema)) query: BattleHistoryQueryDto,
  ) {
    return this.battleService.getHistory(player.id, query);
  }

  // Static intel routes MUST be before parameterized routes
  @Post('intel/share')
  async shareIntel(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(shareIntelSchema)) dto: ShareIntelDto,
  ) {
    return this.battleService.shareIntelWithAlliance(player.id, dto.attackLogId);
  }

  @Get('intel/alliance/:targetId')
  async getAllianceIntel(
    @CurrentPlayer() player: any,
    @Param('targetId') targetId: string,
  ) {
    return this.battleService.getAllianceIntelForTarget(player.id, targetId);
  }

  @Get('history/:id')
  async getHistoryDetail(
    @CurrentPlayer() player: any,
    @Param('id') id: string,
  ) {
    return this.battleService.getHistoryDetail(player.id, parseInt(id, 10));
  }

  @Post('attack/:defenderId')
  async attack(
    @CurrentPlayer() player: any,
    @Param('defenderId') defenderId: string,
    @Body(new ZodValidationPipe(attackSchema)) dto: AttackDto,
  ) {
    return this.battleService.executeAttack(player.id, defenderId, dto.turns);
  }

  @Post('spy/:defenderId')
  async spy(
    @CurrentPlayer() player: any,
    @Param('defenderId') defenderId: string,
    @Body(new ZodValidationPipe(spyMissionSchema)) dto: SpyMissionDto,
  ) {
    return this.battleService.executeSpyMission(player.id, defenderId, dto);
  }
}
