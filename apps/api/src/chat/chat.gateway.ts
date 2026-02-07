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
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  afterInit() {
    // TODO: Initialize WebSocket gateway
    this.logger.log('Chat WebSocket gateway initialized');
  }

  handleConnection(client: Socket) {
    // TODO: Authenticate WebSocket connection
    // - Validate JWT token from handshake
    // - Join player to their rooms
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // TODO: Clean up on disconnect
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(@MessageBody() roomId: string, @ConnectedSocket() client: Socket) {
    // TODO: Implement room joining logic
    // - Validate player has access to the room
    // - Join socket to room
    client.join(roomId);
    return { event: 'joinedRoom', data: { roomId } };
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(@MessageBody() roomId: string, @ConnectedSocket() client: Socket) {
    // TODO: Implement room leaving logic
    client.leave(roomId);
    return { event: 'leftRoom', data: { roomId } };
  }

  @SubscribeMessage('message')
  handleMessage(@MessageBody() data: { roomId: string; content: string }, @ConnectedSocket() client: Socket) {
    // TODO: Implement real-time message handling
    // - Validate and save message
    // - Broadcast to room
    this.server.to(data.roomId).emit('newMessage', {
      roomId: data.roomId,
      content: data.content,
      senderId: client.id,
      timestamp: new Date().toISOString(),
    });
    return { event: 'messageSent', data: { roomId: data.roomId } };
  }
}
