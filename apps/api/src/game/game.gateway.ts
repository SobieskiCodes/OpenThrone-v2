import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger, UseGuards, forwardRef, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PlayerStateChangedEvent, ChatMessageEvent } from './events';
import { ChatService } from '../chat/chat.service';

/**
 * WebSocket Gateway for real-time game updates
 *
 * Handles:
 * - Player state sync (gold, turns, level, units)
 * - Real-time chat (general, alliance, custom rooms)
 * - Activity feed broadcasts
 * - Multi-tab sync
 */
@WebSocketGateway({
  namespace: '/game',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server; // Initialized by decorator

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private jwtService: JwtService,
    @Inject(forwardRef(() => ChatService))
    private chatService: ChatService,
  ) {}

  // ─── Connection Management ───────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      // Authenticate via JWT in handshake
      const token = client.handshake.auth.token;
      if (!token) {
        this.logger.warn('Connection attempt without token');
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);

      // Store player data on socket
      client.data.playerId = payload.sub;
      client.data.displayName = payload.displayName || 'Unknown';
      client.data.isAdmin = payload.permissions?.includes('ADMINISTRATOR') || false;

      // Join player's private room (for personal state updates)
      client.join(`player:${payload.sub}`);

      // Auto-join General chat (both socket room and database)
      client.join('chat:general');
      await this.chatService.autoJoinGeneral(payload.sub).catch((err) => {
        this.logger.error(`Failed to auto-join general for ${payload.sub}:`, err);
      });

      this.logger.log(`Player ${payload.sub} (${client.data.displayName}) connected via WebSocket`);

      // Send connection confirmation
      client.emit('connected', {
        playerId: payload.sub,
        message: 'WebSocket connected successfully',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('WebSocket auth failed:', message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Player ${client.data.playerId} (${client.data.displayName}) disconnected`);
  }

  // ─── Player State Events ─────────────────────────────────────────────

  /**
   * Listens to player state change events and broadcasts to player's socket
   * PRIVATE: Only broadcast to the specific player, not to everyone
   */
  @OnEvent('player.state.changed')
  handleStateChange(event: PlayerStateChangedEvent) {
    if (!event.playerId) {
      this.logger.warn('PlayerStateChangedEvent missing playerId');
      return;
    }

    // Build delta payload (only include changed fields, convert BigInt to string)
    const delta: any = {};

    if (event.gold !== undefined) delta.gold = event.gold.toString();
    if (event.goldInBank !== undefined) delta.goldInBank = event.goldInBank.toString();
    if (event.attackTurns !== undefined) delta.attackTurns = event.attackTurns;
    if (event.level !== undefined) delta.level = event.level;
    if (event.experience !== undefined) delta.experience = event.experience.toString();
    if (event.totalUnits !== undefined) delta.totalUnits = event.totalUnits;
    if (event.unitsByType !== undefined) delta.unitsByType = event.unitsByType;
    if (event.availablePoints !== undefined) delta.availablePoints = event.availablePoints;
    if (event.buildings !== undefined) delta.buildings = event.buildings;
    if (event.availableUpgrades !== undefined) delta.availableUpgrades = event.availableUpgrades;
    if (event.unreadMail !== undefined) delta.unreadMail = event.unreadMail;

    // Broadcast ONLY to this player's private room (all their open tabs)
    this.server.to(`player:${event.playerId}`).emit('state:update', delta);

    this.logger.debug(`State update sent to player ${event.playerId}:`, Object.keys(delta));
  }

  // ─── Chat Events ─────────────────────────────────────────────────────

  /**
   * Player sends a chat message
   */
  @SubscribeMessage('chat:send')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; message: string },
  ) {
    try {
      const playerId = client.data.playerId;
      const displayName = client.data.displayName;

      if (!data.roomId || !data.message) {
        return { success: false, error: 'Missing roomId or message' };
      }

      // Validate message length
      if (data.message.length > 500) {
        return { success: false, error: 'Message too long (max 500 characters)' };
      }

      // TODO: Check if player has access to this room
      // TODO: Check if player is muted
      // TODO: Save message to database

      // Broadcast to everyone in the room
      this.server.to(`chat:${data.roomId}`).emit('chat:message', {
        roomId: data.roomId,
        sender: {
          id: playerId,
          displayName: displayName,
        },
        message: data.message,
        timestamp: new Date().toISOString(),
      });

      this.logger.debug(`Chat message from ${displayName} in room ${data.roomId}`);

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Chat message error:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Player joins a chat room
   */
  @SubscribeMessage('chat:join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    try {
      // TODO: Verify player has access to this room

      client.join(`chat:${data.roomId}`);

      this.logger.log(`Player ${client.data.displayName} joined room ${data.roomId}`);

      return { success: true, roomId: data.roomId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Join room error:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Player leaves a chat room
   */
  @SubscribeMessage('chat:leave')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    try {
      client.leave(`chat:${data.roomId}`);

      this.logger.log(`Player ${client.data.displayName} left room ${data.roomId}`);

      return { success: true, roomId: data.roomId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Leave room error:', message);
      return { success: false, error: message };
    }
  }

  // ─── Activity Feed Events ────────────────────────────────────────────
  // TODO: Add public activity broadcast handlers (player:level-up, combat.attack.completed, etc.)

  // ─── Helper Methods ──────────────────────────────────────────────────

  /**
   * Broadcast to all connected players (server-wide)
   */
  broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  /**
   * Broadcast to specific player (all their tabs)
   */
  broadcastToPlayer(playerId: string, event: string, data: any) {
    this.server.to(`player:${playerId}`).emit(event, data);
  }

  /**
   * Broadcast to chat room
   */
  broadcastToRoom(roomId: string, event: string, data: any) {
    this.server.to(`chat:${roomId}`).emit(event, data);
  }
}
