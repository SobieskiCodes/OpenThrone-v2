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
  calculateFullStats,
  calculateFullDetailedBreakdown,
  buildCombatProfile,
  resolveAttack,
  resolveIntel,
  resolveAssassination,
  resolveInfiltration,
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
} from '@openthrone/events';

@Injectable()
export class BattleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Player List / Rankings / History (existing) ────────────────────

  async getPlayers(currentPlayerId: string, query: BattlePlayersQueryDto) {
    const { page, limit, search, race, sort, order } = query;
    const playerClass = query.class;

    const where: any = {
      status: 'ACTIVE',
      id: { not: currentPlayerId },
    };

    if (search) {
      where.display_name = { contains: search };
    }
    if (race) {
      where.race = race;
    }
    if (playerClass) {
      where.player_class = playerClass;
    }

    const orderBy: any[] = [];
    const effectiveOrder = sort === 'rank' && order === 'asc' ? 'asc'
      : sort === 'rank' ? order
      : order;

    if (sort === 'rank') {
      orderBy.push({ stats: { rank: effectiveOrder } });
    } else if (sort === 'offense') {
      orderBy.push({ stats: { offense: effectiveOrder } });
    } else if (sort === 'defense') {
      orderBy.push({ stats: { defense: effectiveOrder } });
    } else if (sort === 'gold') {
      orderBy.push({ economy: { gold: effectiveOrder } });
    } else if (sort === 'level') {
      orderBy.push({ stats: { experience: effectiveOrder } });
    }

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
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.player.count({ where }),
    ]);

    const data = players.map((p) => {
      const armySize = p.units
        .filter((u) => u.unit_type !== 'CITIZEN')
        .reduce((sum, u) => sum + u.quantity, 0);
      const population = p.units.reduce((sum, u) => sum + u.quantity, 0);
      const fortLevel = p.fortification?.fort_level ?? 1;
      const fortDef = getFortificationByLevel(fortLevel);
      const fortMaxHP = fortDef?.hitpoints ?? 50;
      const fortHP = p.fortification?.hitpoints ?? fortMaxHP;

      return {
        id: p.id,
        displayName: p.display_name,
        race: p.race,
        class: p.player_class,
        level: getLevelForXP(p.stats?.experience ?? 0),
        rank: p.stats?.rank ?? 0,
        offense: p.stats?.offense ?? 0,
        defense: p.stats?.defense ?? 0,
        fortLevel,
        fortHP,
        fortMaxHP,
        population,
        armySize,
        gold: (p.economy?.gold ?? BigInt(0)).toString(),
        lastActive: p.last_active,
        status: p.status,
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

  async getRankings(query: BattleRankingsQueryDto) {
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
      let score: number;
      switch (type) {
        case 'offense': score = s.offense; break;
        case 'defense': score = s.defense; break;
        case 'spy': score = s.spy; break;
        case 'sentry': score = s.sentry; break;
        default: score = s.offense + s.defense + s.spy + s.sentry; break;
      }

      return {
        rank: type === 'overall' ? s.rank : (page - 1) * limit + index + 1,
        id: s.player.id,
        displayName: s.player.display_name,
        race: s.player.race,
        class: s.player.player_class,
        level: getLevelForXP(s.experience),
        score,
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

    const where: any = {};
    if (type === 'attack') {
      where.attacker_id = playerId;
    } else if (type === 'defense') {
      where.defender_id = playerId;
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

  async executeAttack(attackerId: string, defenderId: string) {
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

    // Check attack turns
    if ((attackerPlayer.economy?.attack_turns ?? 0) < 1) {
      throw new BadRequestException('No attack turns remaining');
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

    // Resolve attack
    const result = resolveAttack(attackerProfile, defenderProfile, DEFAULT_COMBAT_CONFIG);

    // Apply in transaction
    const log = await this.prisma.$transaction(async (tx) => {
      // Deduct attack turn
      await tx.playerEconomy.update({
        where: { player_id: attackerId },
        data: { attack_turns: { decrement: 1 } },
      });

      // Apply attacker casualties (offense units, lowest level first)
      await this.applyCasualties(tx, attackerId, 'OFFENSE', result.attackerCasualties.offenseUnits);

      // Apply defender casualties
      if (result.defenderCasualties.defenseUnits > 0) {
        await this.applyCasualties(tx, defenderId, 'DEFENSE', result.defenderCasualties.defenseUnits);
      }
      if (result.defenderCasualties.offenseUnits > 0) {
        await this.applyCasualties(tx, defenderId, 'OFFENSE', result.defenderCasualties.offenseUnits);
      }
      if (result.defenderCasualties.spyUnits > 0) {
        await this.applyCasualties(tx, defenderId, 'SPY', result.defenderCasualties.spyUnits);
      }
      if (result.defenderCasualties.sentryUnits > 0) {
        await this.applyCasualties(tx, defenderId, 'SENTRY', result.defenderCasualties.sentryUnits);
      }
      if (result.defenderCasualties.citizenUnits > 0) {
        await this.applyCasualties(tx, defenderId, 'CITIZEN', result.defenderCasualties.citizenUnits);
      }

      // Transfer gold
      if (result.goldStolen > 0) {
        await tx.playerEconomy.update({
          where: { player_id: attackerId },
          data: { gold: { increment: BigInt(result.goldStolen) } },
        });
        await tx.playerEconomy.update({
          where: { player_id: defenderId },
          data: { gold: { decrement: BigInt(result.goldStolen) } },
        });

        // Bank history for gold theft
        await tx.bankHistory.create({
          data: {
            gold_amount: BigInt(result.goldStolen),
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
      if (result.fortDamage > 0) {
        const currentHP = defenderPlayer.fortification?.hitpoints ?? 0;
        const newHP = Math.max(0, currentHP - result.fortDamage);
        await tx.playerFortification.update({
          where: { player_id: defenderId },
          data: { hitpoints: newHP },
        });
      }

      // XP
      await tx.playerStats.update({
        where: { player_id: attackerId },
        data: { experience: { increment: result.attackerXP } },
      });
      await tx.playerStats.update({
        where: { player_id: defenderId },
        data: { experience: { increment: result.defenderXP } },
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
            ratio: Math.round(result.ratio * 100) / 100,
            goldStolen: result.goldStolen,
            fortDamage: result.fortDamage,
            attackerCasualties: result.attackerCasualties,
            defenderCasualties: result.defenderCasualties,
            attackerXP: result.attackerXP,
            defenderXP: result.defenderXP,
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
    if (result.fortDamage > 0) {
      const newHP = Math.max(0, (defenderPlayer.fortification?.hitpoints ?? 0) - result.fortDamage);
      this.eventEmitter.emit(
        'combat.fort_damaged',
        new FortDamagedEvent(defenderId, result.fortDamage, newHP),
      );
    }

    return {
      id: log.id,
      attackerWins: result.attackerWins,
      goldStolen: result.goldStolen.toString(),
      fortDamage: result.fortDamage,
      attackerCasualties: result.attackerCasualties,
      defenderCasualties: result.defenderCasualties,
      attackerXP: result.attackerXP,
      defenderXP: result.defenderXP,
    };
  }

  // ─── Spy Mission ────────────────────────────────────────────────────

  async executeSpyMission(attackerId: string, defenderId: string, dto: SpyMissionDto) {
    if (attackerId === defenderId) {
      throw new BadRequestException('You cannot spy on yourself');
    }

    const [attackerPlayer, defenderPlayer] = await Promise.all([
      this.loadFullPlayer(attackerId),
      this.loadFullPlayer(defenderId),
    ]);

    if (!attackerPlayer) throw new NotFoundException('Attacker not found');
    if (!defenderPlayer) throw new NotFoundException('Defender not found');
    if (defenderPlayer.status !== 'ACTIVE') {
      throw new BadRequestException('Target player is not active');
    }

    if ((attackerPlayer.economy?.attack_turns ?? 0) < 1) {
      throw new BadRequestException('No attack turns remaining');
    }

    // Check spy units of correct level
    const requiredLevel = dto.type === 'ASSASSINATE' ? 3 : dto.type === 'INFILTRATE' ? 2 : 1;
    const spyUnits = attackerPlayer.units.find(
      (u) => u.unit_type === 'SPY' && u.level >= requiredLevel,
    );
    if (!spyUnits || spyUnits.quantity < dto.spiesSent) {
      const unitName = requiredLevel === 3 ? 'Assassins' : requiredLevel === 2 ? 'Infiltrators' : 'Spies';
      throw new BadRequestException(`Not enough ${unitName} (need ${dto.spiesSent}, have ${spyUnits?.quantity ?? 0})`);
    }

    // Rate limit
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSpy = await this.prisma.attackLog.count({
      where: {
        attacker_id: attackerId,
        defender_id: defenderId,
        type: { in: ['intel', 'assassinate', 'infiltrate'] },
        timestamp: { gte: dayAgo },
      },
    });
    if (recentSpy >= DEFAULT_COMBAT_CONFIG.maxSpyPerTargetPer24h) {
      throw new BadRequestException(
        `Maximum ${DEFAULT_COMBAT_CONFIG.maxSpyPerTargetPer24h} spy missions per target per 24 hours`,
      );
    }

    const attackerProfile = this.buildProfile(attackerPlayer);
    const defenderProfile = this.buildProfile(defenderPlayer);

    const missionType = dto.type.toLowerCase();
    let logStats: any;

    if (dto.type === 'INTEL') {
      const result = resolveIntel(attackerProfile, defenderProfile, dto.spiesSent, DEFAULT_COMBAT_CONFIG);
      logStats = { ...result, missionType: 'intel' };

      await this.prisma.$transaction(async (tx) => {
        await tx.playerEconomy.update({
          where: { player_id: attackerId },
          data: { attack_turns: { decrement: 1 } },
        });

        if (result.spiesLost > 0) {
          await this.applyCasualties(tx, attackerId, 'SPY', result.spiesLost);
        }

        await tx.attackLog.create({
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
      });

      this.eventEmitter.emit(
        'combat.spy',
        new SpyMissionExecutedEvent(attackerId, defenderId, 'intel', result.success),
      );

      // If successful, gather intel data
      let intelData: any = null;
      if (result.success) {
        intelData = this.buildIntelReport(defenderPlayer, result.revealPercent);
      }

      return { ...result, missionType: 'intel', intelData };
    }

    if (dto.type === 'ASSASSINATE') {
      if (!dto.targetUnitType) {
        throw new BadRequestException('Target unit type is required for assassination');
      }

      const result = resolveAssassination(
        attackerProfile, defenderProfile, dto.spiesSent,
        dto.targetUnitType, DEFAULT_COMBAT_CONFIG,
      );
      logStats = { ...result, missionType: 'assassinate' };

      await this.prisma.$transaction(async (tx) => {
        await tx.playerEconomy.update({
          where: { player_id: attackerId },
          data: { attack_turns: { decrement: 1 } },
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
        attackerProfile, defenderProfile, dto.spiesSent, DEFAULT_COMBAT_CONFIG,
      );
      logStats = { ...result, missionType: 'infiltrate' };

      await this.prisma.$transaction(async (tx) => {
        await tx.playerEconomy.update({
          where: { player_id: attackerId },
          data: { attack_turns: { decrement: 1 } },
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

    throw new BadRequestException('Invalid spy mission type');
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
