import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateProfileDto,
  AllocateBonusPointsDto,
  ChangePasswordDto,
} from '@openthrone/shared';
import {
  getLevelForXP,
  getXPToNextLevel,
  calculateFullStats,
  calculateFullDetailedBreakdown,
  calculateGoldPerTurnBreakdown,
  calculateCitizensPerDayBreakdown,
} from '@openthrone/game-logic';
import type { StatCalcInput } from '@openthrone/game-logic';
import * as argon2 from 'argon2';

@Injectable()
export class PlayerService {
  constructor(private readonly prisma: PrismaService) {}

  async searchPlayers(search: string) {
    const players = await this.prisma.player.findMany({
      where: {
        display_name: { contains: search },
      },
      select: {
        id: true,
        display_name: true,
        race: true,
        player_class: true,
      },
      take: 20,
    });

    return players;
  }

  async getFullProfile(playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        economy: true,
        units: true,
        items: true,
        battle_upgrades: true,
        structure_upgrades: true,
        fortification: true,
        bonus_points: true,
        stats: true,
        permission_grants: { select: { type: true } },
      },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const experience = player.stats?.experience ?? 0;
    const level = getLevelForXP(experience);
    const xpToNextLevel = getXPToNextLevel(experience);

    return {
      id: player.id,
      displayName: player.display_name,
      email: player.email,
      race: player.race,
      class: player.player_class,
      locale: player.locale,
      avatar: player.avatar,
      bio: player.bio,
      colorScheme: player.color_scheme,
      recruitLink: player.recruit_link,
      status: player.status,
      lastActive: player.last_active,
      createdAt: player.created_at,
      level,
      xpToNextLevel,
      economy: player.economy
        ? {
            gold: player.economy.gold.toString(),
            goldInBank: player.economy.gold_in_bank.toString(),
            attackTurns: player.economy.attack_turns,
            houseLevel: player.economy.house_level,
            economyLevel: player.economy.economy_level,
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
      structureUpgrades: player.structure_upgrades.map((su) => ({
        upgradeType: su.upgrade_type,
        level: su.level,
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
      stats: player.stats
        ? {
            experience: player.stats.experience,
            rank: player.stats.rank,
            offense: player.stats.offense,
            defense: player.stats.defense,
            spy: player.stats.spy,
            sentry: player.stats.sentry,
            level,
          }
        : null,
      permissions: player.permission_grants.map((p) => p.type),
    };
  }

  async getPublicProfile(playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        display_name: true,
        race: true,
        player_class: true,
        avatar: true,
        bio: true,
        status: true,
        last_active: true,
        created_at: true,
        stats: {
          select: {
            experience: true,
            rank: true,
            offense: true,
            defense: true,
            spy: true,
            sentry: true,
          },
        },
        fortification: {
          select: {
            fort_level: true,
          },
        },
        economy: {
          select: {
            house_level: true,
          },
        },
      },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const experience = player.stats?.experience ?? 0;
    const level = getLevelForXP(experience);

    return {
      id: player.id,
      displayName: player.display_name,
      race: player.race,
      class: player.player_class,
      avatar: player.avatar,
      bio: player.bio,
      status: player.status,
      lastActive: player.last_active,
      createdAt: player.created_at,
      stats: player.stats
        ? {
            experience: player.stats.experience,
            rank: player.stats.rank,
            offense: player.stats.offense,
            defense: player.stats.defense,
            spy: player.stats.spy,
            sentry: player.stats.sentry,
            level,
          }
        : null,
      fortification: player.fortification
        ? {
            fortLevel: player.fortification.fort_level,
          }
        : null,
      economy: player.economy
        ? {
            houseLevel: player.economy.house_level,
          }
        : null,
    };
  }

  async getStatBreakdown(playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        economy: true,
        units: true,
        items: true,
        battle_upgrades: true,
        structure_upgrades: true,
        fortification: true,
        bonus_points: true,
        stats: true,
      },
    });

    if (!player) throw new NotFoundException('Player not found');

    const fortLevel = player.fortification?.fort_level ?? 1;

    const statInput: StatCalcInput = {
      race: player.race,
      playerClass: player.player_class,
      fortLevel,
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
      bonusPoints: player.bonus_points.map((bp) => ({
        bonusType: bp.bonus_type,
        level: bp.level,
      })),
      structureUpgrades: player.structure_upgrades.map((su) => ({
        upgradeType: su.upgrade_type,
        level: su.level,
      })),
    };

