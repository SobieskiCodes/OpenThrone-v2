import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAllianceDto,
  UpdateAllianceDto,
  AllianceDepositDto,
} from '@openthrone/shared';
import {
  AllianceCreatedEvent,
  AllianceJoinedEvent,
  AllianceLeftEvent,
} from '@openthrone/events';

interface AlliancePermissions {
  canInvite: boolean;
  canKick: boolean;
  canManageRoles: boolean;
  canManageBank: boolean;
  canPostAnnouncements: boolean;
}

const DEFAULT_PERMISSIONS: AlliancePermissions = {
  canInvite: false,
  canKick: false,
  canManageRoles: false,
  canManageBank: false,
  canPostAnnouncements: false,
};

const LEADER_PERMISSIONS: AlliancePermissions = {
  canInvite: true,
  canKick: true,
  canManageRoles: true,
  canManageBank: true,
  canPostAnnouncements: true,
};

function parsePermissions(jsonStr: string | null): AlliancePermissions {
  if (!jsonStr) return { ...DEFAULT_PERMISSIONS };
  try {
    return { ...DEFAULT_PERMISSIONS, ...JSON.parse(jsonStr) };
  } catch {
    return { ...DEFAULT_PERMISSIONS };
  }
}

@Injectable()
export class AllianceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getAlliances() {
    const alliances = await this.prisma.alliance.findMany({
      include: {
        leader: {
          select: { id: true, display_name: true },
        },
        _count: { select: { memberships: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    return alliances.map((a) => ({
      id: a.id,
      name: a.name,
      motto: a.motto,
      isPublic: a.is_public,
      closedEnrollment: a.closed_enrollment,
      goldInBank: a.gold_in_bank?.toString() ?? '0',
      leader: a.leader,
      memberCount: a._count.memberships,
      createdAt: a.created_at,
    }));
  }

  async createAlliance(playerId: string, dto: CreateAllianceDto) {
    // Can only create 1 alliance (be leader of 1)
    const existingLeadership = await this.prisma.alliance.findFirst({
      where: { leader_id: playerId },
    });
    if (existingLeadership) {
      throw new BadRequestException('You can only create one alliance');
    }

    // Can be in up to 3 alliances total
    const membershipCount = await this.prisma.allianceMembership.count({
      where: { user_id: playerId },
    });
    if (membershipCount >= 3) {
      throw new BadRequestException('You can be in at most 3 alliances');
    }

    // Check name unique
    const existingName = await this.prisma.alliance.findFirst({
      where: { name: dto.name },
    });
    if (existingName) {
      throw new BadRequestException('Alliance name already taken');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Create the alliance
      const alliance = await tx.alliance.create({
        data: {
          name: dto.name,
          motto: dto.motto ?? null,
          is_public: dto.isPublic,
          leader_id: playerId,
        },
      });

      // Create Leader role with all permissions
      const leaderRole = await tx.allianceRole.create({
        data: {
          name: 'Leader',
          alliance_id: alliance.id,
          permissions: JSON.stringify(LEADER_PERMISSIONS),
        },
      });

      // Create Member role with no permissions
      await tx.allianceRole.create({
        data: {
          name: 'Member',
          alliance_id: alliance.id,
          permissions: JSON.stringify(DEFAULT_PERMISSIONS),
        },
      });

      // Add creator as member with Leader role
      await tx.allianceMembership.create({
        data: {
          alliance_id: alliance.id,
          user_id: playerId,
          role_id: leaderRole.id,
        },
      });

      return alliance;
    });

    this.eventEmitter.emit(
      'alliance.created',
      new AllianceCreatedEvent(result.id, playerId, result.name),
    );

    return {
      id: result.id,
      name: result.name,
      motto: result.motto,
    };
  }

  async getAlliance(id: string) {
    const allianceId = parseInt(id, 10);
    if (isNaN(allianceId)) {
      throw new BadRequestException('Invalid alliance ID');
    }

    const alliance = await this.prisma.alliance.findUnique({
      where: { id: allianceId },
      include: {
        leader: {
          select: { id: true, display_name: true },
        },
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                display_name: true,
                race: true,
                player_class: true,
                last_active: true,
              },
            },
            role: {
              select: { id: true, name: true, permissions: true },
            },
          },
        },
        roles: {
          select: { id: true, name: true, permissions: true },
        },
      },
    });

