import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddFriendDto,
  RespondToRequestDto,
} from '@openthrone/shared';
import {
  FriendRequestSentEvent,
  FriendRequestAcceptedEvent,
} from '@openthrone/events';

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getRelationships(playerId: string, type?: string) {
    const where: any = {
      OR: [{ player_id: playerId }, { friend_id: playerId }],
    };

    if (type === 'REQUESTS') {
      // Incoming pending requests only
      where.status = 'REQUESTED';
      where.OR = [{ friend_id: playerId }];
    } else if (type === 'FRIEND' || type === 'ENEMY') {
      where.relationship_type = type;
      where.status = 'ACCEPTED';
    }

    const records = await this.prisma.social.findMany({
      where,
      include: {
        player: {
          select: {
            id: true,
            display_name: true,
            race: true,
            player_class: true,
            last_active: true,
          },
        },
        friend: {
          select: {
            id: true,
            display_name: true,
            race: true,
            player_class: true,
            last_active: true,
          },
        },
      },
      orderBy: { request_date: 'desc' },
    });

    // Normalize so the "other" person is always returned
    return records.map((r) => {
      const otherPlayer =
        r.player_id === playerId ? r.friend : r.player;
      return {
        id: r.id,
        relationshipType: r.relationship_type,
        status: r.status,
        requestDate: r.request_date,
        acceptanceDate: r.acceptance_date,
        otherPlayer,
      };
    });
  }

  async addFriend(playerId: string, dto: AddFriendDto) {
    if (playerId === dto.friendId) {
      throw new BadRequestException('Cannot add yourself');
    }

    // Validate target exists
    const target = await this.prisma.player.findUnique({
      where: { id: dto.friendId },
    });
    if (!target) {
      throw new NotFoundException('Player not found');
    }

    // Check for existing active relationship (either direction)
    const existing = await this.prisma.social.findFirst({
      where: {
        OR: [
          { player_id: playerId, friend_id: dto.friendId },
          { player_id: dto.friendId, friend_id: playerId },
        ],
        status: { in: ['REQUESTED', 'ACCEPTED'] },
      },
    });
    if (existing) {
      throw new BadRequestException('Relationship already exists');
    }

    // ENEMY relationships auto-accept; FRIEND requires request flow
    const isEnemy = dto.relationshipType === 'ENEMY';

    const record = await this.prisma.social.create({
      data: {
        player_id: playerId,
        friend_id: dto.friendId,
        relationship_type: dto.relationshipType,
        status: isEnemy ? 'ACCEPTED' : 'REQUESTED',
        acceptance_date: isEnemy ? new Date() : undefined,
      },
    });

    this.eventEmitter.emit(
      'social.friendRequestSent',
      new FriendRequestSentEvent(
        playerId,
        dto.friendId,
        dto.relationshipType,
      ),
    );

    return record;
  }

  async respondToRequest(playerId: string, dto: RespondToRequestDto) {
    const request = await this.prisma.social.findUnique({
      where: { id: dto.requestId },
    });

    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.friend_id !== playerId) {
      throw new BadRequestException('You can only respond to requests sent to you');
    }

    if (request.status !== 'REQUESTED') {
      throw new BadRequestException('Request is no longer pending');
    }

    if (dto.accept) {
      await this.prisma.social.update({
        where: { id: dto.requestId },
        data: {
          status: 'ACCEPTED',
          acceptance_date: new Date(),
        },
      });

      this.eventEmitter.emit(
        'social.friendRequestAccepted',
        new FriendRequestAcceptedEvent(request.player_id, playerId),
      );

      return { message: 'Request accepted' };
    } else {
      await this.prisma.social.delete({
        where: { id: dto.requestId },
      });

      return { message: 'Request declined' };
    }
  }

  async removeFriend(playerId: string, id: string) {
    const recordId = parseInt(id, 10);
    if (isNaN(recordId)) {
      throw new BadRequestException('Invalid ID');
    }

    const record = await this.prisma.social.findUnique({
      where: { id: recordId },
    });

    if (!record) {
      throw new NotFoundException('Relationship not found');
    }

    // Ensure the player is part of this relationship
    if (record.player_id !== playerId && record.friend_id !== playerId) {
      throw new BadRequestException('Not your relationship');
    }

    await this.prisma.social.delete({
      where: { id: recordId },
    });

    return { message: 'Relationship removed' };
  }
}
