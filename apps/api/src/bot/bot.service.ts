import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateBotDto, UpdateBotDto } from '@openthrone/shared';
import {
  getLevelForXP,
  getFortificationByLevel,
} from '@openthrone/game-logic';
import type { BotGameState } from '@openthrone/game-logic';

@Injectable()
export class BotService {
  constructor(private readonly prisma: PrismaService) {}

  async createBot(dto: CreateBotDto) {
    // Check name uniqueness (case-insensitive)
    const existingName = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM players WHERE LOWER(display_name) = LOWER(${dto.displayName}) LIMIT 1`;
    if (existingName.length > 0) {
      throw new ConflictException('Display name already in use');
    }

    const uuid = crypto.randomUUID();
    const email = `bot-${uuid}@bot.openthrone.local`;
    const passwordHash = await argon2.hash(crypto.randomUUID());
    const personalitySeed = Math.floor(Math.random() * 2147483647);

    const player = await this.prisma.$transaction(async (tx) => {
      const newPlayer = await tx.player.create({
        data: {
          email,
          display_name: dto.displayName,
          password_hash: passwordHash,
          race: dto.race,
          player_class: dto.class,
          is_bot: true,
          last_active: new Date(),
        },
      });

      await tx.playerEconomy.create({
        data: {
          player_id: newPlayer.id,
          gold: 25000,
          gold_in_bank: 0,
          attack_turns: 50,
          house_level: 0,
          economy_level: 0,
        },
      });

      await tx.playerUnit.create({
        data: {
          player_id: newPlayer.id,
          unit_type: 'CITIZEN',
          level: 1,
          quantity: 50,
        },
      });

      await tx.playerFortification.create({
        data: {
          player_id: newPlayer.id,
          fort_level: 1,
          hitpoints: 50,
        },
      });

      await tx.playerStats.create({
        data: { player_id: newPlayer.id },
      });

      const bonusTypes = ['OFFENSE', 'DEFENSE', 'INTEL', 'PRICES', 'INCOME'] as const;
      for (const bonusType of bonusTypes) {
        await tx.playerBonusPoint.create({
          data: {
            player_id: newPlayer.id,
            bonus_type: bonusType,
            level: 0,
          },
        });
      }

      await tx.botConfig.create({
        data: {
          player_id: newPlayer.id,
          strategy: dto.strategy,
          sessions_per_day: dto.sessionsPerDay ?? 3,
          personality_seed: personalitySeed,
          notes: dto.notes,
        },
      });

      return newPlayer;
    });

    return { id: player.id, displayName: player.display_name, strategy: dto.strategy };
  }

  async listBots(
    page: number = 1,
    limit: number = 20,
    strategy?: string,
    active?: boolean,
  ) {
    const where: any = { player: { is_bot: true } };
    if (strategy) where.strategy = strategy;
    if (active !== undefined) where.is_active = active;

    const [configs, total] = await Promise.all([
      this.prisma.botConfig.findMany({
        where,
        include: {
          player: {
            include: {
              stats: true,
              economy: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.botConfig.count({ where }),
    ]);

    return {
      data: configs.map((c) => ({
        id: c.id,
        playerId: c.player_id,
        displayName: c.player.display_name,
        race: c.player.race,
        class: c.player.player_class,
        strategy: c.strategy,
        isActive: c.is_active,
        sessionsPerDay: c.sessions_per_day,
        sessionsToday: c.sessions_today,
        lastSessionAt: c.last_session_at,
        lastActive: c.player.last_active,
        level: getLevelForXP(c.player.stats?.experience ?? 0),
        gold: c.player.economy?.gold.toString() ?? '0',
        notes: c.notes,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBot(id: number) {
    const config = await this.prisma.botConfig.findUnique({
      where: { id },
      include: {
        player: {
          include: {
            stats: true,
            economy: true,
            units: true,
            fortification: true,
          },
        },
      },
    });

    if (!config) throw new NotFoundException('Bot not found');

    const fortDef = getFortificationByLevel(config.player.fortification?.fort_level ?? 1);

    return {
      id: config.id,
      playerId: config.player_id,
      displayName: config.player.display_name,
      race: config.player.race,
      class: config.player.player_class,
      strategy: config.strategy,
      isActive: config.is_active,
      sessionsPerDay: config.sessions_per_day,
      sessionsToday: config.sessions_today,
      lastSessionAt: config.last_session_at,
      personalitySeed: config.personality_seed,
      notes: config.notes,
      createdAt: config.created_at,
      player: {
        level: getLevelForXP(config.player.stats?.experience ?? 0),
        experience: config.player.stats?.experience ?? 0,
        offense: config.player.stats?.offense ?? 0,
        defense: config.player.stats?.defense ?? 0,
        spy: config.player.stats?.spy ?? 0,
        sentry: config.player.stats?.sentry ?? 0,
        gold: config.player.economy?.gold.toString() ?? '0',
        goldInBank: config.player.economy?.gold_in_bank.toString() ?? '0',
        attackTurns: config.player.economy?.attack_turns ?? 0,
        fortLevel: config.player.fortification?.fort_level ?? 1,
        fortHP: config.player.fortification?.hitpoints ?? 50,
        fortMaxHP: fortDef?.hitpoints ?? 50,
        population: config.player.units.reduce((sum, u) => sum + u.quantity, 0),
      },
    };
  }

  async updateBot(id: number, dto: UpdateBotDto) {
    const config = await this.prisma.botConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('Bot not found');

    const data: any = {};
    if (dto.strategy !== undefined) data.strategy = dto.strategy;
    if (dto.isActive !== undefined) data.is_active = dto.isActive;
    if (dto.sessionsPerDay !== undefined) data.sessions_per_day = dto.sessionsPerDay;
    if (dto.notes !== undefined) data.notes = dto.notes;

    await this.prisma.botConfig.update({ where: { id }, data });
    return this.getBot(id);
  }

  async deleteBot(id: number) {
    const config = await this.prisma.botConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('Bot not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.botConfig.update({
        where: { id },
        data: { is_active: false },
      });
      await tx.player.update({
        where: { id: config.player_id },
        data: { status: 'CLOSED' },
      });
    });

    return { success: true };
  }

  async getBotLogs(
    id: number,
    page: number = 1,
    limit: number = 25,
    actionType?: string,
    sessionId?: string,
  ) {
    const config = await this.prisma.botConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('Bot not found');

    const where: any = { bot_config_id: id };
    if (actionType) where.action_type = actionType;
    if (sessionId) where.session_id = sessionId;

    const [logs, total] = await Promise.all([
      this.prisma.botActionLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.botActionLog.count({ where }),
    ]);

    return {
      data: logs.map((l) => ({
        id: l.id,
        sessionId: l.session_id,
        actionType: l.action_type,
        actionData: l.action_data,
        resultData: l.result_data,
        reasoning: l.reasoning,
        success: l.success,
        errorMessage: l.error_message,
        createdAt: l.created_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStats() {
    const [totalBots, activeBots, sessionsToday] = await Promise.all([
      this.prisma.botConfig.count(),
      this.prisma.botConfig.count({ where: { is_active: true } }),
      this.prisma.botConfig.aggregate({
        _sum: { sessions_today: true },
      }),
    ]);

    return {
      totalBots,
      activeBots,
      sessionsToday: sessionsToday._sum.sessions_today ?? 0,
    };
  }

  async loadBotGameState(playerId: string): Promise<BotGameState> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        economy: true,
        units: true,
        items: true,
        stats: true,
        fortification: true,
        structure_upgrades: true,
        bonus_points: true,
        bot_config: true,
      },
    });

    if (!player) throw new NotFoundException('Bot player not found');

    const getUnitQty = (type: string) =>
      player.units
        .filter((u) => u.unit_type === type)
        .reduce((sum, u) => sum + u.quantity, 0);

    const getUpgradeLevel = (type: string) =>
      player.structure_upgrades.find((u) => u.upgrade_type === type)?.level ?? 0;

    const fortDef = getFortificationByLevel(player.fortification?.fort_level ?? 1);

    // Check today's action logs to see what the bot already did
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayLogs = player.bot_config
      ? await this.prisma.botActionLog.findMany({
          where: {
            bot_config_id: player.bot_config.id,
            created_at: { gte: todayStart },
            success: true,
          },
          select: { action_type: true },
        })
      : [];

    const actionTypesUsedToday = new Set(todayLogs.map((l) => l.action_type));

    return {
      playerId,
      gold: Number(player.economy?.gold ?? BigInt(0)),
      goldInBank: Number(player.economy?.gold_in_bank ?? BigInt(0)),
      attackTurns: player.economy?.attack_turns ?? 0,
      citizens: getUnitQty('CITIZEN'),
      workers: getUnitQty('WORKER'),
      offenseUnits: getUnitQty('OFFENSE'),
      defenseUnits: getUnitQty('DEFENSE'),
      spyUnits: getUnitQty('SPY'),
      sentryUnits: getUnitQty('SENTRY'),
      fortLevel: player.fortification?.fort_level ?? 1,
      fortHP: player.fortification?.hitpoints ?? 50,
      fortMaxHP: fortDef?.hitpoints ?? 50,
      houseLevel: getUpgradeLevel('HOUSE'),
      economyLevel: getUpgradeLevel('ECONOMY'),
      offenseUpgradeLevel: getUpgradeLevel('OFFENSE'),
      spyUpgradeLevel: getUpgradeLevel('SPY'),
      sentryUpgradeLevel: getUpgradeLevel('SENTRY'),
      armoryLevel: getUpgradeLevel('ARMORY'),
      level: getLevelForXP(player.stats?.experience ?? 0),
      experience: player.stats?.experience ?? 0,
      offense: player.stats?.offense ?? 0,
      defense: player.stats?.defense ?? 0,
      spy: player.stats?.spy ?? 0,
      sentry: player.stats?.sentry ?? 0,
      canAutoRecruit: (() => {
        if (!player.economy?.last_auto_recruit) return true;
        const todayStartUTC = new Date();
        todayStartUTC.setUTCHours(0, 0, 0, 0);
        return new Date(player.economy.last_auto_recruit) < todayStartUTC;
      })(),
      recruitedToday: actionTypesUsedToday.has('AUTO_RECRUIT'),
      trainedToday: actionTypesUsedToday.has('TRAIN_UNITS'),
    };
  }

  async resetDailySessions() {
    await this.prisma.botConfig.updateMany({
      data: { sessions_today: 0 },
    });
  }

  async getBotsReadyForSession() {
    return this.prisma.botConfig.findMany({
      where: {
        is_active: true,
        player: { status: 'ACTIVE' },
      },
      include: {
        player: { select: { id: true, display_name: true } },
      },
    });
  }
}
