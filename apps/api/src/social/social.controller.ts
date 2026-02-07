import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { SocialService } from './social.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';

@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get()
  async getFriends(@CurrentPlayer() player: any) {
    // TODO: Return friend list for the authenticated player
    return this.socialService.getFriends(player.id);
  }

  @Post('add')
  async addFriend(@CurrentPlayer() player: any, @Body() body: any) {
    // TODO: Add Zod validation pipe for add friend DTO
    return this.socialService.addFriend(player.id, body);
  }

  @Post('respond')
  async respondToRequest(@CurrentPlayer() player: any, @Body() body: any) {
    // TODO: Add Zod validation pipe for respond DTO
    return this.socialService.respondToRequest(player.id, body);
  }

  @Delete(':id')
  async removeFriend(@CurrentPlayer() player: any, @Param('id') id: string) {
    // TODO: Remove friend relationship
    return this.socialService.removeFriend(player.id, id);
  }
}
