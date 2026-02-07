import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  async getRooms(@CurrentPlayer() player: any) {
    // TODO: Return list of chat rooms the player has access to
    return this.chatService.getRooms(player.id);
  }

  @Get('rooms/:id/messages')
  async getMessages(@CurrentPlayer() player: any, @Param('id') id: string) {
    // TODO: Return paginated messages for a chat room
    return this.chatService.getMessages(player.id, id);
  }

  @Post('rooms/:id/messages')
  async sendMessage(
    @CurrentPlayer() player: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    // TODO: Add Zod validation pipe for message DTO
    return this.chatService.sendMessage(player.id, id, body);
  }
}
