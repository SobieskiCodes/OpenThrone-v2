import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { SocialService } from './social.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  addFriendSchema,
  respondToRequestSchema,
  AddFriendDto,
  RespondToRequestDto,
} from '@openthrone/shared';

@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get()
  async getRelationships(
    @CurrentPlayer() player: any,
    @Query('type') type?: string,
  ) {
    return this.socialService.getRelationships(player.id, type);
  }

  @Post('add')
  async addFriend(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(addFriendSchema)) body: AddFriendDto,
  ) {
    return this.socialService.addFriend(player.id, body);
  }

  @Post('respond')
  async respondToRequest(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(respondToRequestSchema)) body: RespondToRequestDto,
  ) {
    return this.socialService.respondToRequest(player.id, body);
  }

  @Delete(':id')
  async removeFriend(
    @CurrentPlayer() player: any,
    @Param('id') id: string,
  ) {
    return this.socialService.removeFriend(player.id, id);
  }
}
