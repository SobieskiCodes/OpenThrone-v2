import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminUpdatePlayerDto,
  AdminAccountActionDto,
  AdminGrantPermissionDto,
  AccountStatus,
} from '@openthrone/shared';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlayers(
    page: number = 1,
    limit: number = 20,
    search?: string,
    status?: string,
    sort: string = 'created_at',
    order: string = 'desc',
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      // Build contains clause compatible with both SQLite and PostgreSQL
      const isPostgres = process.env.DATABASE_URL?.includes('postgresql');
      const containsClause: any = { contains: search };
      if (isPostgres) {
        containsClause.mode = 'insensitive';
      }

      where.OR = [
        { display_name: containsClause },
        { email: containsClause },
      ];
    }
    if (status) {
      where.status = status;
    }

    const orderBy: any = {};
    const validSorts = ['created_at', 'display_name', 'status', 'last_active'];
    orderBy[validSorts.includes(sort) ? sort : 'created_at'] =
      order === 'asc' ? 'asc' : 'desc';

    const [players, total] = await Promise.all([
      this.prisma.player.findMany({
        where,
        include: {
          economy: true,
          stats: true,
          permission_grants: true,
        },
        take: limit,
        skip,
        orderBy,
      }),
      this.prisma.player.count({ where }),
    ]);

    return {
      rows: players.map((p) => ({
        id: p.id,
        displayName: p.display_name,
        email: p.email,
        race: p.race,
        class: p.player_class,
        status: p.status,
        isBot: p.is_bot,
        gold: p.economy?.gold.toString() ?? '0',
        goldInBank: p.economy?.gold_in_bank.toString() ?? '0',
        attackTurns: p.economy?.attack_turns ?? 0,
        experience: (p.stats?.experience ?? BigInt(0)).toString(),
        rank: p.stats?.rank ?? 0,
        permissions: p.permission_grants.map((g) => g.type),
        lastActive: p.last_active,
        createdAt: p.created_at,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPlayer(id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: {
        economy: true,
        stats: true,
        units: true,
        items: true,
        battle_upgrades: true,
        fortification: true,
        bonus_points: true,
        permission_grants: true,
        status_history: {
          orderBy: { start_date: 'desc' },
          take: 10,
        },
      },
    });

    if (!player) throw new NotFoundException('Player not found');

    return {
      id: player.id,
      displayName: player.display_name,
      email: player.email,
      race: player.race,
      class: player.player_class,
      status: player.status,
      bio: player.bio,
      locale: player.locale,
      recruitLink: player.recruit_link,
      lastActive: player.last_active,
      createdAt: player.created_at,
      economy: player.economy
        ? {
            gold: player.economy.gold.toString(),
            goldInBank: player.economy.gold_in_bank.toString(),
            attackTurns: player.economy.attack_turns,
          }
        : null,
      stats: player.stats
        ? {
            experience: player.stats.experience.toString(),
            rank: player.stats.rank,
            offense: player.stats.offense,
            defense: player.stats.defense,
            spy: player.stats.spy,
            sentry: player.stats.sentry,
          }
        : null,
      units: player.units.map((u) => ({
        unitType: u.unit_type,
        level: u.level,
        quantity: u.quantity,
      })),
      items: player.items.map((i) => ({
        itemType: i.item_type,
        usage: i.usage,
        level: i.level,
        quantity: i.quantity,
      })),
      battleUpgrades: player.battle_upgrades.map((bu) => ({
        upgradeType: bu.upgrade_type,
        level: bu.level,
        quantity: bu.quantity,
      })),
      fortification: player.fortification
        ? {
            fortLevel: player.fortification.fort_level,
            hitpoints: player.fortification.hitpoints,
          }
        : null,
      bonusPoints: player.bonus_points.map((bp) => ({
        bonusType: bp.bonus_type,
        level: bp.level,
      })),
      permissions: player.permission_grants.map((g) => g.type),
      statusHistory: player.status_history.map((sh) => ({
        id: sh.id,
        status: sh.status,
        startDate: sh.start_date,
        endDate: sh.end_date,
        reason: sh.reason,
        adminId: sh.admin_id,
      })),
    };
  }

  async updatePlayer(id: string, dto: AdminUpdatePlayerDto, adminId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: { economy: true, stats: true },
    });
    if (!player) throw new NotFoundException('Player not found');

    await this.prisma.$transaction(async (tx) => {
      if (dto.gold !== undefined && player.economy) {
        await tx.playerEconomy.update({
          where: { player_id: id },
          data: { gold: BigInt(dto.gold) },
        });
      }

      if (dto.attackTurns !== undefined && player.economy) {
        await tx.playerEconomy.update({
          where: { player_id: id },
          data: { attack_turns: dto.attackTurns },
        });
      }

      if (player.stats && (dto.experience !== undefined || dto.offense !== undefined || dto.defense !== undefined || dto.spy !== undefined || dto.sentry !== undefined)) {
        const statsData: Record<string, number> = {};
        if (dto.experience !== undefined) statsData.experience = dto.experience;
        if (dto.offense !== undefined) statsData.offense = dto.offense;
        if (dto.defense !== undefined) statsData.defense = dto.defense;
        if (dto.spy !== undefined) statsData.spy = dto.spy;
        if (dto.sentry !== undefined) statsData.sentry = dto.sentry;
        await tx.playerStats.update({
          where: { player_id: id },
          data: statsData,
        });
      }

      if (dto.bonusPoints !== undefined) {
        for (const [bonusType, level] of Object.entries(dto.bonusPoints)) {
          await tx.playerBonusPoint.upsert({
            where: {
              player_id_bonus_type: {
                player_id: id,
                bonus_type: bonusType,
              },
            },
            update: { level },
            create: {
              player_id: id,
              bonus_type: bonusType,
              level,
            },
          });
        }
      }

      if (dto.status !== undefined) {
        // End current status history
        await tx.accountStatusHistory.updateMany({
          where: { user_id: id, end_date: null },
          data: { end_date: new Date() },
        });

        // Create new status history
        await tx.accountStatusHistory.create({
          data: {
            user_id: id,
            status: dto.status,
            admin_id: adminId,
          },
        });

        await tx.player.update({
          where: { id },
          data: { status: dto.status },
        });
      }
    });

    return this.getPlayer(id);
  }

  async accountAction(
    id: string,
    dto: AdminAccountActionDto,
    adminId: string,
  ) {
    const player = await this.prisma.player.findUnique({ where: { id } });
    if (!player) throw new NotFoundException('Player not found');

    const statusMap: Record<string, AccountStatus> = {
      BAN: AccountStatus.BANNED,
      SUSPEND: AccountStatus.SUSPENDED,
      CLOSE: AccountStatus.CLOSED,
      ACTIVATE: AccountStatus.ACTIVE,
      VACATION: AccountStatus.VACATION,
      TIMEOUT: AccountStatus.TIMEOUT,
    };

    const newStatus = statusMap[dto.action];
    if (!newStatus) throw new BadRequestException('Invalid action');

    let endDate: Date | null = null;
    if (dto.duration && ['BAN', 'SUSPEND', 'TIMEOUT', 'VACATION'].includes(dto.action)) {
      endDate = new Date(Date.now() + dto.duration * 24 * 60 * 60 * 1000);
    }

    await this.prisma.$transaction(async (tx) => {
      // End current status
      await tx.accountStatusHistory.updateMany({
        where: { user_id: id, end_date: null },
        data: { end_date: new Date() },
      });

      // Create new status
      await tx.accountStatusHistory.create({
        data: {
          user_id: id,
          status: newStatus,
          reason: dto.reason,
          admin_id: adminId,
          end_date: endDate,
        },
      });

      await tx.player.update({
        where: { id },
        data: { status: newStatus },
      });
    });

    return { success: true, newStatus };
  }

  async grantPermission(dto: AdminGrantPermissionDto) {
    const player = await this.prisma.player.findUnique({
      where: { id: dto.playerId },
    });
    if (!player) throw new NotFoundException('Player not found');

    // Check if already has this permission
    const existing = await this.prisma.permissionGrant.findFirst({
      where: { user_id: dto.playerId, type: dto.permissionType },
    });
    if (existing) throw new BadRequestException('Permission already granted');

    await this.prisma.permissionGrant.create({
      data: { user_id: dto.playerId, type: dto.permissionType },
    });

    return { success: true };
  }

  async revokePermission(playerId: string, type: string) {
    const result = await this.prisma.permissionGrant.deleteMany({
      where: { user_id: playerId, type },
    });
    if (result.count === 0) throw new NotFoundException('Permission not found');
    return { success: true };
  }

  async getServerStats() {
    const [
      totalPlayers,
      activePlayers,
      totalAlliances,
    ] = await Promise.all([
      this.prisma.player.count(),
      this.prisma.player.count({ where: { status: 'ACTIVE' } }),
      this.prisma.alliance.count(),
    ]);

    // Aggregate gold & units
    const economies = await this.prisma.playerEconomy.findMany({
      select: { gold: true, gold_in_bank: true },
    });
    let totalGold = BigInt(0);
    for (const e of economies) {
      totalGold += BigInt(e.gold) + BigInt(e.gold_in_bank);
    }

    const unitAgg = await this.prisma.playerUnit.aggregate({
      _sum: { quantity: true },
    });

    return {
      totalPlayers,
      activePlayers,
      totalAlliances,
      totalGold: totalGold.toString(),
      totalUnits: unitAgg._sum.quantity ?? 0,
    };
  }

  async resetDatabase(adminId: string) {
    // WARNING: This deletes ALL data and reseeds the database
    // Only admins can call this

    // Detect database type
    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgres = dbUrl.includes('postgresql') || dbUrl.includes('postgres');
    const isSQLite = dbUrl.includes('sqlite') || dbUrl.includes('file:');

    if (isPostgres) {
      // PostgreSQL: Use TRUNCATE CASCADE (fast and handles foreign keys)
      // Note: Prisma creates tables in snake_case
      await this.prisma.$executeRawUnsafe(`
        TRUNCATE TABLE
          activity_log, bot_action_logs, job_logs,
          mail_recipients, mail,
          chat_message_read_status, chat_message_reactions, chat_messages, chat_room_participants, chat_rooms,
          post_read_status, blog_posts,
          attack_log_acl, attack_log,
          alliance_intel,
          alliance_memberships, alliance_roles, alliances,
          social,
          recruit_history,
          bank_history,
          mercenary_daily_purchases,
          player_cumulative_stats, ranking_snapshots, player_stats,
          player_bonus_points, player_buildings, player_fortification,
          player_structure_upgrades, player_battle_upgrades,
          player_items, player_units,
          permission_grants, password_resets, account_status_history,
          player_economy,
          bot_configs,
          players
        RESTART IDENTITY CASCADE
      `);
    } else if (isSQLite) {
      // SQLite: Disable foreign keys, delete, re-enable
      await this.prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');

      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.activityLog.deleteMany();
          await tx.botActionLog.deleteMany();
          await tx.jobLog.deleteMany();
          await tx.mailRecipient.deleteMany();
          await tx.mail.deleteMany();
          await tx.chatMessageReadStatus.deleteMany();
          await tx.chatMessageReaction.deleteMany();
          await tx.chatMessage.deleteMany();
          await tx.chatRoomParticipant.deleteMany();
          await tx.chatRoom.deleteMany();
          await tx.postReadStatus.deleteMany();
          await tx.blogPost.deleteMany();
          await tx.attackLogAcl.deleteMany();
          await tx.attackLog.deleteMany();
          await tx.allianceIntel.deleteMany();
          await tx.allianceMembership.deleteMany();
          await tx.allianceRole.deleteMany();
          await tx.alliance.deleteMany();
          await tx.social.deleteMany();
          await tx.recruitHistory.deleteMany();
          await tx.bankHistory.deleteMany();
          await tx.mercenaryDailyPurchase.deleteMany();
          await tx.playerCumulativeStats.deleteMany();
          await tx.rankingSnapshot.deleteMany();
          await tx.playerStats.deleteMany();
          await tx.playerBonusPoint.deleteMany();
          await tx.playerBuilding.deleteMany();
          await tx.playerFortification.deleteMany();
          await tx.playerStructureUpgrade.deleteMany();
          await tx.playerBattleUpgrade.deleteMany();
          await tx.playerItem.deleteMany();
          await tx.playerUnit.deleteMany();
          await tx.permissionGrant.deleteMany();
          await tx.passwordReset.deleteMany();
          await tx.accountStatusHistory.deleteMany();
          await tx.playerEconomy.deleteMany();
          await tx.botConfig.deleteMany();
          await tx.player.deleteMany();
        });
      } finally {
        await this.prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
      }
    }

    return {
      success: true,
      message: 'Database reset complete! Run "pnpm db:seed" to reseed test data.',
    };
  }
}