    const stats = calculateFullStats(statInput);
    const detailed = calculateFullDetailedBreakdown(statInput);

    // Gold per turn breakdown
    const workers = player.units
      .filter((u) => u.unit_type === 'WORKER')
      .map((u) => ({ level: u.level, quantity: u.quantity }));
    const incomeBonus = player.bonus_points.find((bp) => bp.bonus_type === 'INCOME')?.level ?? 0;
    const goldPerTurn = calculateGoldPerTurnBreakdown(
      fortLevel,
      workers,
      incomeBonus,
    );

    // Citizens per day breakdown
    const houseLevel = player.economy?.house_level ?? 1;
    const recruitBonus = 0; // TODO: pull from recruiting bonus when implemented
    const citizensPerDay = calculateCitizensPerDayBreakdown(houseLevel, recruitBonus);

    // Also update PlayerStats with the newly calculated values
    await this.prisma.playerStats.upsert({
      where: { player_id: playerId },
      update: {
        offense: stats.offense.total,
        defense: stats.defense.total,
        spy: stats.spy.total,
        sentry: stats.sentry.total,
      },
      create: {
        player_id: playerId,
        offense: stats.offense.total,
        defense: stats.defense.total,
        spy: stats.spy.total,
        sentry: stats.sentry.total,
        experience: 0,
        rank: 0,
        killing_str: 1,
        defense_str: 1,
        spying_str: 1,
        sentry_str: 1,
      },
    });

    const experience = player.stats?.experience ?? 0;
    const level = getLevelForXP(experience);
    const totalSpent = player.bonus_points.reduce((sum, bp) => sum + bp.level, 0);

    return {
      ...stats,
      detailed,
      goldPerTurn,
      citizensPerDay,
      bonusPoints: player.bonus_points.map((bp) => ({
        bonusType: bp.bonus_type,
        level: bp.level,
      })),
      availablePoints: level - totalSpent,
    };
  }

  async updateProfile(playerId: string, dto: UpdateProfileDto) {
    const player = await this.prisma.player.update({
      where: { id: playerId },
      data: {
        bio: dto.bio,
        color_scheme: dto.colorScheme,
        locale: dto.locale,
        avatar: dto.avatar,
      },
    });

    return {
      id: player.id,
      displayName: player.display_name,
      bio: player.bio,
      colorScheme: player.color_scheme,
      locale: player.locale,
      avatar: player.avatar,
    };
  }

  async allocateBonusPoints(playerId: string, dto: AllocateBonusPointsDto) {
    const stats = await this.prisma.playerStats.findUnique({
      where: { player_id: playerId },
    });

    if (!stats) {
      throw new NotFoundException('Player stats not found');
    }

    const currentLevel = getLevelForXP(stats.experience);

    const bonusPoints = await this.prisma.playerBonusPoint.findMany({
      where: { player_id: playerId },
    });

    const totalSpent = bonusPoints.reduce((sum, bp) => sum + bp.level, 0);

    if (totalSpent >= currentLevel) {
      throw new BadRequestException('No bonus points available');
    }

    const bonusEntry = bonusPoints.find(
      (bp) => bp.bonus_type === dto.bonusType,
    );

    if (!bonusEntry) {
      throw new NotFoundException(
        `Bonus point entry for type ${dto.bonusType} not found`,
      );
    }

    await this.prisma.playerBonusPoint.update({
      where: { id: bonusEntry.id },
      data: { level: bonusEntry.level + 1 },
    });

    const updatedBonusPoints = await this.prisma.playerBonusPoint.findMany({
      where: { player_id: playerId },
    });

    return updatedBonusPoints.map((bp) => ({
      bonusType: bp.bonus_type,
      level: bp.level,
    }));
  }

  async changePassword(playerId: string, dto: ChangePasswordDto) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { password_hash: true },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const isValid = await argon2.verify(
      player.password_hash,
      dto.currentPassword,
    );

    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await argon2.hash(dto.newPassword);

    await this.prisma.player.update({
      where: { id: playerId },
      data: { password_hash: newHash },
    });

    return { message: 'Password changed successfully' };
  }
}
