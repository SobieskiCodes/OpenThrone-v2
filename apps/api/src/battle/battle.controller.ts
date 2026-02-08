import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { BattleService } from './battle.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  battlePlayersQuerySchema,
  battleRankingsQuerySchema,
  battleHistoryQuerySchema,
  spyMissionSchema,
  BattlePlayersQueryDto,
  BattleRankingsQueryDto,
  BattleHistoryQueryDto,
  SpyMissionDto,
} from '@openthrone/shared';

@Controller('battle')
export class BattleController {
  constructor(private readonly battleService: BattleService) {}

  @Get('players')
  async getPlayers(
    @CurrentPlayer() player: any,
    @Query(new ZodValidationPipe(battlePlayersQuerySchema)) query: BattlePlayersQueryDto,
  ) {
    return this.battleService.getPlayers(player.id, query);
  }

  @Get('rankings')
  async getRankings(
    @Query(new ZodValidationPipe(battleRankingsQuerySchema)) query: BattleRankingsQueryDto,
  ) {
    return this.battleService.getRankings(query);
  }

  @Get('history')
  async getHistory(
    @CurrentPlayer() player: any,
    @Query(new ZodValidationPipe(battleHistoryQuerySchema)) query: BattleHistoryQueryDto,
  ) {
    return this.battleService.getHistory(player.id, query);
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
  ) {
    return this.battleService.executeAttack(player.id, defenderId);
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
