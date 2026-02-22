import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CurrentPlayer } from '../common/decorators/current-player.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  createChatRoomSchema,
  CreateChatRoomDto,
  sendMessageSchema,
  SendMessageDto,
  addParticipantsSchema,
  AddParticipantsDto,
  addReactionSchema,
  AddReactionDto,
  markMessagesAsReadSchema,
  MarkMessagesAsReadDto,
} from '@openthrone/shared';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Static routes FIRST

  @Get('general')
  async getGeneralRoom(@CurrentPlayer() player: any) {
    const room = await this.chatService.ensureGeneralRoom();
    await this.chatService.autoJoinGeneral(player.id);
    return { id: room.id, name: room.name };
  }

  @Get('general/messages')
  async getGeneralMessages(
    @CurrentPlayer() player: any,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const room = await this.chatService.ensureGeneralRoom();
    return this.chatService.getMessages(
      player.id,
      room.id,
      limit ? parseInt(limit, 10) : 50,
      before ? parseInt(before, 10) : undefined,
    );
  }

  @Get('rooms')
  async getRooms(@CurrentPlayer() player: any) {
    return this.chatService.getRooms(player.id);
  }

  @Post('rooms')
  async createRoom(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(createChatRoomSchema)) body: CreateChatRoomDto,
  ) {
    return this.chatService.createRoom(player.id, body);
  }

  @Post('messages/reactions')
  async addReaction(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(addReactionSchema)) body: AddReactionDto,
  ) {
    return this.chatService.addReaction(player.id, body.messageId, body.reaction);
  }

  @Patch('messages/read')
  async markAsRead(
    @CurrentPlayer() player: any,
    @Body(new ZodValidationPipe(markMessagesAsReadSchema)) body: MarkMessagesAsReadDto,
  ) {
    return this.chatService.markAsRead(player.id, body.messageIds);
  }

  // Parameterized routes AFTER

  @Get('rooms/:id/messages')
  async getMessages(
    @CurrentPlayer() player: any,
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.chatService.getMessages(
      player.id,
      id,
      limit ? parseInt(limit, 10) : 50,
      before ? parseInt(before, 10) : undefined,
    );
  }

  @Post('rooms/:id/messages')
  async sendMessage(
    @CurrentPlayer() player: any,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageDto,
  ) {
    return this.chatService.sendMessage(
      player.id,
      id,
      body.content,
      body.replyToMessageId,
    );
  }

  @Post('rooms/:id/participants')
  async addParticipants(
    @CurrentPlayer() player: any,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(addParticipantsSchema)) body: AddParticipantsDto,
  ) {
    return this.chatService.addParticipants(player.id, id, body);
  }
}
