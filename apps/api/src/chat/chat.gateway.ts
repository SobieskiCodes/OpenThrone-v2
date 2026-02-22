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
import { OnEvent } from '@nestjs/event-emitter';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessageSentEvent } from '@openthrone/events';

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

      // Ensure player is in general room (database + auto-join)
      try {
        const generalRoom = await this.chatService.autoJoinGeneral(playerId);
        client.join(`room:${generalRoom.id}`);
      } catch (err) {
        this.logger.error(`Failed to auto-join general room for ${playerId}:`, err);
      }

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

      // Don't broadcast here - the event listener handles it
      // This prevents double messages
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

  /**
   * Listen to MessageSentEvent and broadcast to room
   * Handles both player messages and system messages
   */
  @OnEvent('chat.messageSent')
  async handleMessageSentEvent(event: MessageSentEvent) {
    try {
      // Fetch the full message details
      const message = await this.prisma.chatMessage.findUnique({
        where: { id: event.messageId },
        include: {
          sender: {
            select: { id: true, display_name: true },
          },
          reply_to: {
            include: {
              sender: { select: { id: true, display_name: true } },
            },
          },
          reactions: {
            include: {
              user: {
                select: { id: true, display_name: true },
              },
            },
          },
        },
      });

      if (!message) {
        this.logger.warn(`Message ${event.messageId} not found for broadcast`);
        return;
      }

      // Format message for broadcast
      const formattedMessage = {
        id: message.id,
        content: message.content,
        messageType: message.message_type,
        sender: {
          id: message.sender.id,
          displayName: message.sender.display_name,
        },
        senderColor: message.sender_color,
        senderIcon: message.sender_icon,
        replyTo: message.reply_to
          ? {
              id: message.reply_to.id,
              content: message.reply_to.content,
              sender: {
                id: message.reply_to.sender.id,
                displayName: message.reply_to.sender.display_name,
              },
            }
          : null,
        reactions: message.reactions.map((r) => ({
          reaction: r.reaction,
          user: { id: r.user.id, displayName: r.user.display_name },
        })),
        sentAt: message.sent_at,
      };

      // Broadcast to all clients in this room
      this.server.to(`room:${event.roomId}`).emit('newMessage', formattedMessage);

      this.logger.debug(`Broadcasted message ${event.messageId} to room ${event.roomId}`);
    } catch (err) {
      this.logger.error(`Failed to broadcast message ${event.messageId}:`, err);
    }
  }
}
