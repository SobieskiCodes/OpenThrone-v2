import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log('Chat WebSocket gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const playerId = payload.sub;
      if (!playerId) {
        client.disconnect();
        return;
      }

      // Attach player ID to socket data
      client.data.playerId = playerId;

      // Auto-join player to all their room channels
      const participations = await this.prisma.chatRoomParticipant.findMany({
        where: { user_id: playerId },
        select: { room_id: true },
      });

      for (const p of participations) {
        client.join(`room:${p.room_id}`);
      }

      this.logger.log(`Client ${client.id} (player: ${playerId}) connected, joined ${participations.length} rooms`);
    } catch {
      this.logger.warn(`Client ${client.id} auth failed`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() roomId: number,
    @ConnectedSocket() client: Socket,
  ) {
    const playerId = client.data.playerId;
    if (!playerId) return;

    try {
      await this.chatService.validateRoomAccess(playerId, roomId);
      client.join(`room:${roomId}`);
      return { event: 'joinedRoom', data: { roomId } };
    } catch {
      return { event: 'error', data: { message: 'Access denied' } };
    }
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() roomId: number,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`room:${roomId}`);
    return { event: 'leftRoom', data: { roomId } };
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { roomId: number; content: string; replyToId?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const playerId = client.data.playerId;
    if (!playerId) return;

    try {
      const message = await this.chatService.sendMessage(
        playerId,
        data.roomId,
        data.content,
        data.replyToId,
      );

      this.server.to(`room:${data.roomId}`).emit('newMessage', message);
      return { event: 'messageSent', data: { id: message.id } };
    } catch (err: any) {
      return { event: 'error', data: { message: err.message } };
    }
  }

  @SubscribeMessage('addReaction')
  async handleAddReaction(
    @MessageBody() data: { messageId: number; reaction: string },
    @ConnectedSocket() client: Socket,
  ) {
    const playerId = client.data.playerId;
    if (!playerId) return;

    try {
      await this.chatService.addReaction(playerId, data.messageId, data.reaction);

      // Find which room this message is in to broadcast
      const message = await this.prisma.chatMessage.findUnique({
        where: { id: data.messageId },
        select: { room_id: true },
      });
      if (message) {
        this.server.to(`room:${message.room_id}`).emit('reactionAdded', {
          messageId: data.messageId,
          playerId,
          reaction: data.reaction,
        });
      }

      return { event: 'reactionAdded', data: { messageId: data.messageId } };
    } catch (err: any) {
      return { event: 'error', data: { message: err.message } };
    }
  }

  @SubscribeMessage('removeReaction')
  async handleRemoveReaction(
    @MessageBody() data: { messageId: number; reaction: string },
    @ConnectedSocket() client: Socket,
  ) {
    const playerId = client.data.playerId;
    if (!playerId) return;

    try {
      await this.chatService.removeReaction(playerId, data.messageId, data.reaction);

      const message = await this.prisma.chatMessage.findUnique({
        where: { id: data.messageId },
        select: { room_id: true },
      });
      if (message) {
        this.server.to(`room:${message.room_id}`).emit('reactionRemoved', {
          messageId: data.messageId,
          playerId,
          reaction: data.reaction,
        });
      }

      return { event: 'reactionRemoved', data: { messageId: data.messageId } };
    } catch (err: any) {
      return { event: 'error', data: { message: err.message } };
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @MessageBody() messageIds: number[],
    @ConnectedSocket() client: Socket,
  ) {
    const playerId = client.data.playerId;
    if (!playerId) return;

    try {
      await this.chatService.markAsRead(playerId, messageIds);

      // Broadcast read receipts to the relevant rooms
      if (messageIds.length > 0) {
        const messages = await this.prisma.chatMessage.findMany({
          where: { id: { in: messageIds } },
          select: { room_id: true },
        });
        const roomIds = [...new Set(messages.map((m) => m.room_id))];
        for (const roomId of roomIds) {
          this.server.to(`room:${roomId}`).emit('messagesRead', {
            playerId,
            messageIds,
          });
        }
      }

      return { event: 'messagesRead', data: { count: messageIds.length } };
    } catch (err: any) {
      return { event: 'error', data: { message: err.message } };
    }
  }
}
