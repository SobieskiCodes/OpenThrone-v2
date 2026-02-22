import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ShopService } from '../shop/shop.service';
import {
  CreateChatRoomDto,
  SendMessageDto,
  AddParticipantsDto,
  AddReactionDto,
} from '@openthrone/shared';
import { MessageSentEvent, ReactionAddedEvent } from '@openthrone/events';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly shopService: ShopService,
  ) {}

  async getRooms(playerId: string) {
    const participations = await this.prisma.chatRoomParticipant.findMany({
      where: { user_id: playerId },
      include: {
        room: {
          include: {
            participants: {
              include: {
                user: {
                  select: { id: true, display_name: true },
                },
              },
            },
            messages: {
              orderBy: { sent_at: 'desc' },
              take: 1,
              include: {
                sender: {
                  select: { id: true, display_name: true },
                },
              },
            },
          },
        },
      },
    });

    const rooms = await Promise.all(
      participations.map(async (p) => {
        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            room_id: p.room_id,
            sent_at: { gt: p.joined_at },
            NOT: {
              read_status: {
                some: { user_id: playerId },
              },
            },
          },
        });

        const lastMessage = p.room.messages[0] ?? null;
        const otherParticipants = p.room.participants
          .filter((pp) => pp.user_id !== playerId)
          .map((pp) => ({ id: pp.user.id, displayName: pp.user.display_name }));

        // For DMs (2 people, no name), show the other person's name
        const roomName =
          p.room.name ??
          (otherParticipants.length === 1 && otherParticipants[0]
            ? `DM with ${otherParticipants[0].displayName}`
            : `Group (${p.room.participants.length})`);

        return {
          id: p.room.id,
          name: roomName,
          isPrivate: p.room.is_private,
          role: p.role,
          participants: p.room.participants.map((pp) => ({
            id: pp.user.id,
            displayName: pp.user.display_name,
            role: pp.role,
          })),
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                sender: {
                  id: lastMessage.sender.id,
                  displayName: lastMessage.sender.display_name,
                },
                sentAt: lastMessage.sent_at,
              }
            : null,
          unreadCount,
          updatedAt: p.room.updated_at,
        };
      }),
    );

    return rooms.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  async getMessages(
    playerId: string,
    roomId: number,
    limit = 50,
    beforeMessageId?: number,
  ) {
    await this.validateRoomAccess(playerId, roomId);

    const where: any = { room_id: roomId };
    if (beforeMessageId) {
      where.id = { lt: beforeMessageId };
    }

    const messages = await this.prisma.chatMessage.findMany({
      where,
      include: {
        sender: {
          select: { id: true, display_name: true },
        },
        reply_to: {
          include: {
            sender: {
              select: { id: true, display_name: true },
            },
          },
        },
        reactions: {
          include: {
            user: {
              select: { id: true, display_name: true },
            },
          },
        },
        read_status: {
          select: { user_id: true, read_at: true },
        },
      },
      orderBy: { sent_at: 'desc' },
      take: limit,
    });

    return messages.reverse().map((m) => ({
      id: m.id,
      content: m.content,
      messageType: m.message_type,
      sender: { id: m.sender.id, displayName: m.sender.display_name },
      senderColor: m.sender_color,
      senderIcon: m.sender_icon,
      replyTo: m.reply_to
        ? {
            id: m.reply_to.id,
            content: m.reply_to.content,
            sender: {
              id: m.reply_to.sender.id,
              displayName: m.reply_to.sender.display_name,
            },
          }
        : null,
      reactions: m.reactions.map((r) => ({
        reaction: r.reaction,
        user: { id: r.user.id, displayName: r.user.display_name },
      })),
      readBy: m.read_status.map((rs) => rs.user_id),
      sentAt: m.sent_at,
    }));
  }

  async createRoom(playerId: string, dto: CreateChatRoomDto) {
    // DM deduplication: if no name and 1 participant, check existing
    if (!dto.name && dto.participantIds.length === 1) {
      const otherId = dto.participantIds[0]!;
      const existing = await this.prisma.chatRoom.findFirst({
        where: {
          name: null,
          participants: {
            every: {
              user_id: { in: [playerId, otherId] },
            },
          },
        },
      });

      if (existing) {
        const participantCount = await this.prisma.chatRoomParticipant.count({
          where: { room_id: existing.id },
        });
        if (participantCount === 2) {
          return { id: existing.id, name: null, existing: true };
        }
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const room = await tx.chatRoom.create({
        data: {
          name: dto.name ?? null,
          is_private: dto.isPrivate,
          created_by_id: playerId,
        },
      });

      // Add creator as ADMIN
      await tx.chatRoomParticipant.create({
        data: {
          room_id: room.id,
          user_id: playerId,
          role: 'ADMIN',
        },
      });

      // Add other participants as MEMBER
      for (const pid of dto.participantIds.filter((p) => p !== playerId)) {
        await tx.chatRoomParticipant.create({
          data: {
            room_id: room.id,
            user_id: pid,
            role: 'MEMBER',
          },
        });
      }

      return room;
    });

    return { id: result.id, name: result.name, existing: false };
  }

  async addParticipants(playerId: string, roomId: number, dto: AddParticipantsDto) {
    const participant = await this.prisma.chatRoomParticipant.findUnique({
      where: { room_id_user_id: { room_id: roomId, user_id: playerId } },
    });

    if (!participant) {
      throw new ForbiddenException('You are not in this room');
    }
    if (participant.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can add participants');
    }

    for (const pid of dto.participantIds) {
      try {
        await this.prisma.chatRoomParticipant.create({
          data: {
            room_id: roomId,
            user_id: pid,
            role: 'MEMBER',
          },
        });
      } catch {
        // Already a participant, skip
      }
    }

    return { message: 'Participants added' };
  }

  async sendMessage(
    playerId: string,
    roomId: number,
    content: string,
    replyToId?: number,
  ) {
    const participant = await this.prisma.chatRoomParticipant.findUnique({
      where: { room_id_user_id: { room_id: roomId, user_id: playerId } },
    });

    if (!participant) {
      throw new ForbiddenException('You are not in this room');
    }
    if (!participant.can_write) {
      throw new ForbiddenException('You do not have write access');
    }

    // Get player's equipped cosmetics
    const cosmetics = await this.shopService.getEquippedCosmetics(playerId);

    const result = await this.prisma.$transaction(async (tx) => {
      const message = await tx.chatMessage.create({
        data: {
          room_id: roomId,
          sender_id: playerId,
          content,
          reply_to_id: replyToId ?? null,
          sender_color: cosmetics.nameColor,
          sender_icon: cosmetics.icon,
        },
        include: {
          sender: {
            select: { id: true, display_name: true },
          },
          reply_to: {
            include: {
              sender: { select: { id: true, display_name: true } },
            },
          },
        },
      });

      await tx.chatRoom.update({
        where: { id: roomId },
        data: { updated_at: new Date() },
      });

      return message;
    });

    this.eventEmitter.emit(
      'chat.messageSent',
      new MessageSentEvent(roomId, playerId, result.id),
    );

    return {
      id: result.id,
      content: result.content,
      messageType: result.message_type,
      sender: { id: result.sender.id, displayName: result.sender.display_name },
      replyTo: result.reply_to
        ? {
            id: result.reply_to.id,
            content: result.reply_to.content,
            sender: {
              id: result.reply_to.sender.id,
              displayName: result.reply_to.sender.display_name,
            },
          }
        : null,
      reactions: [],
      readBy: [],
      sentAt: result.sent_at,
    };
  }

  async addReaction(playerId: string, messageId: number, reaction: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.validateRoomAccess(playerId, message.room_id);

    await this.prisma.chatMessageReaction.upsert({
      where: {
        message_id_user_id_reaction: {
          message_id: messageId,
          user_id: playerId,
          reaction,
        },
      },
      create: {
        message_id: messageId,
        user_id: playerId,
        reaction,
      },
      update: {},
    });

    this.eventEmitter.emit(
      'chat.reactionAdded',
      new ReactionAddedEvent(messageId, playerId, reaction),
    );

    return { message: 'Reaction added' };
  }

  async removeReaction(playerId: string, messageId: number, reaction: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.validateRoomAccess(playerId, message.room_id);

    await this.prisma.chatMessageReaction.deleteMany({
      where: {
        message_id: messageId,
        user_id: playerId,
        reaction,
      },
    });

    return { message: 'Reaction removed' };
  }

  async markAsRead(playerId: string, messageIds: number[]) {
    for (const messageId of messageIds) {
      await this.prisma.chatMessageReadStatus.upsert({
        where: {
          message_id_user_id: {
            message_id: messageId,
            user_id: playerId,
          },
        },
        create: {
          message_id: messageId,
          user_id: playerId,
        },
        update: {},
      });
    }

    return { message: `Marked ${messageIds.length} messages as read` };
  }

  async validateRoomAccess(playerId: string, roomId: number) {
    const participant = await this.prisma.chatRoomParticipant.findUnique({
      where: { room_id_user_id: { room_id: roomId, user_id: playerId } },
    });

    if (!participant) {
      throw new ForbiddenException('You do not have access to this room');
    }

    return participant;
  }

  // ─── General Room (System-wide chat) ─────────────────────────────────────

  /**
   * Create or get the general system room
   * This room is for all players and system announcements
   */
  async ensureGeneralRoom() {
    const existing = await this.prisma.chatRoom.findFirst({
      where: { name: 'general', is_private: false },
    });

    if (existing) {
      return existing;
    }

    // Get first admin user (or create with system ID)
    const systemUser = await this.prisma.player.findFirst({
      where: {
        permission_grants: {
          some: { type: 'ADMINISTRATOR' },
        },
      },
    });

    const creatorId = systemUser?.id || 'system';

    return await this.prisma.chatRoom.create({
      data: {
        name: 'general',
        created_by_id: creatorId,
        is_private: false,
        participants: {
          create: {
            user_id: creatorId,
            role: 'ADMIN',
          },
        },
      },
    });
  }

  /**
   * Auto-join a player to the general room
   * Called when socket connects
   */
  async autoJoinGeneral(playerId: string) {
    const generalRoom = await this.ensureGeneralRoom();

    // Check if already a participant
    const existing = await this.prisma.chatRoomParticipant.findUnique({
      where: {
        room_id_user_id: {
          room_id: generalRoom.id,
          user_id: playerId,
        },
      },
    });

    if (existing) {
      return generalRoom;
    }

    // Add as participant
    await this.prisma.chatRoomParticipant.create({
      data: {
        room_id: generalRoom.id,
        user_id: playerId,
        role: 'MEMBER',
      },
    });

    return generalRoom;
  }

  /**
   * Send a system message to the general room
   * Used for turn ticks, server announcements, etc.
   */
  async sendSystemMessage(content: string, messageType: 'SYSTEM' | 'GAME_EVENT' = 'SYSTEM') {
    const generalRoom = await this.ensureGeneralRoom();

    const message = await this.prisma.chatMessage.create({
      data: {
        room_id: generalRoom.id,
        sender_id: generalRoom.created_by_id,
        content,
        message_type: messageType,
      },
      include: {
        sender: {
          select: { id: true, display_name: true },
        },
      },
    });

    // Emit event for WebSocket broadcast
    this.eventEmitter.emit(
      'chat.messageSent',
      new MessageSentEvent(generalRoom.id, generalRoom.created_by_id, message.id),
    );

    return message;
  }
}
