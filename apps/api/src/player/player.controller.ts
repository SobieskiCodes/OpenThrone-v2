import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UsePipes,
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

  @Get('me')
  async getMe(@CurrentPlayer('id') playerId: string) {
    return this.playerService.getFullProfile(playerId);
  }

  @Get(':id')
  @Public()
  async getPublicProfile(@Param('id') id: string) {
    return this.playerService.getPublicProfile(id);
  }

  @Patch('me')
  @UsePipes(new ZodValidationPipe(updateProfileSchema))
  async updateProfile(
    @CurrentPlayer('id') playerId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.playerService.updateProfile(playerId, dto);
  }

  @Post('me/bonus-points')
  @UsePipes(new ZodValidationPipe(allocateBonusPointsSchema))
  async allocateBonusPoints(
    @CurrentPlayer('id') playerId: string,
    @Body() dto: AllocateBonusPointsDto,
  ) {
    return this.playerService.allocateBonusPoints(playerId, dto);
  }

  @Post('me/change-password')
  @UsePipes(new ZodValidationPipe(changePasswordSchema))
  async changePassword(
    @CurrentPlayer('id') playerId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.playerService.changePassword(playerId, dto);
  }
}
