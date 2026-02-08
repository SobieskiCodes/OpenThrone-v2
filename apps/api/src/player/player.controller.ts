import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { PlayerService } from './player.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  updateProfileSchema,
  UpdateProfileDto,
  allocateBonusPointsSchema,
  AllocateBonusPointsDto,
  changePasswordSchema,
  ChangePasswordDto,
} from '@openthrone/shared';
import { Public } from '../common/decorators/public.decorator';

@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get('search')
  async searchPlayers(@Query('q') q: string) {
    return this.playerService.searchPlayers(q || '');
  }

  @Get('me')
  async getMe(@CurrentPlayer('id') playerId: string) {
    return this.playerService.getFullProfile(playerId);
  }

  @Get('me/stat-breakdown')
  async getStatBreakdown(@CurrentPlayer('id') playerId: string) {
    return this.playerService.getStatBreakdown(playerId);
  }

  @Get(':id')
  @Public()
  async getPublicProfile(
    @Param('id') id: string,
    @CurrentPlayer('id') requesterId?: string,
  ) {
    return this.playerService.getPublicProfile(id, requesterId);
  }

  @Patch('me')
  async updateProfile(
    @CurrentPlayer('id') playerId: string,
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileDto,
  ) {
    return this.playerService.updateProfile(playerId, dto);
  }

  @Post('me/bonus-points')
  async allocateBonusPoints(
    @CurrentPlayer('id') playerId: string,
    @Body(new ZodValidationPipe(allocateBonusPointsSchema)) dto: AllocateBonusPointsDto,
  ) {
    return this.playerService.allocateBonusPoints(playerId, dto);
  }

  @Post('me/change-password')
  async changePassword(
    @CurrentPlayer('id') playerId: string,
    @Body(new ZodValidationPipe(changePasswordSchema)) dto: ChangePasswordDto,
  ) {
    return this.playerService.changePassword(playerId, dto);
  }
}