    if (!alliance) {
      throw new NotFoundException('Alliance not found');
    }

    return {
      id: alliance.id,
      name: alliance.name,
      motto: alliance.motto,
      isPublic: alliance.is_public,
      closedEnrollment: alliance.closed_enrollment,
      goldInBank: alliance.gold_in_bank?.toString() ?? '0',
      leader: alliance.leader,
      createdAt: alliance.created_at,
      members: alliance.memberships.map((m) => ({
        userId: m.user_id,
        player: m.user,
        role: {
          id: m.role.id,
          name: m.role.name,
          permissions: parsePermissions(m.role.permissions),
        },
        joinedAt: m.created_at,
      })),
      roles: alliance.roles.map((r) => ({
        id: r.id,
        name: r.name,
        permissions: parsePermissions(r.permissions),
      })),
    };
  }

  async getMyAlliances(playerId: string) {
    const memberships = await this.prisma.allianceMembership.findMany({
      where: { user_id: playerId },
    });

    if (memberships.length === 0) {
      return { alliances: [] };
    }

    const alliances = await Promise.all(
      memberships.map((m) => this.getAlliance(m.alliance_id.toString())),
    );
    return { alliances };
  }

  async joinAlliance(playerId: string, allianceId: string) {
    const id = parseInt(allianceId, 10);
    if (isNaN(id)) {
      throw new BadRequestException('Invalid alliance ID');
    }

    const alliance = await this.prisma.alliance.findUnique({
      where: { id },
    });

    if (!alliance) {
      throw new NotFoundException('Alliance not found');
    }

    if (alliance.closed_enrollment) {
      throw new BadRequestException('This alliance is not accepting new members');
    }

    // Can be in up to 3 alliances total
    const membershipCount = await this.prisma.allianceMembership.count({
      where: { user_id: playerId },
    });
    if (membershipCount >= 3) {
      throw new BadRequestException('You can be in at most 3 alliances');
    }

    // Check not already in THIS alliance
    const existingMembership = await this.prisma.allianceMembership.findFirst({
      where: { user_id: playerId, alliance_id: id },
    });
    if (existingMembership) {
      throw new BadRequestException('You are already in this alliance');
    }

    // Find the "Member" role
    const memberRole = await this.prisma.allianceRole.findFirst({
      where: { alliance_id: id, name: 'Member' },
    });

    if (!memberRole) {
      throw new BadRequestException('Alliance configuration error: no Member role');
    }

    await this.prisma.allianceMembership.create({
      data: {
        alliance_id: id,
        user_id: playerId,
        role_id: memberRole.id,
      },
    });

    this.eventEmitter.emit(
      'alliance.joined',
      new AllianceJoinedEvent(id, playerId),
    );

    return { message: 'Joined alliance' };
  }

  async leaveAlliance(playerId: string, allianceIdStr: string) {
    const allianceId = parseInt(allianceIdStr, 10);
    if (isNaN(allianceId)) {
      throw new BadRequestException('Invalid alliance ID');
    }

    const membership = await this.prisma.allianceMembership.findFirst({
      where: { user_id: playerId, alliance_id: allianceId },
      include: { alliance: true },
    });

    if (!membership) {
      throw new BadRequestException('You are not in this alliance');
    }

    const isLeader = membership.alliance.leader_id === playerId;

    if (isLeader) {
      // Check if there are other members
      const memberCount = await this.prisma.allianceMembership.count({
        where: { alliance_id: allianceId },
      });

      if (memberCount > 1) {
        throw new BadRequestException(
          'You must transfer leadership or kick all members before leaving',
        );
      }

      // Leader alone — delete the alliance and all related data
      await this.prisma.$transaction(async (tx) => {
        await tx.allianceMembership.deleteMany({
          where: { alliance_id: allianceId },
        });
        await tx.allianceRole.deleteMany({
          where: { alliance_id: allianceId },
        });
        await tx.alliance.delete({
          where: { id: allianceId },
        });
      });
    } else {
      await this.prisma.allianceMembership.delete({
        where: { id: membership.id },
      });
    }

    this.eventEmitter.emit(
      'alliance.left',
      new AllianceLeftEvent(allianceId, playerId),
    );

    return { message: isLeader ? 'Alliance disbanded' : 'Left alliance' };
  }

  async kickMember(playerId: string, allianceId: string, targetId: string) {
    const id = parseInt(allianceId, 10);
    if (isNaN(id)) {
      throw new BadRequestException('Invalid alliance ID');
    }

    // Get caller's membership + role
    const callerMembership = await this.prisma.allianceMembership.findFirst({
      where: { alliance_id: id, user_id: playerId },
      include: { role: true, alliance: true },
    });

    if (!callerMembership) {
      throw new ForbiddenException('You are not in this alliance');
    }

    const callerPerms = parsePermissions(callerMembership.role.permissions);
    const isLeader = callerMembership.alliance.leader_id === playerId;

    if (!isLeader && !callerPerms.canKick) {
      throw new ForbiddenException('You do not have permission to kick members');
    }

    // Can't kick the leader
    if (callerMembership.alliance.leader_id === targetId) {
      throw new BadRequestException('Cannot kick the alliance leader');
    }

    const targetMembership = await this.prisma.allianceMembership.findFirst({
      where: { alliance_id: id, user_id: targetId },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found in this alliance');
    }

    await this.prisma.allianceMembership.delete({
      where: { id: targetMembership.id },
    });

    return { message: 'Member kicked' };
  }

  async depositToTreasury(playerId: string, allianceId: string, dto: AllianceDepositDto) {
    const id = parseInt(allianceId, 10);
    if (isNaN(id)) {
      throw new BadRequestException('Invalid alliance ID');
    }

    const amount = BigInt(dto.amount);
    if (amount <= 0n) {
      throw new BadRequestException('Amount must be positive');
    }

    // Verify membership
    const membership = await this.prisma.allianceMembership.findFirst({
      where: { alliance_id: id, user_id: playerId },
    });
    if (!membership) {
      throw new ForbiddenException('You are not in this alliance');
    }

    await this.prisma.$transaction(async (tx) => {
      const economy = await tx.playerEconomy.findUnique({
        where: { player_id: playerId },
      });
      if (!economy || economy.gold < amount) {
        throw new BadRequestException('Insufficient gold');
      }

      await tx.playerEconomy.update({
        where: { player_id: playerId },
        data: { gold: { decrement: amount } },
      });

      await tx.alliance.update({
        where: { id },
        data: { gold_in_bank: { increment: amount } },
      });
    });

    return { message: `Deposited ${dto.amount} gold to alliance treasury` };
  }

  async updateAlliance(playerId: string, allianceId: string, dto: UpdateAllianceDto) {
    const id = parseInt(allianceId, 10);
    if (isNaN(id)) {
      throw new BadRequestException('Invalid alliance ID');
    }

    // Check caller has permission
    const membership = await this.prisma.allianceMembership.findFirst({
      where: { alliance_id: id, user_id: playerId },
      include: { role: true, alliance: true },
    });

    if (!membership) {
      throw new ForbiddenException('You are not in this alliance');
    }

    const isLeader = membership.alliance.leader_id === playerId;
    const perms = parsePermissions(membership.role.permissions);

    if (!isLeader && !perms.canManageRoles) {
      throw new ForbiddenException('You do not have permission to update this alliance');
    }

    const data: any = {};
    if (dto.motto !== undefined) data.motto = dto.motto;
    if (dto.isPublic !== undefined) data.is_public = dto.isPublic;
    if (dto.closedEnrollment !== undefined) data.closed_enrollment = dto.closedEnrollment;

    await this.prisma.alliance.update({
      where: { id },
      data,
    });

    return { message: 'Alliance updated' };
  }
}
