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
  computeArmoryResaleValue,
  computeBattleUpgradeResaleValue,
  canUpgradeBuilding,
  getBuildingLevel,
} from '@openthrone/game-logic';
import { BuildingType } from '@openthrone/shared';
import type { StatCalcInput } from '@openthrone/game-logic';
import * as argon2 from 'argon2';

@Injectable()
export class PlayerService {
  constructor(private readonly prisma: PrismaService) {}

  async searchPlayers(search: string) {
    // Build where clause compatible with both SQLite and PostgreSQL
    // PostgreSQL supports mode: 'insensitive', SQLite doesn't
    const isPostgres = process.env.DATABASE_URL?.includes('postgresql');
    const containsClause: any = { contains: search };
    if (isPostgres) {
      containsClause.mode = 'insensitive';
    }

    const where: any = {
      display_name: containsClause,
    };

    const players = await this.prisma.player.findMany({
      where,
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
        fortification: true,
        bonus_points: true,
        stats: true,
        buildings: true,
        permission_grants: { select: { type: true } },
        alliance_membership: {
          select: {
            alliance: { select: { id: true, name: true } },
            role: { select: { name: true } },
          },
        },
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
      alliances: player.alliance_membership.map((m) => ({
        id: m.alliance.id,
        name: m.alliance.name,
        role: m.role.name,
      })),
      availablePoints: level - player.bonus_points.reduce((sum, bp) => sum + bp.level, 0),
      availableUpgrades: this.countAvailableUpgrades(player, level),
    };
  }

  private countAvailableUpgrades(
    player: {
      economy: { gold: bigint } | null;
      fortification: { fort_level: number } | null;
      buildings: { building_type: string; level: number }[];
    },
    playerLevel: number,
  ): number {
    const gold = BigInt(player.economy?.gold ?? 0);
    const fortLevel = player.fortification?.fort_level ?? 1;

    let count = 0;

    // Count buildings that can be upgraded (player level met, regardless of gold)
    for (const type of Object.values(BuildingType)) {
      const current = player.buildings.find((b) => b.building_type === type);
      const currentLevel = current?.level ?? 0;
      const result = canUpgradeBuilding(type, currentLevel, playerLevel, gold);
      // Count if upgradeable (either can afford or just level-gated but level is met)
      // We want to show "available" when requirements are met even if gold is short
      const nextLevel = currentLevel + 1;
      const nextDef = getBuildingLevel(type, nextLevel);
      if (nextDef && playerLevel >= nextDef.playerLevelRequirement) {
        count++;
      }
    }

    return count;
  }

  async getPublicProfile(playerId: string, requesterId?: string) {
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
        is_bot: true,
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
            gold: true,
            gold_in_bank: true,
          },
        },
        units: {
          select: {
            quantity: true,
          },
        },
        alliance_membership: {
          select: {
            alliance: { select: { id: true, name: true } },
            role: { select: { name: true } },
          },
        },
      },
    });

    if (!player) {
      throw new NotFoundException('Player not found');
    }

    const experience = player.stats?.experience ?? 0;
    const level = getLevelForXP(experience);
    const isOwnProfile = requesterId === playerId;
    const population = player.units.reduce((sum, u) => sum + u.quantity, 0);

    // Gold visibility: requester can see target's gold if their spy >= target sentry * 1.1
    let goldVisible = isOwnProfile;
    if (!isOwnProfile && requesterId && player.stats) {
      const requesterStats = await this.prisma.playerStats.findUnique({
        where: { player_id: requesterId },
        select: { spy: true },
      });
      if (requesterStats && requesterStats.spy >= player.stats.sentry * 1.1) {
        goldVisible = true;
      }
    }

    // Look up alliance intel if viewing another player's profile
    let allianceIntel: {
      spiedByName: string;
      spiedAt: Date;
      revealPercent: number;
      intelData: any;
    } | null = null;

    // Look up requester's personal last successful intel on this target
    let personalLastSpy: {
      spiedAt: Date | null;
      revealPercent: number;
      intelData: any;
    } | null = null;

    if (!isOwnProfile && requesterId) {
      const [membership, lastIntelLog] = await Promise.all([
        this.prisma.allianceMembership.findFirst({
          where: { user_id: requesterId },
          select: { alliance_id: true },
        }),
        this.prisma.attackLog.findFirst({
          where: {
            attacker_id: requesterId,
            defender_id: playerId,
            type: 'intel',
            winner: requesterId,
          },
          orderBy: { timestamp: 'desc' },
        }),
      ]);

      if (membership) {
        const latestIntel = await this.prisma.allianceIntel.findFirst({
          where: {
            alliance_id: membership.alliance_id,
            target_id: playerId,
          },
          orderBy: { created_at: 'desc' },
          include: {
            spied_by: { select: { display_name: true } },
          },
        });

        if (latestIntel) {
          let parsedIntel: any = {};
          try {
            parsedIntel = JSON.parse(latestIntel.intel_data);
          } catch { /* ignore */ }

          allianceIntel = {
            spiedByName: latestIntel.spied_by.display_name,
            spiedAt: latestIntel.created_at,
            revealPercent: latestIntel.reveal_percent,
            intelData: parsedIntel,
          };
        }
      }

      if (lastIntelLog) {
        let parsedStats: any = {};
        try { parsedStats = JSON.parse(lastIntelLog.stats); } catch { /* ignore */ }

        personalLastSpy = {
          spiedAt: lastIntelLog.timestamp,
          revealPercent: parsedStats.revealPercent ?? 0,
          intelData: parsedStats.intelData ?? {},
        };
      }
    }

    // Compute per-stat rank positions for this player
    const playerOffense = player.stats?.offense ?? 0;
    const playerDefense = player.stats?.defense ?? 0;
    const playerGold = Number(player.economy?.gold ?? 0);
    const playerBank = Number(player.economy?.gold_in_bank ?? 0);
    const playerNetWorth = playerGold + playerBank;

    const [offenseRank, defenseRank, netWorthCount] = await Promise.all([
      this.prisma.playerStats.count({
        where: { offense: { gt: playerOffense }, player: { status: 'ACTIVE' } },
      }),
      this.prisma.playerStats.count({
        where: { defense: { gt: playerDefense }, player: { status: 'ACTIVE' } },
      }),
      // Net worth rank: count players with higher gold + bank
      this.prisma.player.count({
        where: {
          status: 'ACTIVE',
          id: { not: playerId },
          economy: {
            // Rough net worth comparison (gold + bank only, armory excluded for perf)
            gold: { gt: BigInt(Math.max(0, playerNetWorth)) },
          },
        },
      }),
    ]);

    return {
      id: player.id,
      displayName: player.display_name,
      race: player.race,
      class: player.player_class,
      avatar: player.avatar,
      bio: player.bio,
      status: player.status,
      isBot: player.is_bot,
      lastActive: player.last_active,
      createdAt: player.created_at,
      stats: player.stats
        ? isOwnProfile
          ? {
              experience: player.stats.experience,
              rank: player.stats.rank,
              offense: player.stats.offense,
              defense: player.stats.defense,
              spy: player.stats.spy,
              sentry: player.stats.sentry,
              level,
            }
          : {
              experience: player.stats.experience,
              rank: player.stats.rank,
              level,
            }
        : null,
      population,
      gold: goldVisible && player.economy ? player.economy.gold.toString() : null,
      fortification: player.fortification
        ? {
            fortLevel: player.fortification.fort_level,
          }
        : null,
      ranks: {
        overall: player.stats?.rank ?? 0,
        offense: offenseRank + 1,
        defense: defenseRank + 1,
        netWorth: netWorthCount + 1,
      },
      alliances: player.alliance_membership.map((m) => ({
        id: m.alliance.id,
        name: m.alliance.name,
        role: m.role.name,
      })),
      allianceIntel,
      personalLastSpy,
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
        fortification: true,
        bonus_points: true,
        stats: true,
        buildings: true,
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
    };

    const stats = calculateFullStats(statInput);
    const detailed = calculateFullDetailedBreakdown(statInput);

    // Gold per turn breakdown
    const workers = player.units
      .filter((u) => u.unit_type === 'WORKER')
      .map((u) => ({ level: u.level, quantity: u.quantity }));
    const incomeBonus = player.bonus_points.find((bp) => bp.bonus_type === 'INCOME')?.level ?? 0;

    const mineRow = (player.buildings ?? []).find((b) => b.building_type === 'MINE');
    const mineLevel = mineRow?.level ?? 0;
    const mineDef = getBuildingLevel(BuildingType.MINE, mineLevel);
    const mineBonusPercent = mineDef?.incomeBonusPercent ?? 0;

    const goldPerTurn = calculateGoldPerTurnBreakdown(
      workers,
      mineBonusPercent,
      incomeBonus,
    );

    // Citizens per day breakdown
    const housingRow = (player.buildings ?? []).find((b) => b.building_type === 'HOUSING');
    const housingLevel = housingRow?.level ?? 0;
    const recruitBonus = player.bonus_points.find((bp) => bp.bonus_type === 'RECRUITING')?.level ?? 0;
    const citizensPerDay = calculateCitizensPerDayBreakdown(housingLevel, recruitBonus);

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

    // Compute per-category rank positions
    const myOffense = stats.offense.total;
    const myDefense = stats.defense.total;
    const mySpy = stats.spy.total;
    const mySentry = stats.sentry.total;
    const overallRank = player.stats?.rank ?? 0;

    // Compute net worth for this player (at 75% resale value)
    const myGold = Number(player.economy?.gold ?? 0);
    const myBank = Number(player.economy?.gold_in_bank ?? 0);
    const myArmoryResale = computeArmoryResaleValue(
      player.items.map((i) => ({
        itemType: i.item_type,
        usage: i.usage,
        level: i.level,
        quantity: i.quantity,
      })),
    );
    const myBattleUpgradeResale = computeBattleUpgradeResaleValue(
      player.battle_upgrades.map((bu) => ({
        upgradeType: bu.upgrade_type,
        level: bu.level,
        quantity: bu.quantity,
      })),
    );
    const myNetWorth = myGold + myBank + myArmoryResale + myBattleUpgradeResale;

    // Compute net worth for all active players to get rank position
    const allPlayers = await this.prisma.player.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        economy: { select: { gold: true, gold_in_bank: true } },
        items: { select: { item_type: true, usage: true, level: true, quantity: true } },
        battle_upgrades: { select: { upgrade_type: true, level: true, quantity: true } },
      },
    });

    let netWorthRank = 1;
    for (const p of allPlayers) {
      if (p.id === playerId) continue;
      const g = Number(p.economy?.gold ?? 0);
      const b = Number(p.economy?.gold_in_bank ?? 0);
      const aResale = computeArmoryResaleValue(
        p.items.map((i) => ({
          itemType: i.item_type,
          usage: i.usage,
          level: i.level,
          quantity: i.quantity,
        })),
      );
      const buResale = computeBattleUpgradeResaleValue(
        p.battle_upgrades.map((bu) => ({
          upgradeType: bu.upgrade_type,
          level: bu.level,
          quantity: bu.quantity,
        })),
      );
      if (g + b + aResale + buResale > myNetWorth) netWorthRank++;
    }

    const [offenseRank, defenseRank, spyRank, sentryRank] = await Promise.all([
      this.prisma.playerStats.count({
        where: { offense: { gt: myOffense }, player: { status: 'ACTIVE' } },
      }),
      this.prisma.playerStats.count({
        where: { defense: { gt: myDefense }, player: { status: 'ACTIVE' } },
      }),
      this.prisma.playerStats.count({
        where: { spy: { gt: mySpy }, player: { status: 'ACTIVE' } },
      }),
      this.prisma.playerStats.count({
        where: { sentry: { gt: mySentry }, player: { status: 'ACTIVE' } },
      }),
    ]);

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
      ranks: {
        overall: overallRank,
        offense: offenseRank + 1,
        defense: defenseRank + 1,
        spy: spyRank + 1,
        sentry: sentryRank + 1,
        netWorth: netWorthRank,
      },
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
