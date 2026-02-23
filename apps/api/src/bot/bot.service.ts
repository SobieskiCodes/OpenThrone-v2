import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateBotDto, GenerateBotsDto } from '@openthrone/shared';
// Phase 4: Migrated Fortifications to GameDataService (keeping import for rollback)
import {
  getLevelForXP,
  getXPForLevel,
  // getFortificationByLevel, // Phase 4 migration
} from '@openthrone/game-logic';
import type { BotGameState } from '@openthrone/game-logic';
import { GameDataService } from '../game-data/game-data.service';

@Injectable()
export class BotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameData: GameDataService,
  ) {}

  async generateBots(dto: GenerateBotsDto) {
    const { count, minLevel, maxLevel } = dto;
    const results: Array<{ displayName: string; level: number; strategy: string }> = [];
    const passwordHash = await argon2.hash(crypto.randomUUID());

    const RACES = ['HUMAN', 'ELF', 'GOBLIN', 'UNDEAD'];
    const CLASSES = ['FIGHTER', 'CLERIC', 'ASSASSIN', 'THIEF'];
    const STRATEGIES = ['WARRIOR', 'TURTLE', 'ECONOMIST', 'SPYMASTER', 'BALANCED'];
    const PREFIXES = [
      'Auto', 'Mech', 'Iron', 'Steel', 'Cyber', 'Proto', 'Sentinel',
      'Dread', 'Warden', 'Phantom', 'Wraith', 'Ghost', 'Shadow', 'Storm',
      'Titan', 'Colossus', 'Vanguard', 'Reaper', 'Forge', 'Bastion',
      'Crimson', 'Azure', 'Obsidian', 'Ember', 'Frost', 'Thunder', 'Void',
      'Apex', 'Prime', 'Nova', 'Nexus', 'Rune', 'Glyph', 'Sigil',
    ];
    const SUFFIXES = [
      'Knight', 'Guard', 'Hunter', 'Striker', 'Watcher', 'Keeper',
      'Blade', 'Shield', 'Fang', 'Claw', 'Horn', 'Wing',
      'Core', 'Node', 'Link', 'Spark', 'Pulse', 'Wave',
      'Lord', 'King', 'Duke', 'Baron', 'Marshal', 'Captain',
      'Bane', 'Doom', 'Fury', 'Rage', 'Storm', 'Bolt',
    ];

    const rand = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

    const LEVEL_XP: Record<number, number> = {
      1: 4000, 2: 8000, 3: 13000, 4: 19000, 5: 26000, 6: 34000, 7: 43000,
      8: 53000, 9: 64000, 10: 76000, 11: 89000, 12: 103000, 13: 118000,
      14: 134000, 15: 151000, 16: 169000, 17: 188000, 18: 208000, 19: 229000,
      20: 251000, 25: 376000, 30: 526000, 35: 701000, 40: 901000, 45: 1126000,
      50: 1376000, 55: 1651000, 60: 1951000, 65: 2276000, 70: 2626000,
      75: 3001000, 80: 3401000, 85: 3826000, 90: 4276000, 95: 4751000, 100: 5251000,
    };
    const FORT_REQS: Record<number, number> = {
      1: 0, 2: 5, 3: 10, 4: 15, 5: 20, 6: 25, 7: 30, 8: 35, 9: 40, 10: 45,
      11: 50, 12: 55, 13: 60, 14: 65, 15: 70, 16: 75, 17: 80, 18: 85, 19: 90,
      20: 95, 21: 100, 22: 105, 23: 110, 24: 115,
    };
    const FORT_HP: Record<number, number> = {
      1: 50, 2: 100, 3: 200, 4: 300, 5: 500, 6: 750, 7: 1000, 8: 1500, 9: 2000,
      10: 2500, 11: 3000, 12: 3500, 13: 4000, 14: 4500, 15: 5000, 16: 5500,
      17: 6000, 18: 6500, 19: 7000, 20: 7500, 21: 8000, 22: 8500, 23: 9000, 24: 9500,
    };
    const ARMORY_FORT_REQS = [0, 5, 10, 13, 17, 21];
    const HOUSE_FORT_REQS = [0, 2, 6, 10, 14, 18, 22];
    const ECONOMY_FORT_REQS = [0, 3, 7, 11, 15, 19, 23];

    const xpForLevel = (level: number): number => {
      // Use the actual game XP curve (supports all levels 1-100)
      const currentLevelXP = getXPForLevel(level);
      const nextLevelXP = getXPForLevel(level + 1);

      if (nextLevelXP === 0 || nextLevelXP <= currentLevelXP) {
        // Max level or invalid - just return exact XP
        return currentLevelXP;
      }

      // Add random XP within this level (80% of the gap to next level)
      const gap = nextLevelXP - currentLevelXP;
      const maxBonus = Math.floor(gap * 0.8);
      return currentLevelXP + rand(0, maxBonus);
    };
    const maxFortFor = (lvl: number): number => {
      let m = 1;
      for (const [f, r] of Object.entries(FORT_REQS)) if (lvl >= r) m = Math.max(m, Number(f));
      return m;
    };
    const maxStructLevel = (fortLvl: number, reqs: number[]): number => {
      let lvl = 1;
      for (let i = 0; i < reqs.length; i++) if (fortLvl >= reqs[i]!) lvl = i + 1;
      return lvl;
    };

    const usedNames = new Set<string>();

    for (let i = 0; i < count; i++) {
      const playerLevel = rand(minLevel, maxLevel);
      const experience = xpForLevel(playerLevel);
      const strategy = pick(STRATEGIES);
      const maxFort = maxFortFor(playerLevel);
      const fortLevel = Math.max(1, rand(Math.max(1, maxFort - 3), maxFort));

      let displayName: string;
      let attempts = 0;
      do {
        displayName = `${pick(PREFIXES)}${pick(SUFFIXES)}`;
        if (attempts > 20) displayName += rand(1, 999);
        attempts++;
      } while (usedNames.has(displayName.toLowerCase()));
      usedNames.add(displayName.toLowerCase());

      const existing = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM players WHERE LOWER(display_name) = LOWER(${displayName}) LIMIT 1`;
      if (existing.length > 0) {
        displayName += rand(100, 999);
      }

      const race = pick(RACES);
      const playerClass = pick(CLASSES);
      const goldMultiplier = 1 + playerLevel * 0.5 + Math.pow(playerLevel, 1.5) * 0.1;
      const baseGold = rand(5000, 100000) * goldMultiplier;
      const houseLevel = rand(1, maxStructLevel(fortLevel, HOUSE_FORT_REQS));
      const economyLevel = rand(1, maxStructLevel(fortLevel, ECONOMY_FORT_REQS));
      const armoryLevel = rand(1, maxStructLevel(fortLevel, ARMORY_FORT_REQS));

      const population = rand(50 + playerLevel * 10, 100 + playerLevel * 40 + Math.floor(Math.pow(playerLevel, 1.8)));
      const citizens = Math.max(5, Math.floor(population * rand(5, 25) / 100));
      const workers = Math.floor(population * rand(10, 30) / 100);
      const combatBudget = population - citizens - workers;

      let offPct = 25, defPct = 25, spyPct = 25, senPct = 25;
      if (strategy === 'WARRIOR') { offPct = rand(50, 70); defPct = rand(10, 25); spyPct = rand(5, 15); senPct = 100 - offPct - defPct - spyPct; }
      else if (strategy === 'TURTLE') { defPct = rand(50, 70); offPct = rand(10, 25); senPct = rand(5, 15); spyPct = 100 - offPct - defPct - senPct; }
      else if (strategy === 'SPYMASTER') { spyPct = rand(40, 60); senPct = rand(15, 25); offPct = rand(5, 15); defPct = 100 - offPct - spyPct - senPct; }
      else if (strategy === 'ECONOMIST') { offPct = rand(15, 25); defPct = rand(15, 25); spyPct = rand(10, 20); senPct = 100 - offPct - defPct - spyPct; }
      else { offPct = rand(20, 30); defPct = rand(20, 30); spyPct = rand(15, 25); senPct = 100 - offPct - defPct - spyPct; }
      senPct = Math.max(0, senPct); spyPct = Math.max(0, spyPct);

      const offCount = Math.floor(combatBudget * offPct / 100);
      const defCount = Math.floor(combatBudget * defPct / 100);
      const spyCount = Math.floor(combatBudget * spyPct / 100);
      const senCount = Math.max(0, combatBudget - offCount - defCount - spyCount);

      const maxOffLvl = fortLevel >= 10 ? 4 : fortLevel >= 7 ? 3 : fortLevel >= 4 ? 2 : 1;
      const maxDefLvl = fortLevel >= 10 ? 4 : fortLevel >= 7 ? 3 : fortLevel >= 4 ? 2 : 1;
      const maxSpyLvl = fortLevel >= 12 ? 3 : fortLevel >= 8 ? 2 : 1;
      const maxSenLvl = fortLevel >= 12 ? 3 : fortLevel >= 8 ? 2 : 1;
      const maxWorkerLvl = fortLevel >= 7 ? 3 : fortLevel >= 3 ? 2 : 1;

      type UnitRow = { unit_type: string; level: number; quantity: number };
      const unitRows: UnitRow[] = [{ unit_type: 'CITIZEN', level: 1, quantity: citizens }];

      if (workers > 0) {
        const perLevel = Math.ceil(workers / maxWorkerLvl);
        for (let l = 1; l <= maxWorkerLvl; l++) {
          const qty = Math.min(perLevel, workers - (l - 1) * perLevel);
          if (qty > 0) unitRows.push({ unit_type: 'WORKER', level: l, quantity: qty });
        }
      }

      const addUnits = (type: string, total: number, maxLvl: number) => {
        if (total <= 0) return;
        if (maxLvl === 1) { unitRows.push({ unit_type: type, level: 1, quantity: total }); return; }
        let rem = total;
        for (let l = maxLvl; l >= 1; l--) {
          const frac = l === 1 ? 1.0 : 1 / (l * 1.5);
          const qty = l === 1 ? rem : Math.min(rem, Math.max(1, Math.floor(total * frac)));
          if (qty > 0) { unitRows.push({ unit_type: type, level: l, quantity: qty }); rem -= qty; }
        }
      };
      addUnits('OFFENSE', offCount, maxOffLvl);
      addUnits('DEFENSE', defCount, maxDefLvl);
      addUnits('SPY', spyCount, maxSpyLvl);
      addUnits('SENTRY', senCount, maxSenLvl);

      type ItemRow = { item_type: string; usage: string; level: number; quantity: number };
      const itemRows: ItemRow[] = [];
      const maxItemLvl = Math.min(10, armoryLevel * 2);
      if (armoryLevel > 1 && playerLevel >= 3) {
        for (const usage of ['OFFENSE', 'DEFENSE', 'SPY', 'SENTRY']) {
          const unitCount = unitRows.filter((u) => u.unit_type === usage).reduce((s, u) => s + u.quantity, 0);
          if (unitCount === 0) continue;
          for (const itemType of ['WEAPON', 'ARMOR']) {
            itemRows.push({ item_type: itemType, usage, level: rand(1, maxItemLvl), quantity: Math.max(1, Math.floor(unitCount * rand(30, 100) / 100)) });
          }
        }
      }

      type StructRow = { upgrade_type: string; level: number };
      const structRows: StructRow[] = [];
      const offUp = rand(1, Math.min(22, fortLevel));
      const spyUp = rand(1, Math.min(22, fortLevel));
      const senUp = rand(1, Math.min(22, fortLevel));
      if (offUp > 1) structRows.push({ upgrade_type: 'OFFENSE', level: offUp });
      if (spyUp > 1) structRows.push({ upgrade_type: 'SPY', level: spyUp });
      if (senUp > 1) structRows.push({ upgrade_type: 'SENTRY', level: senUp });
      if (armoryLevel > 1) structRows.push({ upgrade_type: 'ARMORY', level: armoryLevel });

      const totalOff = unitRows.filter((u) => u.unit_type === 'OFFENSE').reduce((s, u) => s + u.quantity * u.level * 3, 0)
        + itemRows.filter((it) => it.usage === 'OFFENSE').reduce((s, it) => s + it.quantity * it.level * 25, 0);
      const totalDef = unitRows.filter((u) => u.unit_type === 'DEFENSE').reduce((s, u) => s + u.quantity * u.level * 3, 0)
        + itemRows.filter((it) => it.usage === 'DEFENSE').reduce((s, it) => s + it.quantity * it.level * 25, 0);
      const totalSpy = unitRows.filter((u) => u.unit_type === 'SPY').reduce((s, u) => s + u.quantity * u.level * 5, 0)
        + itemRows.filter((it) => it.usage === 'SPY').reduce((s, it) => s + it.quantity * it.level * 12, 0);
      const totalSen = unitRows.filter((u) => u.unit_type === 'SENTRY').reduce((s, u) => s + u.quantity * u.level * 5, 0)
        + itemRows.filter((it) => it.usage === 'SENTRY').reduce((s, it) => s + it.quantity * it.level * 12, 0);

      await this.prisma.$transaction(async (tx) => {
        const player = await tx.player.create({
          data: {
            email: `bot-${crypto.randomUUID()}@bot.openthrone.local`,
            display_name: displayName,
            password_hash: passwordHash,
            race, player_class: playerClass,
            is_bot: true,
            bio: `[BOT] ${strategy} — Level ${playerLevel}`,
            last_active: new Date(),
          },
        });

        await tx.botConfig.create({
          data: {
            player_id: player.id,
            strategy,
            is_active: true,
            sessions_per_day: rand(2, 5),
            personality_seed: rand(0, 1000000),
            notes: `Generated: Lv${playerLevel} ${strategy}`,
          },
        });

        await tx.playerEconomy.create({
          data: {
            player_id: player.id,
            gold: BigInt(Math.floor(baseGold)),
            gold_in_bank: BigInt(Math.floor(rand(0, 5) * baseGold)),
            attack_turns: rand(10, 200),
            house_level: houseLevel,
            economy_level: economyLevel,
          },
        });

        await tx.playerFortification.create({
          data: {
            player_id: player.id,
            fort_level: fortLevel,
            hitpoints: rand(Math.floor((FORT_HP[fortLevel] ?? 50) * 0.3), FORT_HP[fortLevel] ?? 50),
          },
        });

        await tx.playerStats.create({
          data: {
            player_id: player.id,
            experience, rank: 0,
            offense: totalOff, defense: totalDef, spy: totalSpy, sentry: totalSen,
            killing_str: 1, defense_str: 1, spying_str: 1, sentry_str: 1,
          },
        });

        for (const u of unitRows) {
          await tx.playerUnit.create({ data: { player_id: player.id, ...u } });
        }
        for (const it of itemRows) {
          await tx.playerItem.create({ data: { player_id: player.id, ...it } });
        }
        for (const su of structRows) {
          await tx.playerStructureUpgrade.create({ data: { player_id: player.id, ...su } });
        }
        for (const bt of ['OFFENSE', 'DEFENSE', 'INTEL', 'PRICES', 'INCOME']) {
          await tx.playerBonusPoint.create({ data: { player_id: player.id, bonus_type: bt, level: 0 } });
        }
      });

      results.push({ displayName, level: playerLevel, strategy });
    }

    return { created: results.length, bots: results };
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
        level: getLevelForXP(Number(c.player.stats?.experience ?? 0)),
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
            buildings: true,
          },
        },
      },
    });

    if (!config) throw new NotFoundException('Bot not found');

    const fortDef = this.gameData.getFortification(config.player.fortification?.fort_level ?? 1);

    // Extract building levels
    const buildings = config.player.buildings || [];
    const getBuildingLevel = (type: string) => buildings.find((b) => b.building_type === type)?.level ?? 0;

    // Count cosmetics and chat messages
    const [cosmeticsOwned, cosmeticsEquipped, chatMessagesTotal, chatMessagesToday] = await Promise.all([
      this.prisma.playerCosmetic.count({ where: { player_id: config.player_id } }),
      this.prisma.playerCosmetic.count({ where: { player_id: config.player_id, equipped: true } }),
      this.prisma.chatMessage.count({ where: { sender_id: config.player_id } }),
      this.prisma.chatMessage.count({
        where: {
          sender_id: config.player_id,
          sent_at: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

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
        level: getLevelForXP(Number(config.player.stats?.experience ?? 0)),
        experience: (config.player.stats?.experience ?? BigInt(0)).toString(),
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
        fortificationLevel: getBuildingLevel('FORTIFICATION') || 1,
        armoryLevel: getBuildingLevel('ARMORY'),
        mineLevel: getBuildingLevel('MINE'),
        spyAcademyLevel: getBuildingLevel('SPY_ACADEMY'),
        housingLevel: getBuildingLevel('HOUSING'),
        mercenaryCampLevel: getBuildingLevel('MERCENARY_CAMP'),
        cosmeticsOwned,
        cosmeticsEquipped,
        chatMessagesTotal,
        chatMessagesToday,
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
        buildings: true,
        structure_upgrades: true,
        units: true,
        items: true,
        stats: true,
        fortification: true,
        bonus_points: true,
        bot_config: true,
        // Phase 1: Bot Intelligence
        bot_intel_cache: {
          orderBy: { spied_at: 'desc' },
          take: 50, // Keep last 50 intel reports
        },
        bot_battle_memory: {
          orderBy: { timestamp: 'desc' },
          take: 100, // Keep last 100 battles for pattern detection
        },
        bot_threats: {
          orderBy: { timestamp: 'desc' },
          take: 50, // Keep last 50 attackers
        },
        // Phase 4: Alliance System
        alliance_membership: {
          include: {
            alliance: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!player) throw new NotFoundException('Bot player not found');

    const getUnitQty = (type: string) =>
      player.units
        .filter((u) => u.unit_type === type)
        .reduce((sum, u) => sum + u.quantity, 0);
    
    const getUpgradeLevel = (type: string) =>
      player.structure_upgrades?.find((u) => u.upgrade_type === type)?.level ?? 0;
    
    const getBuildingLevel = (type: string) =>
      player.buildings?.find((b) => b.building_type === type)?.level ?? 0;
    const fortDef = this.gameData.getFortification(player.fortification?.fort_level ?? 1);

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

    // Calculate proficiency points (Phase 0: Bot Intelligence)
    const bonusPointsArray = player.bonus_points || [];
    const bonusPoints = {
      OFFENSE: bonusPointsArray.find((bp) => bp.bonus_type === 'OFFENSE')?.level ?? 0,
      DEFENSE: bonusPointsArray.find((bp) => bp.bonus_type === 'DEFENSE')?.level ?? 0,
      RECRUITING: bonusPointsArray.find((bp) => bp.bonus_type === 'RECRUITING')?.level ?? 0,
      CASUALTY: bonusPointsArray.find((bp) => bp.bonus_type === 'CASUALTY')?.level ?? 0,
      INTEL: bonusPointsArray.find((bp) => bp.bonus_type === 'INTEL')?.level ?? 0,
      INCOME: bonusPointsArray.find((bp) => bp.bonus_type === 'INCOME')?.level ?? 0,
      PRICES: bonusPointsArray.find((bp) => bp.bonus_type === 'PRICES')?.level ?? 0,
    };
    const currentLevel = getLevelForXP(Number(player.stats?.experience ?? 0));
    const totalAllocated = bonusPointsArray.reduce((sum, bp) => sum + bp.level, 0);
    const availablePoints = currentLevel - totalAllocated; // 1 point per level

    // Transform intelligence data (Phase 1: Bot Intelligence)
    const intelReports = (player.bot_intel_cache || []).map((intel) => ({
      targetId: intel.target_id,
      targetName: intel.target_name,
      targetLevel: intel.target_level,
      goldAmount: intel.gold_amount ? Number(intel.gold_amount) : null,
      offenseStrength: intel.offense_strength,
      defenseStrength: intel.defense_strength,
      spiedAt: intel.spied_at,
      revealPercent: intel.reveal_percent,
    }));

    const battleHistory = (player.bot_battle_memory || []).map((battle) => ({
      targetId: battle.target_id,
      targetName: battle.target_name,
      isWin: battle.is_win,
      goldStolen: Number(battle.gold_stolen),
      unitsLost: battle.units_lost,
      timestamp: battle.timestamp,
    }));

    const recentAttackers = (player.bot_threats || []).map((threat) => ({
      attackerId: threat.attacker_id,
      attackerName: threat.attacker_name,
      attackerLevel: threat.attacker_level,
      timestamp: threat.timestamp,
      goldLost: Number(threat.gold_lost),
    }));

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
      buildings: {
        FORTIFICATION: getBuildingLevel('FORTIFICATION'),
        ARMORY: getBuildingLevel('ARMORY'),
        MINE: getBuildingLevel('MINE'),
        SPY_ACADEMY: getBuildingLevel('SPY_ACADEMY'),
        HOUSING: getBuildingLevel('HOUSING'),
        MERCENARY_CAMP: getBuildingLevel('MERCENARY_CAMP'),
      },
      fortification: {
        level: player.fortification?.fort_level ?? 1,
        hitpoints: player.fortification?.hitpoints ?? 50,
        maxHitpoints: fortDef?.hitpoints ?? 50,
      },
      offenseUpgradeLevel: getUpgradeLevel('OFFENSE'),
      spyUpgradeLevel: getUpgradeLevel('SPY'),
      sentryUpgradeLevel: getUpgradeLevel('SENTRY'),
      availablePoints,
      bonusPoints,
      level: currentLevel,
      experience: Number(player.stats?.experience ?? 0),
      offense: player.stats?.offense ?? 0,
      defense: player.stats?.defense ?? 0,
      spy: player.stats?.spy ?? 0,
      sentry: player.stats?.sentry ?? 0,
      intelReports,
      battleHistory,
      recentAttackers,
      // Phase 4: Alliance System (use first alliance if bot is in multiple)
      allianceId: player.alliance_membership?.[0]?.alliance?.id ?? null,
      allianceName: player.alliance_membership?.[0]?.alliance?.name ?? null,
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
