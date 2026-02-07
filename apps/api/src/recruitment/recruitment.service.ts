import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerRecruitedEvent, AutoRecruitEvent } from '@openthrone/events';
import {
  RECRUIT_LINK_CITIZENS_BONUS,
  RECRUIT_LINK_IP_COOLDOWN_HOURS,
  RECRUIT_LINK_MAX_PER_DAY,
  calculateRecruitLinkBonus,
  calculateAutoRecruitCitizens,
  getHouseUpgradeByLevel,
} from '@openthrone/game-logic';
import { UnitType, BonusType } from '@openthrone/shared';

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
    const [player, economy, bonusPoints, recentRecruits] = await Promise.all([
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
    ]);

    if (!player || !economy) {
      throw new BadRequestException('Player data not found');
    }

    const recruitingBonus = bonusPoints.find(
      (bp) => bp.bonus_type === BonusType.RECRUITING,
    );
    const recruitingBonusLevel = recruitingBonus?.level ?? 0;

    const houseUpgrade = getHouseUpgradeByLevel(economy.house_level || 1);
    const citizensDaily = houseUpgrade?.citizensDaily ?? 1;
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

    return {
      recruitLink: player.recruit_link,
      recruitingBonusLevel,
      citizensPerRecruit: linkBonus,
      citizensPerAutoRecruit: autoRecruitCitizens,
      houseLevel: economy.house_level || 1,
      todayRecruits,
      maxRecruitsPerDay: RECRUIT_LINK_MAX_PER_DAY,
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

    return {
      message: `You helped ${referrer.display_name} recruit ${citizensAwarded} citizens!`,
      citizensAwarded,
    };
  }

  /**
   * Trigger auto-recruit: award daily citizens based on house level + recruiting bonus.
   */
  async autoRecruit(playerId: string) {
    const [economy, bonusPoints] = await Promise.all([
      this.prisma.playerEconomy.findUnique({ where: { player_id: playerId } }),
      this.prisma.playerBonusPoint.findMany({ where: { player_id: playerId } }),
    ]);

    if (!economy) {
      throw new BadRequestException('Player economy not found');
    }

    const houseLevel = economy.house_level || 1;
    const houseUpgrade = getHouseUpgradeByLevel(houseLevel);
    if (!houseUpgrade) {
      throw new BadRequestException('Invalid house level');
    }

    const recruitingBonus = bonusPoints.find(
      (bp) => bp.bonus_type === BonusType.RECRUITING,
    );
    const recruitingBonusLevel = recruitingBonus?.level ?? 0;
    const citizensGained = calculateAutoRecruitCitizens(
      houseUpgrade.citizensDaily,
      recruitingBonusLevel,
    );

    await this.prisma.playerUnit.upsert({
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

    this.eventEmitter.emit(
      'recruitment.auto',
      new AutoRecruitEvent(playerId, citizensGained, houseLevel),
    );

    return {
      citizensGained,
      houseLevel,
      message: `Auto-recruit awarded ${citizensGained} citizens.`,
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
