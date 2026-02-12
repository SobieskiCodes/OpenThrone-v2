import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import {
  getLevelForXP,
  getXPForLevel,
  calculateFullStats,
  calculateFullDetailedBreakdown,
  buildCombatProfile,
  resolveAttack,
  resolveIntel,
  resolveAssassination,
  resolveInfiltration,
  resolveStealGold,
  resolveSabotage,
  DEFAULT_COMBAT_CONFIG,
  getFortificationByLevel,
} from '@openthrone/game-logic';
import type {
  BattlePlayersQueryDto,
  BattleRankingsQueryDto,
  BattleHistoryQueryDto,
  SpyMissionDto,
} from '@openthrone/shared';
import type { FullPlayerData, CombatProfile } from '@openthrone/game-logic';
import {
  AttackExecutedEvent,
  SpyMissionExecutedEvent,
  FortDamagedEvent,
  LeveledUpEvent,
} from '@openthrone/events';

@Injectable()
export class BattleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Player List / Rankings / History (existing) ────────────────────

  async getPlayers(currentPlayerId: string, query: BattlePlayersQueryDto) {
    const { page, limit, search, race, sort, order, inRange, botFilter } = query;
    const playerClass = query.class;

    const where: any = {
      status: 'ACTIVE',
      id: { not: currentPlayerId },
    };

    if (search) {
      where.display_name = { contains: search, mode: 'insensitive' };
    }
    if (race) {
      where.race = race;
    }
    if (playerClass) {
      where.player_class = playerClass;
    }
    if (botFilter === 'humans') {
      where.is_bot = false;
    } else if (botFilter === 'bots') {
      where.is_bot = true;
    }

    // Filter to players within ±10 levels of attacker
    if (inRange) {
      const attackerStats = await this.prisma.playerStats.findUnique({
        where: { player_id: currentPlayerId },
        select: { experience: true },
      });
      const attackerLevel = getLevelForXP(attackerStats?.experience ?? 0);
      const minLevel = Math.max(1, attackerLevel - 10);
      const maxLevel = attackerLevel + 10;
      // Level 1 includes players with 0 XP (getLevelForXP defaults to 1),
      // so minXP must be 0 when minLevel is 1 to avoid excluding them
      const minXP = minLevel <= 1 ? 0 : getXPForLevel(minLevel);
      // For maxLevel, use the XP threshold of maxLevel+1 as exclusive upper bound
      // If maxLevel+1 is beyond max, use a very large number
      const maxXP = getXPForLevel(maxLevel + 1) || Number.MAX_SAFE_INTEGER;
      where.stats = { experience: { gte: minXP, lt: maxXP } };
    }

    // Sorts that can be done at DB level (paginate in DB)
    const dbSortable = ['rank', 'level', 'fortLevel', 'displayName'];
    const needsInMemorySort = !dbSortable.includes(sort);

    const orderBy: any[] = [];
    if (sort === 'rank') {
      orderBy.push({ stats: { rank: order } });
    } else if (sort === 'level') {
      orderBy.push({ stats: { experience: order } });
    } else if (sort === 'fortLevel') {
      orderBy.push({ fortification: { fort_level: order } });
    } else if (sort === 'displayName') {
      orderBy.push({ display_name: order });
    } else {
      // For in-memory sorts, fetch in rank order as baseline
      orderBy.push({ stats: { rank: 'asc' as const } });
    }

    // For DB-sortable fields, paginate at DB level; otherwise fetch all for in-memory sort
    const [players, total] = await Promise.all([
      this.prisma.player.findMany({
        where,
        include: {
          stats: true,
          economy: true,
          fortification: true,
          units: true,
        },
        orderBy,
        ...(needsInMemorySort ? {} : { skip: (page - 1) * limit, take: limit }),
      }),
      this.prisma.player.count({ where }),
    ]);

    // Fetch today's attack counts for these targets in one query
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const playerIds = players.map((p) => p.id);
    const attackCounts = await this.prisma.attackLog.groupBy({
      by: ['defender_id'],
      where: {
        attacker_id: currentPlayerId,
        defender_id: { in: playerIds },
        type: 'attack',
        timestamp: { gte: dayAgo },
      },
      _count: { id: true },
    });
    const attackCountMap = new Map(
      attackCounts.map((ac) => [ac.defender_id, ac._count.id]),
    );

    // Fetch attacker's spy stat for gold visibility
    const attackerStats = await this.prisma.playerStats.findUnique({
      where: { player_id: currentPlayerId },
      select: { spy: true },
    });
    const attackerSpy = attackerStats?.spy ?? 0;

    // Fetch alliance intel for visible players
    const attackerMembership = await this.prisma.allianceMembership.findFirst({
      where: { user_id: currentPlayerId },
      select: { alliance_id: true },
    });

    let allianceIntelMap = new Map<string, { spiedByName: string; spiedAt: Date; revealPercent: number; intelData: any }>();
    if (attackerMembership) {
      const intelRecords = await this.prisma.allianceIntel.findMany({
        where: {
          alliance_id: attackerMembership.alliance_id,
          target_id: { in: playerIds },
        },
        orderBy: { created_at: 'desc' },
        include: {
          spied_by: { select: { display_name: true } },
        },
      });
      // Keep only the latest per target
      for (const rec of intelRecords) {
        if (!allianceIntelMap.has(rec.target_id)) {
          let parsedIntel: any = {};
          try { parsedIntel = JSON.parse(rec.intel_data); } catch { /* ignore */ }
          allianceIntelMap.set(rec.target_id, {
            spiedByName: rec.spied_by.display_name,
            spiedAt: rec.created_at,
            revealPercent: rec.reveal_percent,
            intelData: parsedIntel,
          });
        }
      }
    }

    const data = players.map((p) => {
      const armySize = p.units
        .filter((u) => u.unit_type !== 'CITIZEN')
        .reduce((sum, u) => sum + u.quantity, 0);
      const population = p.units.reduce((sum, u) => sum + u.quantity, 0);
      const fortLevel = p.fortification?.fort_level ?? 1;
      const fortDef = getFortificationByLevel(fortLevel);
      const fortMaxHP = fortDef?.hitpoints ?? 50;
      const fortHP = p.fortification?.hitpoints ?? fortMaxHP;

      // Gold visibility: attacker spy must be >= target sentry * goldVisibilityRatio
      const targetSentry = p.stats?.sentry ?? 0;
      const canSeeGold = attackerSpy >= targetSentry * DEFAULT_COMBAT_CONFIG.goldVisibilityRatio;

      return {
        id: p.id,
        displayName: p.display_name,
        race: p.race,
        class: p.player_class,
        level: getLevelForXP(p.stats?.experience ?? 0),
        rank: p.stats?.rank ?? 0,
        fortLevel,
        fortHP,
        fortMaxHP,
        population,
        armySize,
        gold: canSeeGold ? (p.economy?.gold ?? BigInt(0)).toString() : null,
        lastActive: p.last_active,
        status: p.status,
        isBot: p.is_bot,
        attacksToday: attackCountMap.get(p.id) ?? 0,
        maxAttacksPerDay: DEFAULT_COMBAT_CONFIG.maxAttacksPerTargetPer24h,
        allianceIntel: allianceIntelMap.get(p.id) ?? null,
      };
    });

    // In-memory sort for derived fields
    let sortedData = data;
    if (needsInMemorySort) {
      const dir = order === 'asc' ? 1 : -1;
      if (sort === 'population') {
        sortedData = [...data].sort((a, b) => (a.population - b.population) * dir);
      } else if (sort === 'gold') {
        // Only sort by visible gold; hidden-gold players go to the end
        sortedData = [...data].sort((a, b) => {
          if (a.gold === null && b.gold === null) return 0;
          if (a.gold === null) return 1;
          if (b.gold === null) return -1;
          return (Number(a.gold) - Number(b.gold)) * dir;
        });
      } else if (sort === 'attacksToday') {
        sortedData = [...data].sort((a, b) => (a.attacksToday - b.attacksToday) * dir);
      }
    }

    // Paginate in-memory sorted results (DB-sorted results are already paginated)
    const paginatedData = needsInMemorySort
      ? sortedData.slice((page - 1) * limit, page * limit)
      : sortedData;

    // Also include attacker's available attack turns
    const attackerEconomy = await this.prisma.playerEconomy.findUnique({
      where: { player_id: currentPlayerId },
      select: { attack_turns: true },
    });

    return {
      data: paginatedData,
      attackTurns: attackerEconomy?.attack_turns ?? 0,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRankings(query: BattleRankingsQueryDto, currentPlayerId?: string) {
    const { type, page, limit } = query;

    let orderBy: any;
    switch (type) {
      case 'offense':
        orderBy = { offense: 'desc' as const };
        break;
      case 'defense':
        orderBy = { defense: 'desc' as const };
        break;
      case 'spy':
        orderBy = { spy: 'desc' as const };
        break;
      case 'sentry':
        orderBy = { sentry: 'desc' as const };
        break;
      case 'overall':
      default:
        orderBy = { rank: 'asc' as const };
        break;
    }

    const [stats, total] = await Promise.all([
      this.prisma.playerStats.findMany({
        where: { player: { status: 'ACTIVE' } },
        include: {
          player: {
            select: {
              id: true,
              display_name: true,
              race: true,
              player_class: true,
              is_bot: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.playerStats.count({
        where: { player: { status: 'ACTIVE' } },
      }),
    ]);

    const data = stats.map((s, index) => {
      return {
        rank: type === 'overall' ? s.rank : (page - 1) * limit + index + 1,
        id: s.player.id,
        displayName: s.player.display_name,
        race: s.player.race,
        class: s.player.player_class,
        level: getLevelForXP(s.experience),
        isBot: s.player.is_bot,
      };
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getHistory(playerId: string, query: BattleHistoryQueryDto) {
    const { page, limit, type } = query;

    const SPY_TYPES = ['intel', 'assassinate', 'infiltrate', 'steal_gold', 'sabotage'];
    const where: any = {};
    if (type === 'attack') {
      where.attacker_id = playerId;
      where.type = 'attack';
    } else if (type === 'defense') {
      where.defender_id = playerId;
      where.type = 'attack';
    } else if (type === 'spy') {
      where.OR = [
        { attacker_id: playerId },
        { defender_id: playerId },
      ];
      where.type = { in: SPY_TYPES };
    } else {
      where.OR = [
        { attacker_id: playerId },
        { defender_id: playerId },
      ];
    }

    const [logs, total] = await Promise.all([
      this.prisma.attackLog.findMany({
        where,
        include: {
          attacker: {
            select: { id: true, display_name: true, race: true },
          },
          defender: {
            select: { id: true, display_name: true, race: true },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.attackLog.count({ where }),
    ]);

    const data = logs.map((log) => {
      let parsedStats: any = {};
      try {
        parsedStats = JSON.parse(log.stats);
      } catch {
        // stats might not be valid JSON
      }

      return {
        id: log.id,
        attacker: {
          id: log.attacker.id,
          displayName: log.attacker.display_name,
          race: log.attacker.race,
        },
        defender: {
          id: log.defender.id,
          displayName: log.defender.display_name,
          race: log.defender.race,
        },
        winner: log.winner,
        type: log.type,
        goldStolen: parsedStats.goldStolen?.toString() ?? '0',
        timestamp: log.timestamp,
        isAttacker: log.attacker_id === playerId,
      };
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getHistoryDetail(playerId: string, logId: number) {
    if (isNaN(logId)) {
      throw new BadRequestException('Invalid log ID');
    }

    const log = await this.prisma.attackLog.findUnique({
      where: { id: logId },
      include: {
        attacker: {
          select: { id: true, display_name: true, race: true, player_class: true },
        },
        defender: {
          select: { id: true, display_name: true, race: true, player_class: true },
        },
        acl: true,
      },
    });

    if (!log) {
      throw new NotFoundException('Battle log not found');
    }

    const isParticipant =
      log.attacker_id === playerId || log.defender_id === playerId;
    const hasAcl = log.acl.some(
      (a) => a.shared_with_user_id === playerId,
    );

    if (!isParticipant && !hasAcl) {
      throw new ForbiddenException('You do not have access to this battle log');
    }

    let parsedStats: any = {};
    try {
      parsedStats = JSON.parse(log.stats);
    } catch {
      // stats might not be valid JSON
    }

    // Use snapshotted meta if available (new logs), fall back to live player data (old logs)
    const attackerMeta = parsedStats.attackerMeta;
    const defenderMeta = parsedStats.defenderMeta;

    return {
      id: log.id,
      attacker: {
        id: log.attacker.id,
        displayName: log.attacker.display_name,
        race: attackerMeta?.race ?? log.attacker.race,
        class: attackerMeta?.playerClass ?? log.attacker.player_class,
        level: attackerMeta?.level ?? null,
      },
      defender: {
        id: log.defender.id,
        displayName: log.defender.display_name,
        race: defenderMeta?.race ?? log.defender.race,
        class: defenderMeta?.playerClass ?? log.defender.player_class,
        level: defenderMeta?.level ?? null,
      },
      winner: log.winner,
      type: log.type,
      timestamp: log.timestamp,
      stats: parsedStats,
      isAttacker: log.attacker_id === playerId,
    };
  }

  // ─── Attack ─────────────────────────────────────────────────────────

  async executeAttack(attackerId: string, defenderId: string, turns: number = 1) {
    if (attackerId === defenderId) {
      throw new BadRequestException('You cannot attack yourself');
    }

    // Load both players
    const [attackerPlayer, defenderPlayer] = await Promise.all([
      this.loadFullPlayer(attackerId),
      this.loadFullPlayer(defenderId),
    ]);

    if (!attackerPlayer) throw new NotFoundException('Attacker not found');
    if (!defenderPlayer) throw new NotFoundException('Defender not found');
    if (defenderPlayer.status !== 'ACTIVE') {
      throw new BadRequestException('Target player is not active');
    }

    // Check attack turns (need enough for requested turns)
    if ((attackerPlayer.economy?.attack_turns ?? 0) < turns) {
      throw new BadRequestException(
        `Not enough attack turns (need ${turns}, have ${attackerPlayer.economy?.attack_turns ?? 0})`,
      );
    }

    // Check level range (±10 levels)
    const attackerLevel = getLevelForXP(attackerPlayer.stats?.experience ?? 0);
    const defenderLevel = getLevelForXP(defenderPlayer.stats?.experience ?? 0);
    if (Math.abs(attackerLevel - defenderLevel) > 10) {
      throw new BadRequestException(
        `Target is out of range (your level: ${attackerLevel}, their level: ${defenderLevel}, max difference: 10)`,
      );
    }

    // Check offense units
    const hasOffenseUnits = attackerPlayer.units.some(
      (u) => u.unit_type === 'OFFENSE' && u.quantity > 0,
    );
    if (!hasOffenseUnits) {
      throw new BadRequestException('You have no offense units');
    }

    // Rate limit: max attacks per target per 24h
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAttacks = await this.prisma.attackLog.count({
      where: {
        attacker_id: attackerId,
        defender_id: defenderId,
        type: 'attack',
        timestamp: { gte: dayAgo },
      },
    });
    if (recentAttacks >= DEFAULT_COMBAT_CONFIG.maxAttacksPerTargetPer24h) {
      throw new BadRequestException(
        `Maximum ${DEFAULT_COMBAT_CONFIG.maxAttacksPerTargetPer24h} attacks per target per 24 hours`,
      );
    }

    // Build combat profiles + detailed breakdowns
    const { profile: attackerProfile, statsInput: attackerStatsInput } = this.buildProfileWithInput(attackerPlayer);
    const { profile: defenderProfile, statsInput: defenderStatsInput } = this.buildProfileWithInput(defenderPlayer);

    const attackerDetailedBreakdown = calculateFullDetailedBreakdown(attackerStatsInput);
    const defenderDetailedBreakdown = calculateFullDetailedBreakdown(defenderStatsInput);

    // Resolve attack (single roll determines outcome; turns scale magnitude)
    const result = resolveAttack(attackerProfile, defenderProfile, DEFAULT_COMBAT_CONFIG);

    // Scale results by turns used
    const scaledGoldStolen = result.goldStolen * turns;
    const scaledFortDamage = Math.min(
      result.fortDamage * turns,
      defenderPlayer.fortification?.hitpoints ?? 0,
    );
    const scaledAttackerXP = result.attackerXP * turns;
    const scaledDefenderXP = result.defenderXP * turns;
    const scaledAttackerCasualties = this.scaleCasualties(result.attackerCasualties, turns, attackerProfile);
    const scaledDefenderCasualties = this.scaleCasualties(result.defenderCasualties, turns, defenderProfile);

    // Apply in transaction
    const log = await this.prisma.$transaction(async (tx) => {
      // Deduct attack turns
      await tx.playerEconomy.update({
        where: { player_id: attackerId },
        data: { attack_turns: { decrement: turns } },
      });

      // Apply attacker casualties (offense units, lowest level first)
      await this.applyCasualties(tx, attackerId, 'OFFENSE', scaledAttackerCasualties.offenseUnits);

      // Apply defender casualties
      if (scaledDefenderCasualties.defenseUnits > 0) {
        await this.applyCasualties(tx, defenderId, 'DEFENSE', scaledDefenderCasualties.defenseUnits);
      }
      if (scaledDefenderCasualties.offenseUnits > 0) {
        await this.applyCasualties(tx, defenderId, 'OFFENSE', scaledDefenderCasualties.offenseUnits);
      }
      if (scaledDefenderCasualties.spyUnits > 0) {
        await this.applyCasualties(tx, defenderId, 'SPY', scaledDefenderCasualties.spyUnits);
      }
      if (scaledDefenderCasualties.sentryUnits > 0) {
        await this.applyCasualties(tx, defenderId, 'SENTRY', scaledDefenderCasualties.sentryUnits);
      }
      if (scaledDefenderCasualties.citizenUnits > 0) {
        await this.applyCasualties(tx, defenderId, 'CITIZEN', scaledDefenderCasualties.citizenUnits);
      }

      // Transfer gold
      if (scaledGoldStolen > 0) {
        await tx.playerEconomy.update({
          where: { player_id: attackerId },
          data: { gold: { increment: BigInt(scaledGoldStolen) } },
        });
        await tx.playerEconomy.update({
          where: { player_id: defenderId },
          data: { gold: { decrement: BigInt(scaledGoldStolen) } },
        });

        // Bank history for gold theft
        await tx.bankHistory.create({
          data: {
            gold_amount: BigInt(scaledGoldStolen),
            from_user_id: defenderId,
            from_account_type: 'HAND',
            to_user_id: attackerId,
            to_account_type: 'HAND',
            date_time: new Date(),
            history_type: 'WAR_SPOILS',
          },
        });
      }

      // Fort damage
      if (scaledFortDamage > 0) {
        const currentHP = defenderPlayer.fortification?.hitpoints ?? 0;
        const newHP = Math.max(0, currentHP - scaledFortDamage);
        await tx.playerFortification.update({
          where: { player_id: defenderId },
          data: { hitpoints: newHP },
        });
      }

      // XP
      await tx.playerStats.update({
        where: { player_id: attackerId },
        data: { experience: { increment: scaledAttackerXP } },
      });
      await tx.playerStats.update({
        where: { player_id: defenderId },
        data: { experience: { increment: scaledDefenderXP } },
      });

      // Create attack log
      const attackLog = await tx.attackLog.create({
        data: {
          attacker_id: attackerId,
          defender_id: defenderId,
          winner: result.attackerWins ? attackerId : defenderId,
          type: 'attack',
          timestamp: new Date(),
          stats: JSON.stringify({
            attackerWins: result.attackerWins,
            turnsUsed: turns,
            ratio: Math.round(result.ratio * 100) / 100,
            goldStolen: scaledGoldStolen,
            fortDamage: scaledFortDamage,
            attackerCasualties: scaledAttackerCasualties,
            defenderCasualties: scaledDefenderCasualties,
            attackerXP: scaledAttackerXP,
            defenderXP: scaledDefenderXP,
            fortShield: Math.round(result.fortShield * 100) / 100,
            effectiveDefense: Math.round(result.effectiveDefense),
            roll: Math.round(result.roll * 1000) / 1000,
            attackerOffense: attackerProfile.offense,
            defenderDefense: defenderProfile.defense,
            attackerBreakdown: attackerDetailedBreakdown.offense,
            defenderBreakdown: defenderDetailedBreakdown.defense,
            attackerMeta: {
              race: attackerPlayer.race,
              playerClass: attackerPlayer.player_class,
              level: getLevelForXP(attackerPlayer.stats?.experience ?? 0),
              fortLevel: attackerPlayer.fortification?.fort_level ?? 1,
              fortHP: attackerPlayer.fortification?.hitpoints ?? 0,
              fortMaxHP: getFortificationByLevel(attackerPlayer.fortification?.fort_level ?? 1)?.hitpoints ?? 50,
            },
            defenderMeta: {
              race: defenderPlayer.race,
              playerClass: defenderPlayer.player_class,
              level: getLevelForXP(defenderPlayer.stats?.experience ?? 0),
              fortLevel: defenderPlayer.fortification?.fort_level ?? 1,
              fortHP: defenderPlayer.fortification?.hitpoints ?? 0,
              fortMaxHP: getFortificationByLevel(defenderPlayer.fortification?.fort_level ?? 1)?.hitpoints ?? 50,
            },
          }),
        },
      });

      // Recalculate stats for both players
      await this.recalculatePlayerStats(tx, attackerId);
      await this.recalculatePlayerStats(tx, defenderId);

      return attackLog;
    });

    // Emit events
    this.eventEmitter.emit(
      'combat.attack',
      new AttackExecutedEvent(attackerId, defenderId, result.attackerWins ? attackerId : defenderId, log.id),
    );
    if (scaledFortDamage > 0) {
      const newHP = Math.max(0, (defenderPlayer.fortification?.hitpoints ?? 0) - scaledFortDamage);
      this.eventEmitter.emit(
        'combat.fort_damaged',
        new FortDamagedEvent(defenderId, scaledFortDamage, newHP),
      );
    }

    // Check for level-ups from XP gained
    const attackerOldLevel = getLevelForXP(attackerPlayer.stats?.experience ?? 0);
    const attackerNewLevel = getLevelForXP((attackerPlayer.stats?.experience ?? 0) + scaledAttackerXP);
    if (attackerNewLevel > attackerOldLevel) {
      this.eventEmitter.emit(
        'account.leveled_up',
        new LeveledUpEvent(attackerId, attackerOldLevel, attackerNewLevel),
      );
    }
    const defenderOldLevel = getLevelForXP(defenderPlayer.stats?.experience ?? 0);
    const defenderNewLevel = getLevelForXP((defenderPlayer.stats?.experience ?? 0) + scaledDefenderXP);
    if (defenderNewLevel > defenderOldLevel) {
      this.eventEmitter.emit(
        'account.leveled_up',
        new LeveledUpEvent(defenderId, defenderOldLevel, defenderNewLevel),
      );
    }

    return {
      id: log.id,
      attackerWins: result.attackerWins,
      turnsUsed: turns,
      goldStolen: scaledGoldStolen.toString(),
      fortDamage: scaledFortDamage,
      attackerCasualties: scaledAttackerCasualties,
      defenderCasualties: scaledDefenderCasualties,
      attackerXP: scaledAttackerXP,
      defenderXP: scaledDefenderXP,
    };
  }

  // ─── Spy Mission ────────────────────────────────────────────────────

  async executeSpyMission(attackerId: string, defenderId: string, dto: SpyMissionDto) {
    if (attackerId === defenderId) {
      throw new BadRequestException('You cannot spy on yourself');
    }

    const config = DEFAULT_COMBAT_CONFIG;

    // Mission cost/config lookup
    const missionConfig: Record<string, { turnCost: number; goldCost: number; requiredLevel: number; rateLimit: number; logType: string }> = {
      INTEL: { turnCost: config.intelTurnCost, goldCost: config.intelGoldCost, requiredLevel: config.intelRequiredLevel, rateLimit: config.maxSpyPerTargetPer24h, logType: 'intel' },
      ASSASSINATE: { turnCost: 1, goldCost: 0, requiredLevel: config.assassinateRequiredLevel, rateLimit: config.maxSpyPerTargetPer24h, logType: 'assassinate' },
      INFILTRATE: { turnCost: 1, goldCost: 0, requiredLevel: config.infiltrateRequiredLevel, rateLimit: config.maxSpyPerTargetPer24h, logType: 'infiltrate' },
      STEAL_GOLD: { turnCost: config.stealGoldTurnCost, goldCost: config.stealGoldCost, requiredLevel: config.stealGoldRequiredLevel, rateLimit: config.stealGoldMaxPerTargetPer24h, logType: 'steal_gold' },
      SABOTAGE: { turnCost: config.sabotageTurnCost, goldCost: config.sabotageCost, requiredLevel: config.sabotageRequiredLevel, rateLimit: config.sabotageMaxPerTargetPer24h, logType: 'sabotage' },
    };

    const mc = missionConfig[dto.type];
    if (!mc) throw new BadRequestException('Invalid spy mission type');

    const [attackerPlayer, defenderPlayer] = await Promise.all([
      this.loadFullPlayer(attackerId),
      this.loadFullPlayer(defenderId),
    ]);

    if (!attackerPlayer) throw new NotFoundException('Attacker not found');
    if (!defenderPlayer) throw new NotFoundException('Defender not found');
    if (defenderPlayer.status !== 'ACTIVE') {
      throw new BadRequestException('Target player is not active');
    }

    // Check turns
    if ((attackerPlayer.economy?.attack_turns ?? 0) < mc.turnCost) {
      throw new BadRequestException(`Not enough attack turns (need ${mc.turnCost}, have ${attackerPlayer.economy?.attack_turns ?? 0})`);
    }

    // Check gold
    if (mc.goldCost > 0) {
      const currentGold = Number(attackerPlayer.economy?.gold ?? BigInt(0));
      if (currentGold < mc.goldCost) {
        throw new BadRequestException(`Not enough gold (need ${mc.goldCost.toLocaleString()}, have ${currentGold.toLocaleString()})`);
      }
    }

    // Check level range (±10 levels)
    const attackerLevel = getLevelForXP(attackerPlayer.stats?.experience ?? 0);
    const defenderLevel = getLevelForXP(defenderPlayer.stats?.experience ?? 0);
    if (Math.abs(attackerLevel - defenderLevel) > 10) {
      throw new BadRequestException(
        `Target is out of range (your level: ${attackerLevel}, their level: ${defenderLevel}, max difference: 10)`,
      );
    }

    // Check spy units of correct level
    const spyUnits = attackerPlayer.units.find(
      (u) => u.unit_type === 'SPY' && u.level >= mc.requiredLevel,
    );
    if (!spyUnits || spyUnits.quantity < dto.spiesSent) {
      throw new BadRequestException(`Not enough spy units of level ${mc.requiredLevel}+ (need ${dto.spiesSent}, have ${spyUnits?.quantity ?? 0})`);
    }

    // Per-type rate limit
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSpy = await this.prisma.attackLog.count({
      where: {
        attacker_id: attackerId,
        defender_id: defenderId,
        type: mc.logType,
        timestamp: { gte: dayAgo },
      },
    });
    if (recentSpy >= mc.rateLimit) {
      throw new BadRequestException(
        `Maximum ${mc.rateLimit} ${mc.logType} missions per target per 24 hours`,
      );
    }

    const attackerProfile = this.buildProfile(attackerPlayer);
    const defenderProfile = this.buildProfile(defenderPlayer);

    if (dto.type === 'INTEL') {
      const result = resolveIntel(attackerProfile, defenderProfile, dto.spiesSent, config);
      const logStats: any = { ...result, missionType: 'intel' };

      let intelData: any = null;
      if (result.success) {
        intelData = this.buildIntelReport(defenderPlayer, result.revealPercent);
        logStats.intelData = intelData;
      }

      const attackLog = await this.prisma.$transaction(async (tx) => {
        await tx.playerEconomy.update({
          where: { player_id: attackerId },
          data: {
            attack_turns: { decrement: mc.turnCost },
            ...(mc.goldCost > 0 ? { gold: { decrement: BigInt(mc.goldCost) } } : {}),
          },
        });

        if (result.spiesLost > 0) {
          await this.applyCasualties(tx, attackerId, 'SPY', result.spiesLost);
        }

        const log = await tx.attackLog.create({
          data: {
            attacker_id: attackerId,
            defender_id: defenderId,
            winner: result.success ? attackerId : defenderId,
            type: 'intel',
            timestamp: new Date(),
            stats: JSON.stringify(logStats),
          },
        });

        await this.recalculatePlayerStats(tx, attackerId);
        return log;
      });

      this.eventEmitter.emit(
        'combat.spy',
        new SpyMissionExecutedEvent(attackerId, defenderId, 'intel', result.success),
      );

      return { ...result, missionType: 'intel', intelData, attackLogId: attackLog.id };
    }

    if (dto.type === 'ASSASSINATE') {
      if (!dto.targetUnitType) {
        throw new BadRequestException('Target unit type is required for assassination');
      }

      const result = resolveAssassination(
        attackerProfile, defenderProfile, dto.spiesSent,
        dto.targetUnitType, config,
      );
      const logStats = { ...result, missionType: 'assassinate' };

      await this.prisma.$transaction(async (tx) => {
        await tx.playerEconomy.update({
          where: { player_id: attackerId },
          data: { attack_turns: { decrement: mc.turnCost } },
        });

        if (result.spiesLost > 0) {
          await this.applyCasualties(tx, attackerId, 'SPY', result.spiesLost);
        }

        if (result.unitsKilled > 0) {
          await this.applyCasualties(tx, defenderId, dto.targetUnitType!, result.unitsKilled);
        }

        await tx.attackLog.create({
          data: {
            attacker_id: attackerId,
            defender_id: defenderId,
            winner: result.success ? attackerId : defenderId,
            type: 'assassinate',
            timestamp: new Date(),
            stats: JSON.stringify(logStats),
          },
        });

        await this.recalculatePlayerStats(tx, attackerId);
        await this.recalculatePlayerStats(tx, defenderId);
      });

      this.eventEmitter.emit(
        'combat.spy',
        new SpyMissionExecutedEvent(attackerId, defenderId, 'assassinate', result.success),
      );

      return { ...result, missionType: 'assassinate' };
    }

    if (dto.type === 'INFILTRATE') {
      const result = resolveInfiltration(
        attackerProfile, defenderProfile, dto.spiesSent, config,
      );
      const logStats = { ...result, missionType: 'infiltrate' };

      await this.prisma.$transaction(async (tx) => {
        await tx.playerEconomy.update({
          where: { player_id: attackerId },
          data: { attack_turns: { decrement: mc.turnCost } },
        });

        if (result.spiesLost > 0) {
          await this.applyCasualties(tx, attackerId, 'SPY', result.spiesLost);
        }

        if (result.fortDamage > 0) {
          const currentHP = defenderPlayer.fortification?.hitpoints ?? 0;
          const newHP = Math.max(0, currentHP - result.fortDamage);
          await tx.playerFortification.update({
            where: { player_id: defenderId },
            data: { hitpoints: newHP },
          });
        }

        await tx.attackLog.create({
          data: {
            attacker_id: attackerId,
            defender_id: defenderId,
            winner: result.success ? attackerId : defenderId,
            type: 'infiltrate',
            timestamp: new Date(),
            stats: JSON.stringify(logStats),
          },
        });

        await this.recalculatePlayerStats(tx, attackerId);
      });

      this.eventEmitter.emit(
        'combat.spy',
        new SpyMissionExecutedEvent(attackerId, defenderId, 'infiltrate', result.success),
      );
      if (result.fortDamage > 0) {
        const newHP = Math.max(0, (defenderPlayer.fortification?.hitpoints ?? 0) - result.fortDamage);
        this.eventEmitter.emit(
          'combat.fort_damaged',
          new FortDamagedEvent(defenderId, result.fortDamage, newHP),
        );
      }

      return { ...result, missionType: 'infiltrate' };
    }

    if (dto.type === 'STEAL_GOLD') {
      const result = resolveStealGold(attackerProfile, defenderProfile, dto.spiesSent, config);
      const logStats = { ...result, missionType: 'steal_gold' };

      await this.prisma.$transaction(async (tx) => {
        await tx.playerEconomy.update({
          where: { player_id: attackerId },
          data: {
            attack_turns: { decrement: mc.turnCost },
            gold: { decrement: BigInt(mc.goldCost) },
          },
        });

        if (result.spiesLost > 0) {
          await this.applyCasualties(tx, attackerId, 'SPY', result.spiesLost);
        }

        if (result.goldStolen > 0) {
          await tx.playerEconomy.update({
            where: { player_id: attackerId },
            data: { gold: { increment: BigInt(result.goldStolen) } },
          });
          await tx.playerEconomy.update({
            where: { player_id: defenderId },
            data: { gold: { decrement: BigInt(result.goldStolen) } },
          });

          await tx.bankHistory.create({
            data: {
              gold_amount: BigInt(result.goldStolen),
              from_user_id: defenderId,
              from_account_type: 'HAND',
              to_user_id: attackerId,
              to_account_type: 'HAND',
              date_time: new Date(),
              history_type: 'SPY_THEFT',
            },
          });
        }

        await tx.attackLog.create({
          data: {
            attacker_id: attackerId,
            defender_id: defenderId,
            winner: result.success ? attackerId : defenderId,
            type: 'steal_gold',
            timestamp: new Date(),
            stats: JSON.stringify(logStats),
          },
        });

        await this.recalculatePlayerStats(tx, attackerId);
      });

      this.eventEmitter.emit(
        'combat.spy',
        new SpyMissionExecutedEvent(attackerId, defenderId, 'steal_gold', result.success),
      );

      return { ...result, missionType: 'steal_gold', goldStolen: result.goldStolen.toString() };
    }

    if (dto.type === 'SABOTAGE') {
      const result = resolveSabotage(attackerProfile, defenderProfile, dto.spiesSent, config);
      const destroyedItems: { itemType: string; usage: string; level: number }[] = [];

      await this.prisma.$transaction(async (tx) => {
        await tx.playerEconomy.update({
          where: { player_id: attackerId },
          data: {
            attack_turns: { decrement: mc.turnCost },
            gold: { decrement: BigInt(mc.goldCost) },
          },
        });

        if (result.spiesLost > 0) {
          await this.applyCasualties(tx, attackerId, 'SPY', result.spiesLost);
        }

        if (result.success && result.itemsDestroyed > 0) {
          // Get defender's items with qty > 0
          const defenderItems = await tx.playerItem.findMany({
            where: { player_id: defenderId, quantity: { gt: 0 } },
          });

          if (defenderItems.length > 0) {
            // Randomly pick items to destroy
            const shuffled = [...defenderItems].sort(() => Math.random() - 0.5);
            const toDestroy = Math.min(result.itemsDestroyed, shuffled.length);

            for (let i = 0; i < toDestroy; i++) {
              const item = shuffled[i]!;
              await tx.playerItem.update({
                where: { id: item.id },
                data: { quantity: { decrement: 1 } },
              });
              destroyedItems.push({
                itemType: item.item_type,
                usage: item.usage,
                level: item.level,
              });
            }
          }

          await this.recalculatePlayerStats(tx, defenderId);
        }

        await tx.attackLog.create({
          data: {
            attacker_id: attackerId,
            defender_id: defenderId,
            winner: result.success ? attackerId : defenderId,
            type: 'sabotage',
            timestamp: new Date(),
            stats: JSON.stringify({ ...result, missionType: 'sabotage', destroyedItems }),
          },
        });

        await this.recalculatePlayerStats(tx, attackerId);
      });

      this.eventEmitter.emit(
        'combat.spy',
        new SpyMissionExecutedEvent(attackerId, defenderId, 'sabotage', result.success),
      );

      return { ...result, missionType: 'sabotage', destroyedItems };
    }

    throw new BadRequestException('Invalid spy mission type');
  }

  // ─── Alliance Intel Sharing ─────────────────────────────────────────

  async shareIntelWithAlliance(playerId: string, attackLogId: number) {
    const log = await this.prisma.attackLog.findUnique({
      where: { id: attackLogId },
    });

    if (!log) throw new NotFoundException('Attack log not found');
    if (log.attacker_id !== playerId) throw new ForbiddenException('You are not the attacker');
    if (log.type !== 'intel') throw new BadRequestException('Only intel reports can be shared');
    if (log.winner !== playerId) throw new BadRequestException('Only successful intel missions can be shared');

    // Find player's alliance
    const membership = await this.prisma.allianceMembership.findFirst({
      where: { user_id: playerId },
      select: { alliance_id: true },
    });

    if (!membership) throw new BadRequestException('You are not in an alliance');

    // Check not already shared
    const existing = await this.prisma.allianceIntel.findFirst({
      where: { attack_log_id: attackLogId },
    });
    if (existing) throw new BadRequestException('This intel has already been shared');

    // Parse log stats for intel data and reveal percent
    let parsedStats: any = {};
    try { parsedStats = JSON.parse(log.stats); } catch { /* ignore */ }

    const revealPercent = parsedStats.revealPercent ?? 0;
    const intelData = parsedStats.intelData ?? {};

    await this.prisma.allianceIntel.create({
      data: {
        alliance_id: membership.alliance_id,
        target_id: log.defender_id,
        spied_by_id: playerId,
        attack_log_id: attackLogId,
        reveal_percent: revealPercent,
        intel_data: JSON.stringify(intelData),
      },
    });

    return { success: true, message: 'Intel shared with alliance' };
  }

  async getAllianceIntelForTarget(playerId: string, targetId: string) {
    const membership = await this.prisma.allianceMembership.findFirst({
      where: { user_id: playerId },
      select: { alliance_id: true },
    });

    if (!membership) return null;

    const intel = await this.prisma.allianceIntel.findFirst({
      where: {
        alliance_id: membership.alliance_id,
        target_id: targetId,
      },
      orderBy: { created_at: 'desc' },
      include: {
        spied_by: { select: { display_name: true } },
      },
    });

    if (!intel) return null;

    let parsedIntel: any = {};
    try { parsedIntel = JSON.parse(intel.intel_data); } catch { /* ignore */ }

    return {
      spiedByName: intel.spied_by.display_name,
      spiedAt: intel.created_at,
      revealPercent: intel.reveal_percent,
      intelData: parsedIntel,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private async loadFullPlayer(playerId: string) {
    return this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        stats: true,
        economy: true,
        fortification: true,
        units: true,
        items: true,
        battle_upgrades: true,
        bonus_points: true,
        structure_upgrades: true,
      },
    });
  }

  private buildProfile(player: NonNullable<Awaited<ReturnType<typeof this.loadFullPlayer>>>): CombatProfile {
    return this.buildProfileWithInput(player).profile;
  }

  private buildProfileWithInput(player: NonNullable<Awaited<ReturnType<typeof this.loadFullPlayer>>>) {
    const statsInput = {
      race: player.race,
      playerClass: player.player_class,
      fortLevel: player.fortification?.fort_level ?? 1,
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
      battleUpgrades: player.battle_upgrades.map((b) => ({
        upgradeType: b.upgrade_type,
        level: b.level,
        quantity: b.quantity,
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

    const fullStats = calculateFullStats(statsInput);
    const fortDef = getFortificationByLevel(player.fortification?.fort_level ?? 1);
    const fortMaxHP = fortDef?.hitpoints ?? 50;

    const data: FullPlayerData = {
      race: player.race,
      playerClass: player.player_class,
      fortLevel: player.fortification?.fort_level ?? 1,
      fortHitpoints: player.fortification?.hitpoints ?? fortMaxHP,
      gold: Number(player.economy?.gold ?? BigInt(0)),
      goldInBank: Number(player.economy?.gold_in_bank ?? BigInt(0)),
      experience: player.stats?.experience ?? 0,
      units: statsInput.units,
      items: statsInput.items,
      battleUpgrades: statsInput.battleUpgrades,
      bonusPoints: statsInput.bonusPoints,
      structureUpgrades: statsInput.structureUpgrades,
      offense: fullStats.offense.total,
      defense: fullStats.defense.total,
      spy: fullStats.spy.total,
      sentry: fullStats.sentry.total,
    };

    return { profile: buildCombatProfile(data), statsInput };
  }

  private scaleCasualties(
    casualties: { offenseUnits: number; defenseUnits: number; citizenUnits: number; spyUnits: number; sentryUnits: number; total: number },
    turns: number,
    profile: CombatProfile,
  ) {
    // Scale each casualty type by turns, but cap at available units
    const offenseUnits = Math.min(casualties.offenseUnits * turns, profile.offenseUnits);
    const defenseUnits = Math.min(casualties.defenseUnits * turns, profile.defenseUnits);
    const spyUnits = Math.min(casualties.spyUnits * turns, profile.spyUnits);
    const sentryUnits = Math.min(casualties.sentryUnits * turns, profile.sentryUnits);
    const citizenUnits = Math.min(casualties.citizenUnits * turns, profile.citizenUnits);
    return {
      offenseUnits,
      defenseUnits,
      spyUnits,
      sentryUnits,
      citizenUnits,
      total: offenseUnits + defenseUnits + spyUnits + sentryUnits + citizenUnits,
    };
  }

  private async applyCasualties(
    tx: any,
    playerId: string,
    unitType: string,
    totalLoss: number,
  ) {
    if (totalLoss <= 0) return;

    // Get units of this type, sorted by level ascending (lose lowest first)
    const units = await tx.playerUnit.findMany({
      where: { player_id: playerId, unit_type: unitType, quantity: { gt: 0 } },
      orderBy: { level: 'asc' },
    });

    let remaining = totalLoss;
    for (const unit of units) {
      if (remaining <= 0) break;
      const lost = Math.min(remaining, unit.quantity);
      await tx.playerUnit.update({
        where: { id: unit.id },
        data: { quantity: { decrement: lost } },
      });
      remaining -= lost;
    }
  }

  private async recalculatePlayerStats(tx: any, playerId: string) {
    const player = await tx.player.findUnique({
      where: { id: playerId },
      include: {
        units: true,
        items: true,
        battle_upgrades: true,
        bonus_points: true,
        structure_upgrades: true,
        fortification: true,
      },
    });

    if (!player) return;

    const statsInput = {
      race: player.race,
      playerClass: player.player_class,
      fortLevel: player.fortification?.fort_level ?? 1,
      units: player.units.map((u: any) => ({
        unitType: u.unit_type,
        level: u.level,
        quantity: u.quantity,
      })),
      items: player.items.map((i: any) => ({
        itemType: i.item_type,
        usage: i.usage,
        level: i.level,
        quantity: i.quantity,
      })),
      battleUpgrades: player.battle_upgrades.map((b: any) => ({
        upgradeType: b.upgrade_type,
        level: b.level,
        quantity: b.quantity,
      })),
      bonusPoints: player.bonus_points.map((bp: any) => ({
        bonusType: bp.bonus_type,
        level: bp.level,
      })),
      structureUpgrades: player.structure_upgrades.map((su: any) => ({
        upgradeType: su.upgrade_type,
        level: su.level,
      })),
    };

    const fullStats = calculateFullStats(statsInput);

    await tx.playerStats.update({
      where: { player_id: playerId },
      data: {
        offense: fullStats.offense.total,
        defense: fullStats.defense.total,
        spy: fullStats.spy.total,
        sentry: fullStats.sentry.total,
      },
    });
  }

  private buildIntelReport(player: any, revealPercent: number) {
    const report: any = {};

    // Always reveal basic info
    report.displayName = player.display_name;
    report.race = player.race;
    report.class = player.player_class;
    report.level = getLevelForXP(player.stats?.experience ?? 0);
    report.fortLevel = player.fortification?.fort_level ?? 1;

    if (revealPercent >= 20) {
      report.offense = player.stats?.offense ?? 0;
      report.defense = player.stats?.defense ?? 0;
    }

    if (revealPercent >= 40) {
      report.spy = player.stats?.spy ?? 0;
      report.sentry = player.stats?.sentry ?? 0;
    }

    if (revealPercent >= 60) {
      report.gold = (player.economy?.gold ?? BigInt(0)).toString();
      report.fortHitpoints = player.fortification?.hitpoints ?? 0;
    }

    if (revealPercent >= 80) {
      report.armySize = player.units
        .filter((u: any) => u.unit_type !== 'CITIZEN')
        .reduce((sum: number, u: any) => sum + u.quantity, 0);
      report.citizens = player.units
        .filter((u: any) => u.unit_type === 'CITIZEN')
        .reduce((sum: number, u: any) => sum + u.quantity, 0);
    }

    if (revealPercent >= 100) {
      report.goldInBank = (player.economy?.gold_in_bank ?? BigInt(0)).toString();
      report.units = player.units
        .filter((u: any) => u.quantity > 0)
        .map((u: any) => ({
          unitType: u.unit_type,
          level: u.level,
          quantity: u.quantity,
        }));
    }

    return report;
  }
}
