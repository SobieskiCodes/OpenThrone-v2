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

    // Default to player_id only — each participant already gets their own
    // activity entry from the listener, so OR-ing with target_id would pull
    // in the *other* player's entries (e.g. showing the defender's DEFEND_LOSS
    // on the attacker's "my" feed).
    const directionFilter =
      direction === 'outgoing'
        ? { player_id: playerId }
        : direction === 'incoming'
          ? { target_id: playerId }
          : { player_id: playerId };

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
      data: items.map((item) =>
        this.formatItem(item, { anonymizeUncaughtSpy: !isOwnFeed }),
      ),
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
      data: items.map((item) =>
        this.formatItem(item, { anonymizeUncaughtSpy: false }),
      ),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getServerFeed(query: ActivityFeedQueryDto) {
    const { page, limit, type } = query;

    // Exclude defender-perspective types on the server feed to avoid
    // duplicates (ATTACK_WIN already covers DEFEND_LOSS, etc.)
    const DEFENDER_TYPES = ['DEFEND_WIN', 'DEFEND_LOSS', 'SPY_DETECTED'];

    const where: any = {
      is_public: true,
      ...(type
        ? { activity_type: type }
        : { activity_type: { notIn: DEFENDER_TYPES } }),
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
      data: items.map((item) =>
        this.formatItem(item, { anonymizeUncaughtSpy: true }),
      ),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private formatItem(
    item: any,
    options?: { anonymizeUncaughtSpy?: boolean },
  ) {
    let metadata: Record<string, any> | null = null;
    if (item.metadata) {
      try {
        metadata = JSON.parse(item.metadata);
      } catch {
        /* ignore */
      }
    }

    const result = {
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

    // Hide spy identity for successful (uncaught) spy missions on public feeds
    if (
      options?.anonymizeUncaughtSpy &&
      item.activity_type === 'SPY_SUCCESS'
    ) {
      result.player = { id: null as any, displayName: 'someone' };
    }

    return result;
  }
}
