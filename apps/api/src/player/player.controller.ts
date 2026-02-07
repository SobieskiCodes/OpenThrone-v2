import { Controller, Get, Patch, Post, Param, Body } from '@nestjs/common';
import { PlayerService } from './player.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';

@Controller('player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get('me')
  async getMe(@CurrentPlayer() player: any) {
    // TODO: Return full player profile for the authenticated user
    return this.playerService.getPlayer(player.id);
  }

  @Get(':id')
  async getPlayer(@Param('id') id: string) {
    // TODO: Return public player profile
    return this.playerService.getPlayer(id);
  }

  @Patch('me')
  async updateMe(@CurrentPlayer() player: any, @Body() body: any) {
    // TODO: Add Zod validation pipe for update DTO
    return this.playerService.updatePlayer(player.id, body);
  }

  @Post('me/bonus-points')
  async claimBonusPoints(@CurrentPlayer() player: any) {
    // TODO: Implement bonus points claim logic
    return this.playerService.claimBonusPoints(player.id);
  }
}
