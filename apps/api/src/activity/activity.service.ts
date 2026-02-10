import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ActivityFeedQueryDto } from '@openthrone/shared';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    playerId: string,
    activityType: string,
    opts?: {
      targetId?: string;
      referenceId?: number;
      metadata?: Record<string, any>;
      isPublic?: boolean;
    },
  ) {
    await this.prisma.activityLog.create({
      data: {
        player_id: playerId,
        activity_type: activityType,
        target_id: opts?.targetId,
        reference_id: opts?.referenceId,
        metadata: opts?.metadata ? JSON.stringify(opts.metadata) : null,
        is_public: opts?.isPublic ?? true,
      },
    });
  }

  async getPlayerFeed(
    playerId: string,
    query: ActivityFeedQueryDto,
    requesterId?: string,
  ) {
    const { page, limit, type, direction } = query;
    const isOwnFeed = requesterId === playerId;

    const directionFilter =
      direction === 'outgoing'
        ? { player_id: playerId }
        : direction === 'incoming'
          ? { target_id: playerId }
          : { OR: [{ player_id: playerId }, { target_id: playerId }] };

    const where: any = {
      ...directionFilter,
      ...(type ? { activity_type: type } : {}),
      ...(!isOwnFeed ? { is_public: true } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: {
          player: { select: { id: true, display_name: true } },
          target: { select: { id: true, display_name: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      data: items.map((item) => this.formatItem(item)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getAllianceFeed(allianceId: number, query: ActivityFeedQueryDto) {
    const { page, limit, type } = query;

    // Get all member IDs for this alliance
    const members = await this.prisma.allianceMembership.findMany({
      where: { alliance_id: allianceId },
      select: { user_id: true },
    });
    const memberIds = members.map((m) => m.user_id);

    if (memberIds.length === 0) {
      return {
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const where: any = {
      player_id: { in: memberIds },
      is_public: true,
      ...(type ? { activity_type: type } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: {
          player: { select: { id: true, display_name: true } },
          target: { select: { id: true, display_name: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      data: items.map((item) => this.formatItem(item)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getServerFeed(query: ActivityFeedQueryDto) {
    const { page, limit, type } = query;

    const where: any = {
      is_public: true,
      ...(type ? { activity_type: type } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: {
          player: { select: { id: true, display_name: true } },
          target: { select: { id: true, display_name: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      data: items.map((item) => this.formatItem(item)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private formatItem(item: any) {
    let metadata: Record<string, any> | null = null;
    if (item.metadata) {
      try {
        metadata = JSON.parse(item.metadata);
      } catch {
        /* ignore */
      }
    }

    return {
      id: item.id,
      activityType: item.activity_type,
      player: {
        id: item.player.id,
        displayName: item.player.display_name,
      },
      target: item.target
        ? {
            id: item.target.id,
            displayName: item.target.display_name,
          }
        : null,
      referenceId: item.reference_id,
      metadata,
      isPublic: item.is_public,
      createdAt: item.created_at,
    };
  }
}
