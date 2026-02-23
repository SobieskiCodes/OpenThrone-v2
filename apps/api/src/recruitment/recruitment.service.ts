import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerRecruitedEvent, AutoRecruitEvent } from '@openthrone/events';
import { PlayerStateChangedEvent } from '../game/events';
import {
  RECRUIT_LINK_CITIZENS_BONUS,
  RECRUIT_LINK_IP_COOLDOWN_HOURS,
  RECRUIT_LINK_MAX_PER_DAY,
  AUTO_RECRUIT_POOL_CITIZENS,
  calculateRecruitLinkBonus,
  calculateAutoRecruitCitizens,
  getBuildingLevel,
} from '@openthrone/game-logic';
import { UnitType, BonusType, BuildingType } from '@openthrone/shared';
import { buildPlayerSnapshot } from '../common/helpers/player-snapshot.helper';

@Injectable()
export class RecruitmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  /**
   * Get recruitment status for the authenticated player.
   */
  async getRecruitmentStatus(playerId: string) {
    const [player, economy, bonusPoints, recentRecruits, housingBuilding] = await Promise.all([
      this.prisma.player.findUnique({
        where: { id: playerId },
        select: { recruit_link: true, display_name: true },
      }),
      this.prisma.playerEconomy.findUnique({ where: { player_id: playerId } }),
      this.prisma.playerBonusPoint.findMany({ where: { player_id: playerId } }),
      this.prisma.recruitHistory.findMany({
        where: { to_user: playerId },
        orderBy: { timestamp: 'desc' },
        take: 20,
      }),
      this.prisma.playerBuilding.findFirst({
        where: { player_id: playerId, building_type: BuildingType.HOUSING },
      }),
    ]);

    if (!player || !economy) {
      throw new BadRequestException('Player data not found');
    }

    const recruitingBonus = bonusPoints.find(
      (bp) => bp.bonus_type === BonusType.RECRUITING,
    );
    const recruitingBonusLevel = recruitingBonus?.level ?? 0;

    const housingLevel = housingBuilding?.level ?? 0;
    const housingDef = getBuildingLevel(BuildingType.HOUSING, housingLevel);
    const citizensDaily = housingDef?.citizensPerDay ?? 1; // base 1 citizen/day
    const autoRecruitCitizens = calculateAutoRecruitCitizens(
      citizensDaily,
      recruitingBonusLevel,
    );

    const linkBonus = calculateRecruitLinkBonus(
      RECRUIT_LINK_CITIZENS_BONUS,
      recruitingBonusLevel,
    );

    // Count today's recruits
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRecruits = await this.prisma.recruitHistory.count({
      where: {
        to_user: playerId,
        timestamp: { gte: todayStart },
      },
    });

    // Check auto-recruit availability
    const todayStartUTC = new Date();
    todayStartUTC.setUTCHours(0, 0, 0, 0);
    const canAutoRecruit = !economy.last_auto_recruit ||
      new Date(economy.last_auto_recruit) < todayStartUTC;

    // Count today's auto-recruit pool (players who clicked today)
    const poolCount = await this.prisma.playerEconomy.count({
      where: { last_auto_recruit: { gte: todayStartUTC } },
    });

    return {
      recruitLink: player.recruit_link,
      recruitingBonusLevel,
      citizensPerRecruit: linkBonus,
      citizensPerAutoRecruit: AUTO_RECRUIT_POOL_CITIZENS,
      housingLevel,
      citizensDaily,
      todayRecruits,
      maxRecruitsPerDay: RECRUIT_LINK_MAX_PER_DAY,
      canAutoRecruit,
      autoRecruitPoolCount: poolCount,
      history: recentRecruits.map((r) => ({
        id: r.id,
        fromUser: r.from_user,
        timestamp: r.timestamp?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Public: Look up a recruit link and return the referrer's display name.
   */
  async getRecruitLinkInfo(link: string) {
    const player = await this.prisma.player.findUnique({
      where: { recruit_link: link },
      select: { id: true, display_name: true },
    });

    if (!player) {
      throw new NotFoundException('Invalid recruitment link');
    }

    return {
      referrerName: player.display_name,
    };
  }

  /**
   * Public: Claim a recruit link. Awards citizens to the referrer.
   * Includes IP-based rate limiting and optional Turnstile captcha.
   */
  async claimRecruitLink(
    link: string,
    ipAddress: string,
    captchaToken?: string,
  ) {
    // Verify captcha if enabled
    await this.verifyCaptcha(captchaToken);

    const referrer = await this.prisma.player.findUnique({
      where: { recruit_link: link },
      select: { id: true, display_name: true },
    });

    if (!referrer) {
      throw new NotFoundException('Invalid recruitment link');
    }

    // Check IP cooldown
    const cooldownDate = new Date();
    cooldownDate.setHours(
      cooldownDate.getHours() - RECRUIT_LINK_IP_COOLDOWN_HOURS,
    );

    const recentFromIp = await this.prisma.recruitHistory.findFirst({
      where: {
        to_user: referrer.id,
        ip_addr: ipAddress,
        timestamp: { gte: cooldownDate },
      },
    });

    if (recentFromIp) {
      throw new BadRequestException(
        'This IP has already claimed this link recently. Please try again later.',
      );
    }

    // Check daily limit for this referrer
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRecruits = await this.prisma.recruitHistory.count({
      where: {
        to_user: referrer.id,
        timestamp: { gte: todayStart },
      },
    });

    if (todayRecruits >= RECRUIT_LINK_MAX_PER_DAY) {
      throw new BadRequestException(
        'This player has reached their daily recruitment limit.',
      );
    }

    // Get referrer's recruiting bonus
    const recruitingBonus = await this.prisma.playerBonusPoint.findFirst({
      where: {
        player_id: referrer.id,
        bonus_type: BonusType.RECRUITING,
      },
    });
    const recruitingBonusLevel = recruitingBonus?.level ?? 0;
    const citizensAwarded = calculateRecruitLinkBonus(
      RECRUIT_LINK_CITIZENS_BONUS,
      recruitingBonusLevel,
    );

    // Award citizens to referrer and record history
    await this.prisma.$transaction(async (tx) => {
      // Add citizens
      await tx.playerUnit.upsert({
        where: {
          player_id_unit_type_level: {
            player_id: referrer.id,
            unit_type: UnitType.CITIZEN,
            level: 1,
          },
        },
        update: { quantity: { increment: citizensAwarded } },
        create: {
          player_id: referrer.id,
          unit_type: UnitType.CITIZEN,
          level: 1,
          quantity: citizensAwarded,
        },
      });

      // Record history
      await tx.recruitHistory.create({
        data: {
          from_user: null,
          to_user: referrer.id,
          ip_addr: ipAddress,
          timestamp: new Date(),
        },
      });
    });

    this.eventEmitter.emit(
      'player.recruited',
      new PlayerRecruitedEvent(referrer.id, null, ipAddress, citizensAwarded),
    );

    // Note: claimRecruitLink is a public endpoint (no auth), so no playerState needed
    // The referrer's cache will update on their next page load
    return {
      message: `You helped ${referrer.display_name} recruit ${citizensAwarded} citizens!`,
      citizensAwarded,
    };
  }

  /**
   * Trigger auto-recruit: award flat citizens from the daily pool (once per day).
   * Picks a random other player from today's pool and "recruits" them too.
   */
  async autoRecruit(playerId: string) {
    const economy = await this.prisma.playerEconomy.findUnique({
      where: { player_id: playerId },
    });

    if (!economy) {
      throw new BadRequestException('Player economy not found');
    }

    // Check daily limit (resets at midnight UTC)
    const todayStartUTC = new Date();
    todayStartUTC.setUTCHours(0, 0, 0, 0);

    if (economy.last_auto_recruit && new Date(economy.last_auto_recruit) >= todayStartUTC) {
      throw new BadRequestException('You have already auto-recruited today. Resets at midnight UTC.');
    }

    const citizensGained = AUTO_RECRUIT_POOL_CITIZENS;

    // Pick a random other player from today's pool to "recruit" (award them 1 citizen)
    const poolPlayers = await this.prisma.playerEconomy.findMany({
      where: {
        last_auto_recruit: { gte: todayStartUTC },
        player_id: { not: playerId },
      },
      select: { player_id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      // Award citizens to the clicking player
      await tx.playerUnit.upsert({
        where: {
          player_id_unit_type_level: {
            player_id: playerId,
            unit_type: UnitType.CITIZEN,
            level: 1,
          },
        },
        update: { quantity: { increment: citizensGained } },
        create: {
          player_id: playerId,
          unit_type: UnitType.CITIZEN,
          level: 1,
          quantity: citizensGained,
        },
      });

      // Mark as recruited today
      await tx.playerEconomy.update({
        where: { player_id: playerId },
        data: { last_auto_recruit: new Date() },
      });

      // If there's a pool, recruit a random player (they get 1 citizen)
      if (poolPlayers.length > 0) {
        const randomIdx = Math.floor(Math.random() * poolPlayers.length);
        const recruitedPlayerId = poolPlayers[randomIdx]!.player_id;
        await tx.playerUnit.upsert({
          where: {
            player_id_unit_type_level: {
              player_id: recruitedPlayerId,
              unit_type: UnitType.CITIZEN,
              level: 1,
            },
          },
          update: { quantity: { increment: 1 } },
          create: {
            player_id: recruitedPlayerId,
            unit_type: UnitType.CITIZEN,
            level: 1,
            quantity: 1,
          },
        });
      }
    });

    this.eventEmitter.emit(
      'recruitment.auto',
      new AutoRecruitEvent(playerId, citizensGained, economy.house_level || 1),
    );

    // Emit WebSocket event for real-time state sync
    const autoRecruitUnits = await this.prisma.playerUnit.findMany({
      where: { player_id: playerId },
    });

    const autoRecruitUnitsByType: Record<string, number> = {};
    let autoRecruitTotalUnits = 0;
    for (const u of autoRecruitUnits) {
      autoRecruitUnitsByType[u.unit_type] = (autoRecruitUnitsByType[u.unit_type] || 0) + u.quantity;
      autoRecruitTotalUnits += u.quantity;
    }

    this.eventEmitter.emit(
      'player.state.changed',
      new PlayerStateChangedEvent({
        playerId,
        totalUnits: autoRecruitTotalUnits,
        unitsByType: autoRecruitUnitsByType,
      }),
    );

    const playerState = await buildPlayerSnapshot(this.prisma, playerId, {
      includeUnits: true, // Units changed
    });

    return {
      citizensGained,
      poolSize: poolPlayers.length + 1,
      message: `Auto-recruit awarded ${citizensGained} citizens!`,
      playerState,
    };
  }

  /**
   * Verify Cloudflare Turnstile captcha token.
   * Skipped when ENABLE_CAPTCHA is not "true".
   */
  private async verifyCaptcha(token?: string): Promise<void> {
    const captchaEnabled = this.config.get('ENABLE_CAPTCHA', 'false') === 'true';

    if (!captchaEnabled) {
      return; // Skip in dev / when disabled
    }

    if (!token) {
      throw new BadRequestException('Captcha token is required');
    }

    const secret = this.config.get('TURNSTILE_SECRET');
    if (!secret) {
      throw new BadRequestException('Captcha not configured on server');
    }

    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token }),
      },
    );

    const result = (await response.json()) as { success: boolean };

    if (!result.success) {
      throw new BadRequestException('Captcha verification failed');
    }
  }
}
